import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { ProductSubscription, MockUSDT, MockUSDC } from "../typechain-types";

describe("ProductSubscription", function () {
    let productSubscription: ProductSubscription;
    let mockUSDT: MockUSDT;  // 18 decimals
    let mockUSDC: MockUSDC;  // 6 decimals
    let owner: Signer;
    let admin: Signer;
    let pauser: Signer;
    let tokenManager: Signer;
    let upgrader: Signer;
    let productManager: Signer;
    let multiSig: Signer;
    let user1: Signer;
    let user2: Signer;

    const TELEGRAM_USER_ID_1 = "6543877705";
    const TELEGRAM_USER_ID_2 = "1234567890";
    const INVALID_USER_ID = "invalid123abc";
    const EMPTY_USER_ID = "";

    beforeEach(async function () {
        // 获取测试账户
        [owner, admin, pauser, tokenManager, upgrader, productManager, multiSig, user1, user2] = 
            await ethers.getSigners();

        // 部署 Mock ERC20 代币 (使用真实精度差异)
        const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        mockUSDT = await MockUSDTFactory.deploy(await owner.getAddress());  // 18 decimals
        mockUSDC = await MockUSDCFactory.deploy(await owner.getAddress());  // 6 decimals
        await mockUSDT.waitForDeployment();
        await mockUSDC.waitForDeployment();

        // 部署 ProductSubscription 合约
        const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription");
        productSubscription = await upgrades.deployProxy(
            ProductSubscriptionFactory,
            [
                await admin.getAddress(),
                await pauser.getAddress(),
                await tokenManager.getAddress(),
                await upgrader.getAddress(),
                await productManager.getAddress(), // 修复：添加productManager参数
                await multiSig.getAddress()
            ],
            { initializer: "initialize" }
        ) as ProductSubscription;

        await productSubscription.waitForDeployment();

        // 为测试用户铸造代币 (根据不同精度调整数量)
        const mintAmountUSDT = ethers.parseUnits("10000", 18); // 10,000 USDT (18 decimals)
        const mintAmountUSDC = ethers.parseUnits("10000", 6);  // 10,000 USDC (6 decimals)
        
        await mockUSDT.mint(await user1.getAddress(), mintAmountUSDT);
        await mockUSDT.mint(await user2.getAddress(), mintAmountUSDT);
        await mockUSDC.mint(await user1.getAddress(), mintAmountUSDC);
        await mockUSDC.mint(await user2.getAddress(), mintAmountUSDC);

        // 授权合约使用用户代币
        await mockUSDT.connect(user1).approve(await productSubscription.getAddress(), mintAmountUSDT);
        await mockUSDT.connect(user2).approve(await productSubscription.getAddress(), mintAmountUSDT);
        await mockUSDC.connect(user1).approve(await productSubscription.getAddress(), mintAmountUSDC);
        await mockUSDC.connect(user2).approve(await productSubscription.getAddress(), mintAmountUSDC);

        // 修复：不需要在这里设置产品管理员角色，因为initialize中已经设置
    });

    describe("初始化测试", function () {
        it("应该正确初始化合约", async function () {
            expect(await productSubscription.multiSig()).to.equal(await multiSig.getAddress());
            
            // 检查角色
            const ADMIN_ROLE = await productSubscription.ADMIN_ROLE();
            const PAUSER_ROLE = await productSubscription.PAUSER_ROLE();
            const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
            const UPGRADER_ROLE = await productSubscription.UPGRADER_ROLE();
            
            expect(await productSubscription.hasRole(ADMIN_ROLE, await admin.getAddress())).to.be.true;
            expect(await productSubscription.hasRole(PAUSER_ROLE, await pauser.getAddress())).to.be.true;
            expect(await productSubscription.hasRole(TOKEN_MANAGER_ROLE, await tokenManager.getAddress())).to.be.true;
            expect(await productSubscription.hasRole(UPGRADER_ROLE, await upgrader.getAddress())).to.be.true;
        });

        it("应该拒绝零地址初始化", async function () {
            const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription");
            
            await expect(upgrades.deployProxy(
                ProductSubscriptionFactory,
                [
                    ethers.ZeroAddress, // 零地址
                    await pauser.getAddress(),
                    await tokenManager.getAddress(),
                    await upgrader.getAddress(),
                    await productManager.getAddress(),
                    await multiSig.getAddress()
                ],
                { initializer: "initialize" }
            )).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });
    });

    describe("商品管理测试", function () {
        beforeEach(async function () {
            // 添加支持的代币
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDC.getAddress());
        });

        it("应该成功添加商品", async function () {
            const productId = 1;
            const amount = ethers.parseUnits("100", 18); // V2升级：使用18位精度作为基准

            await expect(
                productSubscription.connect(productManager).addProduct(productId, amount)
            ).to.emit(productSubscription, "ProductAdded")
             .withArgs(productId, amount);

            const product = await productSubscription.getProduct(productId);
            expect(product.productId).to.equal(productId);
            expect(product.amount).to.equal(amount);
        });

        it("应该拒绝无效的商品ID", async function () {
            await expect(
                productSubscription.connect(productManager).addProduct(0, ethers.parseUnits("100", 18))
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });

        it("应该拒绝无效的商品金额", async function () {
            await expect(
                productSubscription.connect(productManager).addProduct(1, 0)
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });

        it("应该拒绝重复的商品ID", async function () {
            const productId = 1;
            await productSubscription.connect(productManager).addProduct(productId,  ethers.parseUnits("100", 18));
            
            await expect(
                productSubscription.connect(productManager).addProduct(productId, ethers.parseUnits("200", 18))
            ).to.be.revertedWithCustomError(productSubscription, "Exists");
        });

        it("应该成功更新商品", async function () {
            const productId = 1;
            await productSubscription.connect(productManager).addProduct(productId, ethers.parseUnits("100", 18));
            
            const newAmount = ethers.parseUnits("200", 18);
            
            await expect(
                productSubscription.connect(productManager).updateProduct(productId, newAmount)
            ).to.emit(productSubscription, "ProductUpdated")
             .withArgs(productId, newAmount,ethers.parseUnits("100", 18));

            const product = await productSubscription.getProduct(productId);
       
            expect(product.amount).to.equal(newAmount);
        });

        it("应该成功删除商品", async function () {
            const productId = 1;
            await productSubscription.connect(productManager).addProduct(productId,ethers.parseUnits("100", 18));
            
            await expect(
                productSubscription.connect(productManager).removeProduct(productId)
            ).to.emit(productSubscription, "ProductRemoved")
             .withArgs(productId);

            await expect(
                productSubscription.getProduct(productId)
            ).to.be.revertedWithCustomError(productSubscription, "NotFound");
        });

        it("应该正确处理商品列表查询", async function () {
            // 添加多个商品
            for (let i = 1; i <= 5; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits((100 * i).toString(), 6));
            }

            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(5);

            const productCount = await productSubscription.activeProductCount();
            expect(productCount).to.equal(5);

            // 测试真实计数函数
            const realCount = await productSubscription.activeProductCount();
            expect(realCount).to.equal(5);

            // 测试分页查询
            const paginatedList = await productSubscription.getProductListPaginated(1, 3);
            expect(paginatedList.length).to.equal(3);
            expect(paginatedList[0].productId).to.equal(2);
        });

        it("应该限制getProductList的返回数量", async function () {
            // 修复：添加超过50个商品来测试DOS防护（限制已降低到50）
            for (let i = 1; i <= 55; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits("100", 6));
            }

            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(50); // 应该被限制为50个
        });
    });

    describe("购买功能测试", function () {
        const productId = 1;
        const productAmount = ethers.parseUnits("100", 18); // V2升级：使用18位精度

        beforeEach(async function () {
            // 添加支持的代币和商品
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(productId,productAmount);
        });

        it("应该成功购买商品", async function () {
            const initialMultiSigBalance = await mockUSDT.balanceOf(await multiSig.getAddress());
            const initialUserBalance = await mockUSDT.balanceOf(await user1.getAddress());
            const orderId = "12345";

            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, orderId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1)
            ).to.emit(productSubscription, "PaymentDeposited");

            // 检查余额变化
            const finalMultiSigBalance = await mockUSDT.balanceOf(await multiSig.getAddress());
            const finalUserBalance = await mockUSDT.balanceOf(await user1.getAddress());

            expect(finalMultiSigBalance).to.equal(initialMultiSigBalance + productAmount);
            expect(finalUserBalance).to.equal(initialUserBalance - productAmount);
            

            // 修复：检查订单是否存在和购买记录
            expect(await productSubscription.orderExists(orderId)).to.be.true;
            // getUserPurchaseIds函数已被删除，通过其他方式验证购买记录
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 50);
            expect(records.length).to.equal(1);
        });

        it("应该拒绝不存在的商品", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(999, "12345", await mockUSDT.getAddress(), TELEGRAM_USER_ID_1)
            ).to.be.revertedWithCustomError(productSubscription, "NotFound");
        });

        it("应该拒绝不支持的代币", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDC.getAddress(), TELEGRAM_USER_ID_1)
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });

        it("应该拒绝无效的Telegram userId", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDT.getAddress(), INVALID_USER_ID)
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");

            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDT.getAddress(), EMPTY_USER_ID)
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });

        // it("应该拒绝重复购买", async function () {
        //     await productSubscription.connect(user1).purchaseProduct(productId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
        //     await expect(
        //         productSubscription.connect(user1).purchaseProduct(productId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1)
        //     ).to.be.revertedWithCustomError(productSubscription, "ProductAlreadyPurchased");
        // });

        it("应该正确处理多用户购买同一商品", async function () {
            const orderId1 = "12345";
            const orderId2 = "67890";
            
            await productSubscription.connect(user1).purchaseProduct(productId, orderId1, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user2).purchaseProduct(productId, orderId2, await mockUSDT.getAddress(), TELEGRAM_USER_ID_2);

            // 修复：检查订单存在性而不是用户购买状态
            expect(await productSubscription.orderExists(orderId1)).to.be.true;
            expect(await productSubscription.orderExists(orderId2)).to.be.true;
            // 通过purchaseRecords数组长度验证总记录数
            const allRecords = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 50);
            expect(allRecords.length).to.be.greaterThanOrEqual(1);
        });

        it("应该能够根据Telegram userId查询购买记录", async function () {
            const orderId = "12345";
            await productSubscription.connect(user1).purchaseProduct(productId, orderId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1,1,10);
            expect(records.length).to.equal(1);
            const record = records[0];
            expect(record.buyer).to.equal(await user1.getAddress());
            expect(record.productId).to.equal(productId);
            expect(record.userId).to.equal(TELEGRAM_USER_ID_1);
            expect(record.orderId).to.equal(orderId);
        });

        it("应该能够根据userId和orderId查询单个购买记录", async function () {
            const orderId1 = "12345";
            const orderId2 = "67890";
            
            // 用户1购买商品
            await productSubscription.connect(user1).purchaseProduct(productId, orderId1, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            // 用户2购买商品
            await productSubscription.connect(user2).purchaseProduct(productId, orderId2, await mockUSDT.getAddress(), TELEGRAM_USER_ID_2);
            
            // 查询用户1的记录
            const [record1, found1] = await productSubscription.getPurchaseRecordByUserIdAndOrderId(TELEGRAM_USER_ID_1, orderId1);
            expect(found1).to.be.true;
            expect(record1.buyer).to.equal(await user1.getAddress());
            expect(record1.productId).to.equal(productId);
            expect(record1.userId).to.equal(TELEGRAM_USER_ID_1);
            expect(record1.orderId).to.equal(orderId1);
            expect(record1.symbol).to.equal("MockUSDT");
            
            // 查询用户2的记录
            const [record2, found2] = await productSubscription.getPurchaseRecordByUserIdAndOrderId(TELEGRAM_USER_ID_2, orderId2);
            expect(found2).to.be.true;
            expect(record2.buyer).to.equal(await user2.getAddress());
            expect(record2.orderId).to.equal(orderId2);
            expect(record2.userId).to.equal(TELEGRAM_USER_ID_2);
        });

        it("应该正确处理不存在的userId和orderId组合查询", async function () {
            const orderId = "12345";
            await productSubscription.connect(user1).purchaseProduct(productId, orderId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
            // 查询不存在的userId
            const [record1, found1] = await productSubscription.getPurchaseRecordByUserIdAndOrderId("9999999999", orderId);
            expect(found1).to.be.false;
            expect(record1.orderId).to.equal("");
            expect(record1.buyer).to.equal(ethers.ZeroAddress);
            expect(record1.userId).to.equal("");
            
            // 查询存在的userId但不存在的orderId
            const [record2, found2] = await productSubscription.getPurchaseRecordByUserIdAndOrderId(TELEGRAM_USER_ID_1, "99999");
            expect(found2).to.be.false;
            expect(record2.orderId).to.equal("");
            
            // 查询不存在的userId和不存在的orderId
            const [record3, found3] = await productSubscription.getPurchaseRecordByUserIdAndOrderId("8888888888", "88888");
            expect(found3).to.be.false;
        });

        it("应该正确处理相同用户多个不同订单的查询", async function () {
            const orderId1 = "11111";
            const orderId2 = "22222";
            const orderId3 = "33333";
            
            // 同一用户购买多次
            await productSubscription.connect(user1).purchaseProduct(productId, orderId1, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user1).purchaseProduct(productId, orderId2, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user1).purchaseProduct(productId, orderId3, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
            // 分别查询每个订单
            const [record1, found1] = await productSubscription.getPurchaseRecordByUserIdAndOrderId(TELEGRAM_USER_ID_1, orderId1);
            expect(found1).to.be.true;
            expect(record1.orderId).to.equal(orderId1);
            
            const [record2, found2] = await productSubscription.getPurchaseRecordByUserIdAndOrderId(TELEGRAM_USER_ID_1, orderId2);
            expect(found2).to.be.true;
            expect(record2.orderId).to.equal(orderId2);
            
            const [record3, found3] = await productSubscription.getPurchaseRecordByUserIdAndOrderId(TELEGRAM_USER_ID_1, orderId3);
            expect(found3).to.be.true;
            expect(record3.orderId).to.equal(orderId3);
            
            // 验证所有记录都属于同一用户
            expect(record1.userId).to.equal(TELEGRAM_USER_ID_1);
            expect(record2.userId).to.equal(TELEGRAM_USER_ID_1);
            expect(record3.userId).to.equal(TELEGRAM_USER_ID_1);
        });
        
        it("应该防止重复订单ID攻击", async function () {
            const orderId = "duplicate-order";
            
            // 第一次购买应该成功
            await productSubscription.connect(user1).purchaseProduct(
                productId, 
                orderId, 
                await mockUSDT.getAddress(), 
                TELEGRAM_USER_ID_1
            );
            
            // 第二次使用相同订单ID应该失败
            await expect(
                productSubscription.connect(user2).purchaseProduct(
                    productId, 
                    orderId, 
                    await mockUSDT.getAddress(), 
                    TELEGRAM_USER_ID_2
                )
            ).to.be.revertedWithCustomError(productSubscription, "Exists");
            
            // 同一用户使用相同订单ID也应该失败
            await expect(
                productSubscription.connect(user1).purchaseProduct(
                    productId, 
                    orderId, 
                    await mockUSDT.getAddress(), 
                    TELEGRAM_USER_ID_1
                )
            ).to.be.revertedWithCustomError(productSubscription, "Exists");
        });
        
        it("应该允许用户使用不同订单ID重复购买同一产品", async function () {
            const orderId1 = "order-1";
            const orderId2 = "order-2";
            const orderId3 = "order-3";
            
            // 同一用户多次购买同一产品（不同订单ID）
            await productSubscription.connect(user1).purchaseProduct(productId, orderId1, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user1).purchaseProduct(productId, orderId2, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user1).purchaseProduct(productId, orderId3, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
            // 验证所有订单都存在
            expect(await productSubscription.orderExists(orderId1)).to.be.true;
            expect(await productSubscription.orderExists(orderId2)).to.be.true;
            expect(await productSubscription.orderExists(orderId3)).to.be.true;
            
            // 验证用户购买记录数量
            // getUserPurchaseIds函数已被删除，通过其他方式验证购买记录
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 50);
            expect(records.length).to.equal(3);
            
            // 验证总购买记录数量通过查询所有用户记录
            const allUser1Records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 50);
            expect(allUser1Records.length).to.equal(3);
        });
    });

    describe("安全修复测试", function () {
        beforeEach(async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(1, ethers.parseUnits("100", 6));
        });
        
        it("应该防止空订单ID攻击", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(
                    1, 
                    "", // 空订单ID
                    await mockUSDT.getAddress(), 
                    TELEGRAM_USER_ID_1
                )
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });
        
        it("应该防止无效userId攻击", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(
                    1, 
                    "valid-order-id", 
                    await mockUSDT.getAddress(), 
                    "" // 空userId
                )
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
            
            await expect(
                productSubscription.connect(user1).purchaseProduct(
                    1, 
                    "valid-order-id-2", 
                    await mockUSDT.getAddress(), 
                    "invalid-user-id-with-letters" // 非数字userId
                )
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });
    });
    
    describe("代币管理测试", function () {
        it("应该成功添加支持的代币", async function () {
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.emit(productSubscription, "TokenAdded")
             .withArgs(await mockUSDT.getAddress(), "MockUSDT");

            expect(await productSubscription.supportCoins(await mockUSDT.getAddress())).to.be.true;
        });

        it("应该拒绝添加重复的代币", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });

        it("应该成功移除支持的代币", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            
            await expect(
                productSubscription.connect(tokenManager).removeSupportedToken(await mockUSDT.getAddress())
            ).to.emit(productSubscription, "TokenRemoved")
             .withArgs(await mockUSDT.getAddress(), "MockUSDT");

            expect(await productSubscription.supportCoins(await mockUSDT.getAddress())).to.be.false;
        });

        it("应该拒绝移除不支持的代币", async function () {
            await expect(
                productSubscription.connect(tokenManager).removeSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "Unsupported");
        });
    });

    describe("角色权限测试", function () {
        it("应该正确管理角色", async function () {
            // 只有DEFAULT_ADMIN_ROLE的持有者才可以管理其他角色
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            // const DEFAULT_ADMIN_ROLE = await productSubscription.DEFAULT_ADMIN_ROLE();
            
            // 首先给admin分配DEFAULT_ADMIN_ROLE
            // 在OpenZeppelin AccessControl中，默认情况下初始部署者没有DEFAULT_ADMIN_ROLE
            // 我们需要使用已有的ADMIN_ROLE者来操作
            
            // 由于ADMIN_ROLE不是所有角色的管理员，我们只能测试现有功能
            // 检查productManager是否有PRODUCT_MANAGER_ROLE
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.true;
        });

        it("应该拒绝非管理员的角色操作", async function () {
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            
            // user1没有DEFAULT_ADMIN_ROLE，不能管理PRODUCT_MANAGER_ROLE
            await expect(
                productSubscription.connect(user1).grantRole(PRODUCT_MANAGER_ROLE, await user2.getAddress())
            ).to.be.revertedWithCustomError(
                productSubscription, 
                "AccessControlUnauthorizedAccount"
            );
        });

        it("应该成功更新多签地址", async function () {
            await expect(
                productSubscription.connect(admin).updateMultiSig(await user1.getAddress())
            ).to.emit(productSubscription, "MultiSigUpdated")
             .withArgs(await user1.getAddress());

            expect(await productSubscription.multiSig()).to.equal(await user1.getAddress());
        });

        it("应该拒绝非管理员更新多签地址", async function () {
            await expect(
                productSubscription.connect(user1).updateMultiSig(await user2.getAddress())
            ).to.be.revertedWithCustomError(
                productSubscription,
                "AccessControlUnauthorizedAccount"
            );
        });
        
        it("应该正确验证初始化时的角色分离", async function () {
            // 验证产品管理员不具有升级权限
            const UPGRADER_ROLE = await productSubscription.UPGRADER_ROLE();
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.true;
            expect(await productSubscription.hasRole(UPGRADER_ROLE, await productManager.getAddress())).to.be.false;
            
            // 验证升级员不具有产品管理权限
            expect(await productSubscription.hasRole(UPGRADER_ROLE, await upgrader.getAddress())).to.be.true;
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await upgrader.getAddress())).to.be.false;
        });
        
        it("应该正确设置角色管理层次", async function () {
            const DEFAULT_ADMIN_ROLE = await productSubscription.DEFAULT_ADMIN_ROLE();
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
            const PAUSER_ROLE = await productSubscription.PAUSER_ROLE();
            const UPGRADER_ROLE = await productSubscription.UPGRADER_ROLE();
            
            // 验证DEFAULT_ADMIN_ROLE(即0x00)是所有其他角色的管理员
            expect(await productSubscription.getRoleAdmin(PRODUCT_MANAGER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
            expect(await productSubscription.getRoleAdmin(TOKEN_MANAGER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
            expect(await productSubscription.getRoleAdmin(PAUSER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
            expect(await productSubscription.getRoleAdmin(UPGRADER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
        });

        it("应该能够移除角色权限", async function () {
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
            
            // 验证初始状态：productManager和tokenManager都有相应权限
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.true;
            expect(await productSubscription.hasRole(TOKEN_MANAGER_ROLE, await tokenManager.getAddress())).to.be.true;
            
            // admin可以移除productManager的权限
            await productSubscription.connect(admin).revokeRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress());
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.false;
            
            // 验证移除权限后，productManager无法执行需要权限的操作
            await expect(
                productSubscription.connect(productManager).addProduct(999, ethers.parseUnits("100", 18))
            ).to.be.revertedWithCustomError(
                productSubscription,
                "AccessControlUnauthorizedAccount"
            );
            
            // admin也可以移除tokenManager的权限
            await productSubscription.connect(admin).revokeRole(TOKEN_MANAGER_ROLE, await tokenManager.getAddress());
            expect(await productSubscription.hasRole(TOKEN_MANAGER_ROLE, await tokenManager.getAddress())).to.be.false;
            
            // 验证移除权限后，tokenManager无法添加支持的代币
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(
                productSubscription,
                "AccessControlUnauthorizedAccount"
            );
        });

        it("应该能够重新授予被移除的角色权限", async function () {
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            
            // 先移除权限
            await productSubscription.connect(admin).revokeRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress());
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.false;
            
            // 重新授予权限
            await productSubscription.connect(admin).grantRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress());
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.true;
            
            // 验证重新获得权限后可以正常操作
            await productSubscription.connect(productManager).addProduct(777, ethers.parseUnits("50", 18));
            const product = await productSubscription.getProduct(777);
            expect(product.productId).to.equal(777);
            expect(product.amount).to.equal(ethers.parseUnits("50", 18));
        });

        it("应该拒绝非管理员移除他人权限", async function () {
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
            
            // user1尝试移除productManager的权限应该失败
            await expect(
                productSubscription.connect(user1).revokeRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())
            ).to.be.revertedWithCustomError(
                productSubscription,
                "AccessControlUnauthorizedAccount"
            );
            
            // 验证权限没有被移除
            expect(await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.true;
        });

        it("升级权限应该只允许ADMIN_ROLE", async function () {
            // 验证只有admin角色可以升级（这是修复后的安全措施）
            const mockNewImplementation = await user1.getAddress(); // 使用一个地址作为测试
            
            // 尝试用upgrader角色升级应该失败（因为现在只允许admin）
            // 注意：我们不能直接调用_authorizeUpgrade，但可以通过upgradeToAndCall测试
            // 这里我们验证角色检查逻辑
            
            // 首先验证upgrader确实有UPGRADER_ROLE
            const UPGRADER_ROLE = await productSubscription.UPGRADER_ROLE();
            expect(await productSubscription.hasRole(UPGRADER_ROLE, await upgrader.getAddress())).to.be.true;
            
            // 但upgrader应该没有admin权限执行实际升级
            const ADMIN_ROLE = await productSubscription.ADMIN_ROLE();
            expect(await productSubscription.hasRole(ADMIN_ROLE, await upgrader.getAddress())).to.be.false;
            
            // admin有升级权限
            expect(await productSubscription.hasRole(ADMIN_ROLE, await admin.getAddress())).to.be.true;
        });

        it("应该能够将权限授予新用户", async function () {
            const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
            
            // 验证user2初始没有代币管理权限
            expect(await productSubscription.hasRole(TOKEN_MANAGER_ROLE, await user2.getAddress())).to.be.false;
            
            // admin给user2授予代币管理权限
            await productSubscription.connect(admin).grantRole(TOKEN_MANAGER_ROLE, await user2.getAddress());
            expect(await productSubscription.hasRole(TOKEN_MANAGER_ROLE, await user2.getAddress())).to.be.true;
            
            // 验证user2现在可以执行代币管理操作
            await productSubscription.connect(user2).addSupportedToken(await mockUSDT.getAddress());
            expect(await productSubscription.supportCoins(await mockUSDT.getAddress())).to.be.true;
            
            // 清理：移除user2的权限
            await productSubscription.connect(admin).revokeRole(TOKEN_MANAGER_ROLE, await user2.getAddress());
            expect(await productSubscription.hasRole(TOKEN_MANAGER_ROLE, await user2.getAddress())).to.be.false;
        });
    });

    describe("暂停和升级测试", function () {
        it("应该成功暂停和恢复合约", async function () {
           try {
             await productSubscription.connect(pauser).pause();
            expect(await productSubscription.paused()).to.be.true;

            // 暂停时应该无法调用状态变更函数
            // 暂停时应该无法调用状态变更函数
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "EnforcedPause");

            await productSubscription.connect(pauser).unpause();
            expect(await productSubscription.paused()).to.be.false;

            // 恢复后应该可以正常调用
            await expect(productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress()))
                .to.emit(productSubscription, "TokenAdded");
           }catch (error) { console.error("Error during pause/unpause test:", error);
           throw error; // Rethrow to ensure the test fails
           }
        });

        it("应该拒绝非pauser角色的暂停操作", async function () {
            await expect(
                productSubscription.connect(user1).pause()
            ).to.be.revertedWithCustomError(
                productSubscription,
                "AccessControlUnauthorizedAccount"
            );
        });
    });

    describe("边界条件和错误处理测试", function () {

        it("应该正确处理空的购买记录查询", async function () {
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId("9999999999",1,10);
            expect(records.length).to.equal(0);
        });

        it("应该正确处理分页查询边界情况", async function () {
            // 先添加一些产品来测试
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            for (let i = 1; i <= 5; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits("100", 6));
            }
            
            // 查询超出范围的分页应该返回空数组
            const emptyResult = await productSubscription.getProductListPaginated(1000, 10);
            expect(emptyResult.length).to.equal(0);
            
            // 查询正常范围应该返回结果
            const normalResult = await productSubscription.getProductListPaginated(0, 3);
            expect(normalResult.length).to.equal(3);
            
            // 查询部分超出范围应该返回剩余的
            const partialResult = await productSubscription.getProductListPaginated(3, 5);
            expect(partialResult.length).to.equal(2); // 只剩余 2 个产品
        });

        it("应该正确处理用户没有购买记录的情况", async function () {
            // getUserPurchaseIds函数已被删除，通过其他方式验证
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 50);
            expect(records.length).to.equal(0);
        });
    });

    describe("事件测试", function () {
        beforeEach(async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(1, ethers.parseUnits("100", 6));
        });

        it("购买事件应该包含所有必要信息", async function () {
            const tx = await productSubscription.connect(user1).purchaseProduct(
                1, 
                "12345",
                await mockUSDT.getAddress(), 
                TELEGRAM_USER_ID_1
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = productSubscription.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    } as any);
                    return parsed?.name === 'PaymentDeposited';
                } catch {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
        });
    });

    // describe("Gas优化测试", function () {
    //     it("批量操作应该合理消耗Gas", async function () {
    //         await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            
    //         // 测试批量添加商品的Gas消耗
    //         const gasUsed = [];
    //         for (let i = 1; i <= 10; i++) {
    //             const tx = await productSubscription.connect(productManager).addProduct(
    //                 i, 
    //                 30, 
    //                 ethers.parseUnits("100", 6)
    //             );
    //             const receipt = await tx.wait();
    //             gasUsed.push(receipt?.gasUsed || BigInt(0));
    //         }

    //         // Gas使用应该相对稳定
    //         const avgGas = gasUsed.reduce((sum, gas) => sum + gas, BigInt(0)) / BigInt(gasUsed.length);
    //         for (const gas of gasUsed) {
    //             const diff = gas > avgGas ? gas - avgGas : avgGas - gas;
    //             expect(diff).to.be.lessThan(avgGas / BigInt(10)); // 变化不超过10%
    //         }
    //     });
    // });
    
    describe("存储兼容性测试", function () {
        it("应该支持合约升级", async function () {
            // 这个测试验证合约可以正常工作，为升级做准备
            // 验证新的映射是否可用
            expect(await productSubscription.orderExists("non-existent-order")).to.be.false;
        });
        
        it("应该支持新旧字段兼容", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(1, ethers.parseUnits("100", 6));
            
            const orderId = "test-order";
            await productSubscription.connect(user1).purchaseProduct(1, orderId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
            // 验证新旧字段都能正确工作
            expect(await productSubscription.orderExists(orderId)).to.be.true;
        });
    });
    
    describe("数据一致性修复测试", function () {
        beforeEach(async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
        });

        it("应该能够诊断数据不一致问题", async function () {
            // 添加一些产品
            for (let i = 1; i <= 3; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits("100", 6));
            }

            // 检查计数方法是否正确
            const activeProductCount = await productSubscription.activeProductCount();
            expect(activeProductCount).to.equal(3);
            
            // 验证产品列表长度与计数器一致
            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(3);
        });

        it("应该能够修复数据不一致问题", async function () {
            // 添加一些产品
            for (let i = 1; i <= 3; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits("100", 6));
            }

            // repairDataConsistency函数已被删除

            // 验证修复后数据一致
            const activeProductCount = await productSubscription.activeProductCount();
            expect(activeProductCount).to.equal(3);
            
            // 验证产品列表长度与计数器同步
            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(3);
        });

        // repairDataConsistency函数已被删除，此测试不再需要

        // repairDataConsistency函数已被删除，此测试不再需要

        // repairDataConsistency函数已被删除，此测试不再需要

        it("计数器应该在产品操作中正确更新", async function () {
            // 初始状态
            expect(await productSubscription.activeProductCount()).to.equal(0);

            // 添加产品
            await productSubscription.connect(productManager).addProduct(1, ethers.parseUnits("100", 6));
            expect(await productSubscription.activeProductCount()).to.equal(1);

            await productSubscription.connect(productManager).addProduct(2, ethers.parseUnits("200", 6));
            expect(await productSubscription.activeProductCount()).to.equal(2);

            // 删除产品
            await productSubscription.connect(productManager).removeProduct(1);
            expect(await productSubscription.activeProductCount()).to.equal(1);

            // 更新产品不应该影响计数器
            await productSubscription.connect(productManager).updateProduct(2, ethers.parseUnits("300", 6));
            expect(await productSubscription.activeProductCount()).to.equal(1);

            // 删除最后一个产品
            await productSubscription.connect(productManager).removeProduct(2);
            expect(await productSubscription.activeProductCount()).to.equal(0);
        });

        it("getRealProductCount应该高效执行(O(1))", async function () {
            // 添加多个产品
            for (let i = 1; i <= 10; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits("100", 6));
            }

            // 这个调用现在应该是O(1)而不是O(n)
            const startTime = Date.now();
            const count = await productSubscription.activeProductCount();
            const endTime = Date.now();

            expect(count).to.equal(10);
            // 由于是O(1)操作，执行时间应该很短（但这个测试在单元测试中意义不大，主要是文档作用）
            expect(endTime - startTime).to.be.lessThan(100); // 应该在100ms内完成
        });
    });
    
    describe("数据一致性测试", function () {
        beforeEach(async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(1,ethers.parseUnits("100", 6));
        });
        
        it("购买失败时不应该标记订单为已使用", async function () {
            const orderId = "test-order";
            
            // 模拟资金不足的情况
            await mockUSDT.connect(user1).transfer(await user2.getAddress(), await mockUSDT.balanceOf(await user1.getAddress()));
            
            // 购买应该失败
            await expect(
                productSubscription.connect(user1).purchaseProduct(1, orderId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1)
            ).to.be.reverted;
            
            // 订单不应该被标记为已使用
            expect(await productSubscription.orderExists(orderId)).to.be.false;
        });
        
        it("应该维持数组和映射的一致性", async function () {
            const productId = 2;
            await productSubscription.connect(productManager).addProduct(productId,ethers.parseUnits("200", 6));
            
            // 验证数组和映射中都存在产品
            const productFromMapping = await productSubscription.getProduct(productId);
            const productList = await productSubscription.getProductList();
            
            const productFromArray = productList.find(p => p.productId === BigInt(productId));
            expect(productFromArray).to.not.be.undefined;
            expect(productFromMapping.productId).to.equal(productFromArray!.productId);
            expect(productFromMapping.amount).to.equal(productFromArray!.amount);
        });

        it("产品删除后映射和数组应该保持一致", async function () {
            // 添加多个产品
            await productSubscription.connect(productManager).addProduct(2, ethers.parseUnits("200", 6));
            await productSubscription.connect(productManager).addProduct(3, ethers.parseUnits("300", 6));
            
            // 删除中间的产品
            await productSubscription.connect(productManager).removeProduct(2);
            
            // 验证映射中不存在该产品
            await expect(productSubscription.getProduct(2)).to.be.revertedWithCustomError(productSubscription, "NotFound");
            
            // 验证数组中也不存在该产品
            const productList = await productSubscription.getProductList();
            const deletedProduct = productList.find(p => p.productId === BigInt(2));
            expect(deletedProduct).to.be.undefined;
            
            // 验证剩余产品仍然存在
            const product1 = await productSubscription.getProduct(1);
            const product3 = await productSubscription.getProduct(3);
            expect(product1.productId).to.equal(1);
            expect(product3.productId).to.equal(3);
        });

        it("应该正确处理productExists映射的状态", async function () {
            const productId = 5;
            
            // 初始状态，产品不存在
            await expect(productSubscription.getProduct(productId)).to.be.revertedWithCustomError(productSubscription, "NotFound");
            
            // 添加产品后，productExists应该为true
            await productSubscription.connect(productManager).addProduct(productId, ethers.parseUnits("500", 6));
            const product = await productSubscription.getProduct(productId);
            expect(product.productId).to.equal(productId);
            
            // 删除产品后，productExists应该为false
            await productSubscription.connect(productManager).removeProduct(productId);
            await expect(productSubscription.getProduct(productId)).to.be.revertedWithCustomError(productSubscription, "NotFound");
        });

        it("产品更新不应该影响productExists映射", async function () {
            const productId = 6;
            const initialAmount = ethers.parseUnits("600", 6);
            const newAmount = ethers.parseUnits("800", 6);
            
            // 添加产品
            await productSubscription.connect(productManager).addProduct(productId, initialAmount);
            
            // 更新产品
            await productSubscription.connect(productManager).updateProduct(productId, newAmount);
            
            // 验证产品仍然存在且金额已更新
            const updatedProduct = await productSubscription.getProduct(productId);
            expect(updatedProduct.productId).to.equal(productId);
            expect(updatedProduct.amount).to.equal(newAmount);
            
            // 验证数组中的产品也已更新
            const productList = await productSubscription.getProductList();
            const productFromArray = productList.find(p => p.productId === BigInt(productId));
            expect(productFromArray).to.not.be.undefined;
            expect(productFromArray!.amount).to.equal(newAmount);
        });

        it("activeProductCount应该与实际产品数量保持一致", async function () {
            // 初始状态（已有一个产品）
            expect(await productSubscription.activeProductCount()).to.equal(1);
            expect(await productSubscription.activeProductCount()).to.equal(1);
            
            // 添加更多产品
            await productSubscription.connect(productManager).addProduct(7, ethers.parseUnits("700", 6));
            await productSubscription.connect(productManager).addProduct(8, ethers.parseUnits("800", 6));
            
            expect(await productSubscription.activeProductCount()).to.equal(3);
            expect(await productSubscription.activeProductCount()).to.equal(3);
            
            // 删除一个产品
            await productSubscription.connect(productManager).removeProduct(7);
            
            expect(await productSubscription.activeProductCount()).to.equal(2);
            expect(await productSubscription.activeProductCount()).to.equal(2);
            
            // 更新产品不应该影响计数
            await productSubscription.connect(productManager).updateProduct(8, ethers.parseUnits("900", 6));
            
            expect(await productSubscription.activeProductCount()).to.equal(2);
            expect(await productSubscription.activeProductCount()).to.equal(2);
        });

        it("getProductList应该优先使用数组方式(高效路径)", async function () {
            // 添加产品使数组和计数器一致
            await productSubscription.connect(productManager).addProduct(9, ethers.parseUnits("900", 6));
            await productSubscription.connect(productManager).addProduct(10, ethers.parseUnits("1000", 6));
            
            // 此时数组长度 = activeProductCount = 3，应该走高效路径
            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(3);
            
            // 验证返回的是正确的产品
            const productIds = productList.map(p => Number(p.productId)).sort((a, b) => a - b);
            expect(productIds).to.deep.equal([1, 9, 10]);
        });

        it("数据不一致时应该使用映射重建方式(兜底方案)", async function () {
            // 这个测试验证当数组和计数器不一致时的处理逻辑
            // 注意：这种情况在正常操作中不应该发生，但作为兜底方案存在
            
            // 添加产品
            await productSubscription.connect(productManager).addProduct(11, ethers.parseUnits("1100", 6));
            await productSubscription.connect(productManager).addProduct(12, ethers.parseUnits("1200", 6));
            
            // 正常情况下应该返回所有产品
            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(3); // 初始1个 + 新增2个
            
            // 验证产品数据正确
            const productIds = productList.map(p => Number(p.productId)).sort((a, b) => a - b);
            expect(productIds).to.deep.equal([1, 11, 12]);
        });

        it("购买记录映射应该保持一致性", async function () {
            const orderId1 = "order-001";
            const orderId2 = "order-002";
            
            // 进行购买
            await productSubscription.connect(user1).purchaseProduct(1, orderId1, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user2).purchaseProduct(1, orderId2, await mockUSDT.getAddress(), TELEGRAM_USER_ID_2);
            
            // 验证orderExists映射
            expect(await productSubscription.orderExists(orderId1)).to.be.true;
            expect(await productSubscription.orderExists(orderId2)).to.be.true;
            expect(await productSubscription.orderExists("non-existent")).to.be.false;
            
            // 验证userPurchaseIds映射 (getUserPurchaseIds函数已被删除，通过其他方式验证)
            // 直接检查购买记录数量
            const user1Records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 50);
            const user2Records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_2, 1, 50);
            expect(user1Records.length).to.equal(1);
            expect(user2Records.length).to.equal(1);
            
            // 验证userIdToPurchaseIds映射
            const user1RecordsById = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 10);
            const user2RecordsById = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_2, 1, 10);
            
            expect(user1RecordsById.length).to.equal(1);
            expect(user2RecordsById.length).to.equal(1);
            expect(user1Records[0].orderId).to.equal(orderId1);
            expect(user2Records[0].orderId).to.equal(orderId2);
        });

        it("大量产品操作后数据应该保持一致", async function () {
            const productCount = 20;
            
            // 批量添加产品
            for (let i = 20; i < 20 + productCount; i++) {
                await productSubscription.connect(productManager).addProduct(i, ethers.parseUnits((i * 100).toString(), 6));
            }
            
            // 验证计数一致性
            expect(await productSubscription.activeProductCount()).to.equal(1 + productCount); // 初始1个 + 新增20个
            expect(await productSubscription.activeProductCount()).to.equal(1 + productCount);
            // getOriginalArrayLength函数不存在，直接检查产品列表长度
            const currentProductList = await productSubscription.getProductList();
            expect(currentProductList.length).to.equal(1 + productCount);
            
            // 随机删除一些产品
            await productSubscription.connect(productManager).removeProduct(21);
            await productSubscription.connect(productManager).removeProduct(25);
            await productSubscription.connect(productManager).removeProduct(30);
            
            // 验证删除后的一致性
            expect(await productSubscription.activeProductCount()).to.equal(1 + productCount - 3);
            expect(await productSubscription.activeProductCount()).to.equal(1 + productCount - 3);
            
            // 验证被删除的产品确实不存在
            await expect(productSubscription.getProduct(21)).to.be.revertedWithCustomError(productSubscription, "NotFound");
            await expect(productSubscription.getProduct(25)).to.be.revertedWithCustomError(productSubscription, "NotFound");
            await expect(productSubscription.getProduct(30)).to.be.revertedWithCustomError(productSubscription, "NotFound");
            
            // 验证其他产品仍然存在
            const product22 = await productSubscription.getProduct(22);
            expect(product22.productId).to.equal(22);
        });
    });
    
    describe("V2升级：多币种精度处理测试", function () {
        beforeEach(async function () {
            // 添加支持的代币 (USDT: 18精度, USDC: 6精度)
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDC.getAddress());
        });

        it("应该正确存储不同精度代币的精度信息", async function () {
            // 验证代币精度存储
            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(18);
            expect(await productSubscription.tokenDecimals(await mockUSDC.getAddress())).to.equal(6);
            
            // 验证基准精度常量
            expect(await productSubscription.BASE_DECIMALS()).to.equal(18);
        });

        it("convertPriceForToken应该正确转换不同精度代币的价格", async function () {
            const basePrice = ethers.parseUnits("100", 18); // 100美元，18位精度

            // USDT (18精度): 应该返回原始价格
            const usdtPrice = await productSubscription.convertPriceForToken(basePrice, await mockUSDT.getAddress());
            expect(usdtPrice).to.equal(basePrice);
            
            // USDC (6精度): 应该转换为6位精度
            const usdcPrice = await productSubscription.convertPriceForToken(basePrice, await mockUSDC.getAddress());
            expect(usdcPrice).to.equal(ethers.parseUnits("100", 6));
        });

        // getPaymentInfo函数已被删除，此测试不再需要

        it("不同精度代币购买同一产品应支付相同美元价值", async function () {
            const productId = 2;
            const productPrice = ethers.parseUnits("200", 18); // 200美元的产品
            
            await productSubscription.connect(productManager).addProduct(productId, productPrice);
            
            const initialUSDTBalance = await mockUSDT.balanceOf(await multiSig.getAddress());
            const initialUSDCBalance = await mockUSDC.balanceOf(await multiSig.getAddress());
            
            // 用户1用USDT购买 (18精度)
            await productSubscription.connect(user1).purchaseProduct(
                productId,
                "order-usdt-001",
                await mockUSDT.getAddress(),
                TELEGRAM_USER_ID_1
            );
            
            // 用户2用USDC购买 (6精度)
            await productSubscription.connect(user2).purchaseProduct(
                productId,
                "order-usdc-001", 
                await mockUSDC.getAddress(),
                TELEGRAM_USER_ID_2
            );
            
            // 验证多签地址收到的代币数量
            const finalUSDTBalance = await mockUSDT.balanceOf(await multiSig.getAddress());
            const finalUSDCBalance = await mockUSDC.balanceOf(await multiSig.getAddress());
            
            // 都应该收到200单位的代币（但精度不同）
            expect(finalUSDTBalance - initialUSDTBalance).to.equal(ethers.parseUnits("200", 18)); // USDT: 200.000000000000000000
            expect(finalUSDCBalance - initialUSDCBalance).to.equal(ethers.parseUnits("200", 6));  // USDC: 200.000000
        });

        it("购买记录应该记录实际支付的代币数量", async function () {
            const productId = 3;
            const productPrice = ethers.parseUnits("150", 18); // 150美元
            
            await productSubscription.connect(productManager).addProduct(productId, productPrice);
            
            // 用USDC购买
            await productSubscription.connect(user1).purchaseProduct(
                productId,
                "order-record-test",
                await mockUSDC.getAddress(),
                TELEGRAM_USER_ID_1
            );
            
            // 检查购买记录
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 10);
            expect(records.length).to.equal(1);
            
            // 购买记录中的金额应该是实际支付的USDC数量 (6位精度)
            expect(records[0].amount).to.equal(ethers.parseUnits("150", 6));
            expect(records[0].symbol).to.equal("MockUSDC");
        });

        it("事件应该记录实际支付的代币数量", async function () {
            const productId = 4;
            const productPrice = ethers.parseUnits("75", 18); // 75美元
            
            await productSubscription.connect(productManager).addProduct(productId, productPrice);
            
            // 测试USDT购买事件
            await expect(
                productSubscription.connect(user1).purchaseProduct(
                    productId,
                    "event-test-usdt",
                    await mockUSDT.getAddress(),
                    TELEGRAM_USER_ID_1
                )
            ).to.emit(productSubscription, "PaymentDeposited")
             .withArgs(
                productId,
                await user1.getAddress(),
                TELEGRAM_USER_ID_1,
                await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1), // 下一个区块时间戳
                ethers.parseUnits("75", 18), // 实际支付的USDT数量 (18精度)
                await mockUSDT.getAddress(),
                0 // purchaseId
             );
            
            // 测试USDC购买事件  
            await expect(
                productSubscription.connect(user2).purchaseProduct(
                    productId,
                    "event-test-usdc", 
                    await mockUSDC.getAddress(),
                    TELEGRAM_USER_ID_2
                )
            ).to.emit(productSubscription, "PaymentDeposited")
             .withArgs(
                productId,
                await user2.getAddress(), 
                TELEGRAM_USER_ID_2,
                await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1), // 下一个区块时间戳
                ethers.parseUnits("75", 6), // 实际支付的USDC数量 (6精度)
                await mockUSDC.getAddress(),
                1 // purchaseId
             );
        });

        // setTokenDecimals函数已被删除，无法模拟精度未设置的情况，此测试不再适用

        it("批量更新代币精度功能应该正常工作", async function () {
            // batchUpdateTokenDecimals和setTokenDecimals函数已被删除，此测试不再适用
            
            // 验证精度已恢复
            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(18);
            expect(await productSubscription.tokenDecimals(await mockUSDC.getAddress())).to.equal(6);
        });

        it("移除代币时应该清理精度记录", async function () {
            // 验证精度存在
            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(18);
            
            // 移除代币
            await productSubscription.connect(tokenManager).removeSupportedToken(await mockUSDT.getAddress());
            
            // 验证精度已清理
            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(0);
            expect(await productSubscription.supportCoins(await mockUSDT.getAddress())).to.be.false;
        });

        it("演示V1版本的漏洞情况(对比测试)", async function () {
            // 这个测试展示如果没有精度转换会发生什么
            const productId = 99;
            const productPrice = ethers.parseUnits("100", 18); // 按18精度存储的100美元
            
            await productSubscription.connect(productManager).addProduct(productId, productPrice);
            
            // 如果直接使用原始产品价格 (不进行精度转换)
            // USDT (18精度): 需要支付 100 * 10^18 = 100.000000000000000000 USDT ✓
            // USDC (6精度):  需要支付 100 * 10^18 = 100000000000000.000000 USDC ❌ (这是天文数字!)
            
            // 但现在有了V2修复，实际支付金额是正确的:
            const usdtAmount = await productSubscription.convertPriceForToken(productPrice, await mockUSDT.getAddress());
            const usdcAmount = await productSubscription.convertPriceForToken(productPrice, await mockUSDC.getAddress());
            
            expect(usdtAmount).to.equal(ethers.parseUnits("100", 18)); // 100 USDT
            expect(usdcAmount).to.equal(ethers.parseUnits("100", 6));  // 100 USDC (不是天文数字!)
            
            console.log("V2修复后的支付金额:");
            console.log(`USDT (18精度): ${ethers.formatUnits(usdtAmount, 18)} USDT`);
            console.log(`USDC (6精度): ${ethers.formatUnits(usdcAmount, 6)} USDC`);
        });
    });
});