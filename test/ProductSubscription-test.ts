import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { ProductSubscription, ERC20Mock } from "../typechain-types";

describe("ProductSubscription", function () {
    let productSubscription: ProductSubscription;
    let mockUSDT: ERC20Mock;
    let mockUSDC: ERC20Mock;
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

        // 部署 Mock ERC20 代币
        const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
        mockUSDT = await ERC20MockFactory.deploy("Mock USDT", "USDT", 6);
        mockUSDC = await ERC20MockFactory.deploy("Mock USDC", "USDC", 6);
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
                await multiSig.getAddress()
            ],
            { initializer: "initialize" }
        ) as ProductSubscription;

        await productSubscription.waitForDeployment();

        // 为测试用户铸造代币
        const mintAmount = ethers.parseUnits("10000", 6); // 10,000 tokens
        await mockUSDT.mint(await user1.getAddress(), mintAmount);
        await mockUSDT.mint(await user2.getAddress(), mintAmount);
        await mockUSDC.mint(await user1.getAddress(), mintAmount);
        await mockUSDC.mint(await user2.getAddress(), mintAmount);

        // 授权合约使用用户代币
        await mockUSDT.connect(user1).approve(await productSubscription.getAddress(), mintAmount);
        await mockUSDT.connect(user2).approve(await productSubscription.getAddress(), mintAmount);
        await mockUSDC.connect(user1).approve(await productSubscription.getAddress(), mintAmount);
        await mockUSDC.connect(user2).approve(await productSubscription.getAddress(), mintAmount);

        // 设置产品管理员角色
        const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
        await productSubscription.connect(admin).addRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress());
    });

    describe("初始化测试", function () {
        it("应该正确初始化合约", async function () {
            expect(await productSubscription.multiSig()).to.equal(await multiSig.getAddress());
            expect(await productSubscription.version()).to.equal("v1.0");
            
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
                    await multiSig.getAddress()
                ],
                { initializer: "initialize" }
            )).to.be.revertedWithCustomError(productSubscription, "InvalidAddress");
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
            const totalDays = 30;
            const amount = ethers.parseUnits("100", 6);

            await expect(
                productSubscription.connect(productManager).addProduct(productId, totalDays, amount)
            ).to.emit(productSubscription, "ProductAdded")
             .withArgs(productId, totalDays, amount);

            const product = await productSubscription.getProduct(productId);
            expect(product.productId).to.equal(productId);
            expect(product.totalDays).to.equal(totalDays);
            expect(product.amount).to.equal(amount);
        });

        it("应该拒绝无效的商品ID", async function () {
            await expect(
                productSubscription.connect(productManager).addProduct(0, 30, ethers.parseUnits("100", 6))
            ).to.be.revertedWithCustomError(productSubscription, "InvalidProductId");
        });

        it("应该拒绝无效的商品金额", async function () {
            await expect(
                productSubscription.connect(productManager).addProduct(1, 30, 0)
            ).to.be.revertedWithCustomError(productSubscription, "InvalidProductAmount");
        });

        it("应该拒绝重复的商品ID", async function () {
            const productId = 1;
            await productSubscription.connect(productManager).addProduct(productId, 30, ethers.parseUnits("100", 6));
            
            await expect(
                productSubscription.connect(productManager).addProduct(productId, 60, ethers.parseUnits("200", 6))
            ).to.be.revertedWithCustomError(productSubscription, "ProductAlreadyExists");
        });

        it("应该成功更新商品", async function () {
            const productId = 1;
            await productSubscription.connect(productManager).addProduct(productId, 30, ethers.parseUnits("100", 6));
            
            const newTotalDays = 60;
            const newAmount = ethers.parseUnits("200", 6);
            
            await expect(
                productSubscription.connect(productManager).updateProduct(productId, newTotalDays, newAmount)
            ).to.emit(productSubscription, "ProductUpdated")
             .withArgs(productId, newTotalDays, newAmount, 30, ethers.parseUnits("100", 6));

            const product = await productSubscription.getProduct(productId);
            expect(product.totalDays).to.equal(newTotalDays);
            expect(product.amount).to.equal(newAmount);
        });

        it("应该成功删除商品", async function () {
            const productId = 1;
            await productSubscription.connect(productManager).addProduct(productId, 30, ethers.parseUnits("100", 6));
            
            await expect(
                productSubscription.connect(productManager).removeProduct(productId)
            ).to.emit(productSubscription, "ProductRemoved")
             .withArgs(productId);

            await expect(
                productSubscription.getProduct(productId)
            ).to.be.revertedWithCustomError(productSubscription, "ProductDoesNotExist");
        });

        it("应该正确处理商品列表查询", async function () {
            // 添加多个商品
            for (let i = 1; i <= 5; i++) {
                await productSubscription.connect(productManager).addProduct(i, 30 * i, ethers.parseUnits((100 * i).toString(), 6));
            }

            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(5);

            const productCount = await productSubscription.getProductCount();
            expect(productCount).to.equal(5);

            // 测试分页查询
            const paginatedList = await productSubscription.getProductListPaginated(1, 3);
            expect(paginatedList.length).to.equal(3);
            expect(paginatedList[0].productId).to.equal(2);
        });

        it("应该限制getProductList的返回数量", async function () {
            // 添加超过100个商品来测试DOS防护
            // 注意：在实际测试中可能需要调整gas限制
            for (let i = 1; i <= 105; i++) {
                await productSubscription.connect(productManager).addProduct(i, 30, ethers.parseUnits("100", 6));
            }

            const productList = await productSubscription.getProductList();
            expect(productList.length).to.equal(100); // 应该被限制为100个
        });
    });

    describe("购买功能测试", function () {
        const productId = 1;
        const productAmount = ethers.parseUnits("100", 6);

        beforeEach(async function () {
            // 添加支持的代币和商品
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(productId, 30, productAmount);
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
            

            // 检查购买记录
            expect(await productSubscription.hasUserPurchased(await user1.getAddress(), productId)).to.be.true;
            expect(await productSubscription.getUserPurchaseCount(await user1.getAddress())).to.equal(1);
        });

        it("应该拒绝不存在的商品", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(999, "12345", await mockUSDT.getAddress(), TELEGRAM_USER_ID_1)
            ).to.be.revertedWithCustomError(productSubscription, "ProductDoesNotExist");
        });

        it("应该拒绝不支持的代币", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDC.getAddress(), TELEGRAM_USER_ID_1)
            ).to.be.revertedWithCustomError(productSubscription, "UnsupportedPayToken");
        });

        it("应该拒绝无效的Telegram userId", async function () {
            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDT.getAddress(), INVALID_USER_ID)
            ).to.be.revertedWithCustomError(productSubscription, "InvalidUserId");

            await expect(
                productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDT.getAddress(), EMPTY_USER_ID)
            ).to.be.revertedWithCustomError(productSubscription, "InvalidUserId");
        });

        // it("应该拒绝重复购买", async function () {
        //     await productSubscription.connect(user1).purchaseProduct(productId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            
        //     await expect(
        //         productSubscription.connect(user1).purchaseProduct(productId, await mockUSDT.getAddress(), TELEGRAM_USER_ID_1)
        //     ).to.be.revertedWithCustomError(productSubscription, "ProductAlreadyPurchased");
        // });

        it("应该正确处理多用户购买同一商品", async function () {
            await productSubscription.connect(user1).purchaseProduct(productId, "12345", await mockUSDT.getAddress(), TELEGRAM_USER_ID_1);
            await productSubscription.connect(user2).purchaseProduct(productId, "67890", await mockUSDT.getAddress(), TELEGRAM_USER_ID_2);

            expect(await productSubscription.hasUserPurchased(await user1.getAddress(), productId)).to.be.true;
            expect(await productSubscription.hasUserPurchased(await user2.getAddress(), productId)).to.be.true;
            expect(await productSubscription.getPurchaseRecordCount()).to.equal(2);
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
            expect(record1.symbol).to.equal("USDT");
            
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
    });

    describe("代币管理测试", function () {
        it("应该成功添加支持的代币", async function () {
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.emit(productSubscription, "TokenAdded")
             .withArgs(await mockUSDT.getAddress(), "USDT");

            expect(await productSubscription.supportCoins(await mockUSDT.getAddress())).to.be.true;
        });

        it("应该拒绝添加重复的代币", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "AlreadyInTheSupportedIcon");
        });

        it("应该成功移除支持的代币", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            
            await expect(
                productSubscription.connect(tokenManager).removeSupportedToken(await mockUSDT.getAddress())
            ).to.emit(productSubscription, "TokenRemoved")
             .withArgs(await mockUSDT.getAddress(), "USDT");

            expect(await productSubscription.supportCoins(await mockUSDT.getAddress())).to.be.false;
        });

        it("应该拒绝移除不支持的代币", async function () {
            await expect(
                productSubscription.connect(tokenManager).removeSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "UnsupportedPayToken");
        });
    });

    describe("角色权限测试", function () {
        it("应该正确管理角色", async function () {
            const TEST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TEST_ROLE"));
            
            await productSubscription.connect(admin).addRole(TEST_ROLE, await user1.getAddress());
            expect(await productSubscription.hasRole(TEST_ROLE, await user1.getAddress())).to.be.true;

            await productSubscription.connect(admin).revokeRole(TEST_ROLE, await user1.getAddress());
            expect(await productSubscription.hasRole(TEST_ROLE, await user1.getAddress())).to.be.false;
        });

        it("应该拒绝非管理员的角色操作", async function () {
            const TEST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TEST_ROLE"));
            
            await expect(
                productSubscription.connect(user1).addRole(TEST_ROLE, await user2.getAddress())
            ).to.be.reverted;
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
            ).to.be.reverted;
        });
    });

    describe("暂停和升级测试", function () {
        it("应该成功暂停和恢复合约", async function () {
            await productSubscription.connect(pauser).pause();
            expect(await productSubscription.paused()).to.be.true;

            // 暂停时应该无法调用状态变更函数
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "EnforcedPause()");

            await productSubscription.connect(pauser).unpause();
            expect(await productSubscription.paused()).to.be.false;

            // 恢复后应该可以正常调用
            await expect(productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress()))
                .to.emit(productSubscription, "TokenAdded");
        });

        it("应该拒绝非pauser角色的暂停操作", async function () {
            await expect(
                productSubscription.connect(user1).pause()
            ).to.be.reverted;
        });
    });

    describe("边界条件和错误处理测试", function () {

        it("应该正确处理空的购买记录查询", async function () {
            const records = await productSubscription.getPurchaseRecordsByTelegramUserId("9999999999",1,10);
            expect(records.length).to.equal(0);
        });

        it("应该正确处理分页查询边界情况", async function () {
            // 查询超出范围的分页
            const emptyResult = await productSubscription.getProductListPaginated(1000, 10);
            expect(emptyResult.length).to.equal(0);
        });

        it("应该正确处理用户没有购买记录的情况", async function () {
            expect(await productSubscription.getUserPurchaseCount(await user1.getAddress())).to.equal(0);
            expect(await productSubscription.hasUserPurchased(await user1.getAddress(), 1)).to.be.false;
            
            const userPurchaseIds = await productSubscription.getUserPurchaseIds(await user1.getAddress());
            expect(userPurchaseIds.length).to.equal(0);
        });
    });

    describe("事件测试", function () {
        beforeEach(async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(productManager).addProduct(1, 30, ethers.parseUnits("100", 6));
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
});