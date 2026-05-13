import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { ProductSubscription, MockUSDT } from "../typechain-types";

describe("合约升级兼容性测试", function () {
    let productSubscription: ProductSubscription;
    let mockUSDT: MockUSDT;
    let admin: Signer;
    let pauser: Signer;
    let tokenManager: Signer;
    let upgrader: Signer;
    let productManager: Signer;
    let multiSig: Signer;
    let user1: Signer;

    beforeEach(async function () {
        [admin, pauser, tokenManager, upgrader, productManager, multiSig, user1] =
            await ethers.getSigners();

        // 部署 Mock 代币
        const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDTFactory.deploy(await admin.getAddress());
        await mockUSDT.waitForDeployment();

        // 部署初始版本的合约
        const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription");
        productSubscription = await upgrades.deployProxy(
            ProductSubscriptionFactory,
            [
                await admin.getAddress(),
                await pauser.getAddress(),
                await tokenManager.getAddress(),
                await upgrader.getAddress(),
                await productManager.getAddress(),
                await multiSig.getAddress()
            ],
            { initializer: "initialize" }
        ) as ProductSubscription;

        await productSubscription.waitForDeployment();

        // 初始化数据
        await productSubscription.connect(tokenManager).addSupportedToken(await mockUSDT.getAddress());
        await productSubscription.connect(productManager).addProduct(1, ethers.parseUnits("100", 18));

        // 给用户铸造代币
        const mintAmount = ethers.parseUnits("10000", 18);
        await mockUSDT.mint(await user1.getAddress(), mintAmount);
        await mockUSDT.connect(user1).approve(await productSubscription.getAddress(), mintAmount);
    });

    describe("存储布局兼容性", function () {
        it("升级后应该保留所有旧数据", async function () {
            // 记录升级前的状态
            const multiSigBefore = await productSubscription.multiSig();
            const productBefore = await productSubscription.getProduct(1);
            const tokenSupportedBefore = await productSubscription.supportCoins(await mockUSDT.getAddress());
            const tokenDecimalsBefore = await productSubscription.tokenDecimals(await mockUSDT.getAddress());

            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            );

            // 验证数据未丢失
            expect(await upgraded.multiSig()).to.equal(multiSigBefore);

            const productAfter = await upgraded.getProduct(1);
            expect(productAfter.productId).to.equal(productBefore.productId);
            expect(productAfter.amount).to.equal(productBefore.amount);

            expect(await upgraded.supportCoins(await mockUSDT.getAddress())).to.equal(tokenSupportedBefore);
            expect(await upgraded.tokenDecimals(await mockUSDT.getAddress())).to.equal(tokenDecimalsBefore);
        });

        it("升级后应该保留角色权限", async function () {
            const ADMIN_ROLE = await productSubscription.ADMIN_ROLE();
            const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
            const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();

            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            ) as ProductSubscription;

            // 验证角色权限未变
            expect(await upgraded.hasRole(ADMIN_ROLE, await admin.getAddress())).to.be.true;
            expect(await upgraded.hasRole(TOKEN_MANAGER_ROLE, await tokenManager.getAddress())).to.be.true;
            expect(await upgraded.hasRole(PRODUCT_MANAGER_ROLE, await productManager.getAddress())).to.be.true;
        });

        it("升级后应该保留购买记录", async function () {
            // 升级前创建购买记录
            await productSubscription.connect(user1).purchaseProduct(
                1,
                "order-before-upgrade",
                await mockUSDT.getAddress()
            );

            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            ) as ProductSubscription;

            // 验证购买记录存在
            const records = await upgraded.getPurchaseRecordsByAddress(await user1.getAddress(), 1, 10);
            expect(records.length).to.equal(1);
            expect(records[0].orderId).to.equal("order-before-upgrade");
        });
    });

    describe("新功能验证", function () {
        it("升级后应该有紧急提取功能", async function () {
            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            ) as ProductSubscription;

            // 验证新函数存在且可用
            const mistakeAmount = ethers.parseUnits("100", 18);
            await mockUSDT.mint(await upgraded.getAddress(), mistakeAmount);

            await expect(
                upgraded.connect(admin).emergencyWithdraw(
                    await mockUSDT.getAddress(),
                    mistakeAmount
                )
            ).to.emit(upgraded, "EmergencyWithdraw");
        });

        it("升级后精度转换应该向上取整", async function () {
            // 部署 USDC (6位精度)
            const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
            const mockUSDC = await MockUSDCFactory.deploy(await admin.getAddress());
            await mockUSDC.waitForDeployment();

            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            ) as ProductSubscription;

            // 添加 USDC 支持
            await upgraded.connect(tokenManager).addSupportedToken(await mockUSDC.getAddress());

            // 测试精度转换 (应该向上取整)
            const price = ethers.parseUnits("100", 18) + 1000000n; // 100.000000000001
            const converted = await upgraded.convertPriceForToken(price, await mockUSDC.getAddress());

            // 应该向上取整到 100.000001 USDC
            expect(converted).to.be.gt(ethers.parseUnits("100", 6));
        });
    });

    describe("业务连续性", function () {
        it("升级前后购买功能应该正常工作", async function () {
            // 升级前购买
            await productSubscription.connect(user1).purchaseProduct(
                1,
                "order-before",
                await mockUSDT.getAddress()
            );

            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            ) as ProductSubscription;

            // 升级后购买
            await upgraded.connect(user1).purchaseProduct(
                1,
                "order-after",
                await mockUSDT.getAddress()
            );

            // 验证两次购买都成功
            const records = await upgraded.getPurchaseRecordsByAddress(await user1.getAddress(), 1, 10);
            expect(records.length).to.equal(2);
            expect(records[0].orderId).to.equal("order-before");
            expect(records[1].orderId).to.equal("order-after");
        });

        it("升级时暂停应该阻止操作", async function () {
            // 暂停合约
            await productSubscription.connect(pauser).pause();

            // 执行升级
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2
            ) as ProductSubscription;

            // 暂停状态应该保留
            expect(await upgraded.paused()).to.be.true;

            // 尝试购买应该失败
            await expect(
                upgraded.connect(user1).purchaseProduct(
                    1,
                    "order-while-paused",
                    await mockUSDT.getAddress()
                )
            ).to.be.revertedWithCustomError(upgraded, "EnforcedPause");

            // 恢复后应该正常
            await upgraded.connect(pauser).unpause();
            await upgraded.connect(user1).purchaseProduct(
                1,
                "order-after-unpause",
                await mockUSDT.getAddress()
            );
        });
    });

    describe("升级安全性", function () {
        it("只有授权角色可以升级合约", async function () {
            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const newImplementation = await ProductSubscriptionV2.deploy();

            // 非管理员尝试升级应该失败
            await expect(
                productSubscription.connect(user1).upgradeToAndCall(
                    await newImplementation.getAddress(),
                    "0x"
                )
            ).to.be.reverted;
        });

        it("升级后 __gap 空间应该保持完整", async function () {
            // 这个测试主要验证 __gap 的存在性
            // 实际项目中应该使用 hardhat-storage-layout 插件验证

            const ProductSubscriptionV2 = await ethers.getContractFactory("ProductSubscription");
            const upgraded = await upgrades.upgradeProxy(
                await productSubscription.getAddress(),
                ProductSubscriptionV2,
                {
                    kind: 'uups',
                    // 验证存储布局兼容性
                    unsafeAllow: []
                }
            );

            expect(await upgraded.getAddress()).to.equal(await productSubscription.getAddress());
        });
    });
});
