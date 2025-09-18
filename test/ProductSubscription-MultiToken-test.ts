import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { ProductSubscription, ERC20Mock } from "../typechain-types";

describe("ProductSubscription V2 - Multi-Token Decimal Fix", function () {
    let productSubscription: ProductSubscription;
    let mockUSDT: ERC20Mock;  // 6 decimals
    let mockUSDC: ERC20Mock;  // 6 decimals  
    let mockDAI: ERC20Mock;   // 18 decimals
    let mockWBTC: ERC20Mock;  // 8 decimals
    let admin: Signer;
    let tokenManager: Signer;
    let productManager: Signer;
    let multiSig: Signer;
    let user1: Signer;
    let user2: Signer;

    const TELEGRAM_USER_ID_1 = "6543877705";
    const TELEGRAM_USER_ID_2 = "1234567890";

    beforeEach(async function () {
        [admin, , tokenManager, , productManager, multiSig, user1, user2] = 
            await ethers.getSigners();

        // 部署不同精度的 Mock ERC20 代币
        const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
        mockUSDT = await ERC20MockFactory.deploy("Mock USDT", "USDT", 6);   // 6 decimals
        mockUSDC = await ERC20MockFactory.deploy("Mock USDC", "USDC", 6);   // 6 decimals
        mockDAI = await ERC20MockFactory.deploy("Mock DAI", "DAI", 18);     // 18 decimals
        mockWBTC = await ERC20MockFactory.deploy("Mock WBTC", "WBTC", 8);   // 8 decimals
        
        await Promise.all([
            mockUSDT.waitForDeployment(),
            mockUSDC.waitForDeployment(),
            mockDAI.waitForDeployment(),
            mockWBTC.waitForDeployment()
        ]);

        // 部署 ProductSubscription V2 合约
        const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription");
        productSubscription = await upgrades.deployProxy(
            ProductSubscriptionFactory,
            [
                await admin.getAddress(),
                await admin.getAddress(), // pauser
                await tokenManager.getAddress(),
                await admin.getAddress(), // upgrader
                await productManager.getAddress(),
                await multiSig.getAddress()
            ],
            { initializer: "initialize" }
        ) as ProductSubscription;

        await productSubscription.waitForDeployment();

        // 为测试用户铸造足够的代币
        const mintAmount6 = ethers.parseUnits("100000", 6);   // 100,000 tokens (6 decimals)
        const mintAmount18 = ethers.parseUnits("100000", 18); // 100,000 tokens (18 decimals)  
        const mintAmount8 = ethers.parseUnits("100000", 8);   // 100,000 tokens (8 decimals)

        await Promise.all([
            mockUSDT.mint(await user1.getAddress(), mintAmount6),
            mockUSDT.mint(await user2.getAddress(), mintAmount6),
            mockUSDC.mint(await user1.getAddress(), mintAmount6),
            mockUSDC.mint(await user2.getAddress(), mintAmount6),
            mockDAI.mint(await user1.getAddress(), mintAmount18),
            mockDAI.mint(await user2.getAddress(), mintAmount18),
            mockWBTC.mint(await user1.getAddress(), mintAmount8),
            mockWBTC.mint(await user2.getAddress(), mintAmount8)
        ]);

        // 授权合约使用用户代币
        await Promise.all([
            mockUSDT.connect(user1).approve(await productSubscription.getAddress(), mintAmount6),
            mockUSDT.connect(user2).approve(await productSubscription.getAddress(), mintAmount6),
            mockUSDC.connect(user1).approve(await productSubscription.getAddress(), mintAmount6),
            mockUSDC.connect(user2).approve(await productSubscription.getAddress(), mintAmount6),
            mockDAI.connect(user1).approve(await productSubscription.getAddress(), mintAmount18),
            mockDAI.connect(user2).approve(await productSubscription.getAddress(), mintAmount18),
            mockWBTC.connect(user1).approve(await productSubscription.getAddress(), mintAmount8),
            mockWBTC.connect(user2).approve(await productSubscription.getAddress(), mintAmount8)
        ]);
    });

    describe("V2升级：代币精度处理", function () {
        it("应该正确存储代币精度信息", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockDAI.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockWBTC.getAddress());

            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(6);
            expect(await productSubscription.tokenDecimals(await mockDAI.getAddress())).to.equal(18);
            expect(await productSubscription.tokenDecimals(await mockWBTC.getAddress())).to.equal(8);
        });

        it("应该拒绝超过18位精度的代币", async function () {
            // 创建一个超过18位精度的代币
            const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
            const invalidToken = await ERC20MockFactory.deploy("Invalid Token", "INVALID", 19);
            await invalidToken.waitForDeployment();

            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await invalidToken.getAddress())
            ).to.be.revertedWith("Unsupported decimals");
        });

        it("应该拒绝无法获取精度的代币", async function () {
            // 使用一个不是ERC20的地址（比如合约本身）
            await expect(
                productSubscription.connect(tokenManager).addSupportedToken(await productSubscription.getAddress())
            ).to.be.revertedWithCustomError(productSubscription, "Invalid");
        });
    });

    describe("V2升级：精度转换功能", function () {
        beforeEach(async function () {
            // 添加支持的代币
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockDAI.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockWBTC.getAddress());
            
            // 添加一个100美元的产品（以18位精度存储）
            const productPrice = ethers.parseUnits("100", 18);
            await productSubscription.connect(productManager).addProduct(1, productPrice);
        });

        it("convertPriceForToken应该正确转换不同精度", async function () {
            const baseAmount = ethers.parseUnits("100", 18); // 100美元，18位精度

            // USDT (6位精度): 应该返回 100 * 10^6
            const usdtAmount = await productSubscription.convertPriceForToken(baseAmount, await mockUSDT.getAddress());
            expect(usdtAmount).to.equal(ethers.parseUnits("100", 6));

            // DAI (18位精度): 应该返回原始金额
            const daiAmount = await productSubscription.convertPriceForToken(baseAmount, await mockDAI.getAddress());
            expect(daiAmount).to.equal(baseAmount);

            // WBTC (8位精度): 应该返回 100 * 10^8
            const wbtcAmount = await productSubscription.convertPriceForToken(baseAmount, await mockWBTC.getAddress());
            expect(wbtcAmount).to.equal(ethers.parseUnits("100", 8));
        });

        // getPaymentInfo函数已被删除，此测试不再需要
    });

    describe("V2升级：购买功能精度修复", function () {
        beforeEach(async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockDAI.getAddress());
            await productSubscription.connect(tokenManager).addSupportedToken(await mockWBTC.getAddress());
            
            // 添加一个100美元的产品
            const productPrice = ethers.parseUnits("100", 18);
            await productSubscription.connect(productManager).addProduct(1, productPrice);
        });

        it("用不同精度代币购买同一产品应支付相同价值", async function () {
            const initialMultiSigBalance = await mockUSDT.balanceOf(await multiSig.getAddress());
            
            // 用USDT购买
            await productSubscription.connect(user1).purchaseProduct(
                1, 
                "order-usdt", 
                await mockUSDT.getAddress(), 
                TELEGRAM_USER_ID_1
            );
            
            // 用DAI购买  
            await productSubscription.connect(user2).purchaseProduct(
                1, 
                "order-dai", 
                await mockDAI.getAddress(), 
                TELEGRAM_USER_ID_2
            );

            // 检查多签地址收到的代币数量
            const finalUSDTBalance = await mockUSDT.balanceOf(await multiSig.getAddress());
            const finalDAIBalance = await mockDAI.balanceOf(await multiSig.getAddress());

            // 应该都收到100单位的代币（不同精度）
            expect(finalUSDTBalance - initialMultiSigBalance).to.equal(ethers.parseUnits("100", 6));
            expect(finalDAIBalance).to.equal(ethers.parseUnits("100", 18));
        });

        it("购买记录应该记录实际支付的代币数量", async function () {
            await productSubscription.connect(user1).purchaseProduct(
                1, 
                "order-test", 
                await mockUSDT.getAddress(), 
                TELEGRAM_USER_ID_1
            );

            const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 10);
            expect(records.length).to.equal(1);
            
            // 购买记录中的金额应该是实际支付的USDT数量（6位精度）
            expect(records[0].amount).to.equal(ethers.parseUnits("100", 6));
        });

        it("事件应该记录实际支付的代币数量", async function () {
            const tx = await productSubscription.connect(user1).purchaseProduct(
                1, 
                "order-event", 
                await mockWBTC.getAddress(), 
                TELEGRAM_USER_ID_1
            );

            await expect(tx)
                .to.emit(productSubscription, "PaymentDeposited")
                .withArgs(
                    1, // productId
                    await user1.getAddress(), // buyer
                    TELEGRAM_USER_ID_1, // userId
                    await ethers.provider.getBlock('latest').then(b => b!.timestamp), // timestamp
                    ethers.parseUnits("100", 8), // 实际支付的WBTC数量 (8位精度)
                    await mockWBTC.getAddress(), // payToken
                    0 // purchaseId
                );
        });
    });

    describe("V2升级：管理功能", function () {
        // batchUpdateTokenDecimals函数已被删除，此测试不再需要

        // setTokenDecimals函数已被删除，此测试不再需要

        it("移除代币时应该清理精度记录", async function () {
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(6);
            
            await productSubscription.connect(tokenManager).removeSupportedToken(await mockUSDT.getAddress());
            expect(await productSubscription.tokenDecimals(await mockUSDT.getAddress())).to.equal(0);
        });
    });

    describe("V2升级：边界情况和错误处理", function () {
        it("convertPriceForToken应该拒绝不支持的代币", async function () {
            const baseAmount = ethers.parseUnits("100", 18);
            
            await expect(
                productSubscription.convertPriceForToken(baseAmount, await mockUSDT.getAddress())
            ).to.be.revertedWith("Token not supported or decimals not set");
        });

        it("购买时应该拒绝精度未设置的代币", async function () {
            // 先支持代币但不设置精度
            await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
            // setTokenDecimals函数已被删除
            
            await productSubscription.connect(productManager).addProduct(1, ethers.parseUnits("100", 18));
            
            await expect(
                productSubscription.connect(user1).purchaseProduct(
                    1, 
                    "order-fail", 
                    await mockUSDT.getAddress(), 
                    TELEGRAM_USER_ID_1
                )
            ).to.be.revertedWith("Token not supported or decimals not set");
        });
    });
});