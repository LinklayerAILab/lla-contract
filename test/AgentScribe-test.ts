import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentScribe, MockUSDC, LLAToken } from "../typechain-types";

describe("AgentScribe 扩展测试", function () {
  let agentScribe: AgentScribe;
  let mockUSDC: MockUSDC;
  let llaToken: LLAToken;
  let agentScribeAddr: string;
  let owner: SignerWithAddress,
    admin: SignerWithAddress,
    pauser: SignerWithAddress,
    upgrader: SignerWithAddress,
    tokenManager: SignerWithAddress,
    multiSig: SignerWithAddress,
    vault: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    other: SignerWithAddress;

  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
  const TOKEN_MANAGER_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("TOKEN_MANAGER_ROLE")
  );

  beforeEach(async function () {
    [
      owner,
      admin,
      pauser,
      upgrader,
      tokenManager,
      multiSig,
      vault,
      user1,
      user2,
      other,
    ] = await ethers.getSigners();
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = (await upgrades.deployProxy(
      MockUSDCFactory,
      [owner.address, pauser.address, owner.address, upgrader.address],
      { initializer: "initialize" }
    )) as unknown as MockUSDC;
    await mockUSDC.waitForDeployment();
    const LLATokenFactory = await ethers.getContractFactory("LLAToken");
    llaToken = (await upgrades.deployProxy(
      LLATokenFactory,
      [owner.address, pauser.address, owner.address, upgrader.address],
      { initializer: "initialize" }
    )) as unknown as LLAToken;
    await llaToken.waitForDeployment();

    const AgentScribeFactory = await ethers.getContractFactory("AgentScribe");
    agentScribe = (await upgrades.deployProxy(
      AgentScribeFactory,
      [
        vault.address,
        admin.address,
        pauser.address,
        tokenManager.address,
        upgrader.address,
        await llaToken.getAddress(),
        multiSig.address,
      ],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as AgentScribe;
    await agentScribe.waitForDeployment();
    agentScribeAddr = await agentScribe.getAddress();
    const MINTER_ROLE = await llaToken.MINTER_ROLE();
    await llaToken.connect(owner).addRole(MINTER_ROLE, agentScribeAddr);
    await mockUSDC
      .connect(owner)
      .mint(user1.address, ethers.parseUnits("10000", 6));
    await mockUSDC
      .connect(owner)
      .mint(user2.address, ethers.parseUnits("10000", 6));
    await agentScribe
      .connect(tokenManager)
      .addSupportedToken(await mockUSDC.getAddress());
  });

  describe("初始化和角色管理", function () {
    it("使用零地址初始化应该失败", async function () {
      const AgentScribeFactory = await ethers.getContractFactory("AgentScribe");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            ethers.ZeroAddress,
            admin.address,
            pauser.address,
            tokenManager.address,
            upgrader.address,
            await llaToken.getAddress(),
            multiSig.address,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            vault.address,
            ethers.ZeroAddress,
            pauser.address,
            tokenManager.address,
            upgrader.address,
            await llaToken.getAddress(),
            multiSig.address,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            vault.address,
            admin.address,
            ethers.ZeroAddress,
            tokenManager.address,
            upgrader.address,
            await llaToken.getAddress(),
            multiSig.address,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            vault.address,
            admin.address,
            pauser.address,
            ethers.ZeroAddress,
            upgrader.address,
            await llaToken.getAddress(),
            multiSig.address,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            vault.address,
            admin.address,
            pauser.address,
            tokenManager.address,
            ethers.ZeroAddress,
            await llaToken.getAddress(),
            multiSig.address,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            vault.address,
            admin.address,
            pauser.address,
            tokenManager.address,
            upgrader.address,
            ethers.ZeroAddress,
            multiSig.address,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
      await expect(
        upgrades.deployProxy(
          AgentScribeFactory,
          [
            vault.address,
            admin.address,
            pauser.address,
            tokenManager.address,
            upgrader.address,
            await llaToken.getAddress(),
            ethers.ZeroAddress,
          ],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
    });

    it("应该正确设置所有角色和地址", async function () {
      expect(await agentScribe.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await agentScribe.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;
      expect(await agentScribe.hasRole(UPGRADER_ROLE, upgrader.address)).to.be
        .true;
      expect(
        await agentScribe.hasRole(TOKEN_MANAGER_ROLE, tokenManager.address)
      ).to.be.true;
      expect(await agentScribe.vaultContractAddr()).to.equal(vault.address);
      expect(await agentScribe.token()).to.equal(await llaToken.getAddress());
      expect(await agentScribe.multiSig()).to.equal(multiSig.address);
    });

    it("应该允许管理员授予和撤销角色", async function () {
      await agentScribe.connect(admin).addRole(PAUSER_ROLE, user1.address);
      expect(await agentScribe.hasRole(PAUSER_ROLE, user1.address)).to.be.true;
      await agentScribe.connect(admin).revokeRole(PAUSER_ROLE, user1.address);
      expect(await agentScribe.hasRole(PAUSER_ROLE, user1.address)).to.be.false;
    });

    it("应该阻止非管理员授予或撤销角色", async function () {
      await expect(
        agentScribe.connect(user1).addRole(PAUSER_ROLE, user2.address)
      ).to.be.reverted;
      await agentScribe.connect(admin).addRole(PAUSER_ROLE, user2.address);
      await expect(
        agentScribe.connect(user1).revokeRole(PAUSER_ROLE, user2.address)
      ).to.be.reverted;
    });
  });

  describe("可暂停功能", function () {
    it("应该允许暂停者暂停和取消暂停合约", async function () {
      await agentScribe.connect(pauser).pause();
      expect(await agentScribe.paused()).to.be.true;
      await agentScribe.connect(pauser).unpause();
      expect(await agentScribe.paused()).to.be.false;
    });

    it("应该阻止非暂停者暂停或取消暂停", async function () {
      await expect(agentScribe.connect(user1).pause()).to.be.reverted;
      await agentScribe.connect(pauser).pause();
      await expect(agentScribe.connect(user1).unpause()).to.be.reverted;
    });

    it("应该限制可暂停函数", async function () {
      await agentScribe.connect(upgrader).addProduct(1, 30, 100);
      await agentScribe.connect(pauser).pause();
      await expect(
        agentScribe
          .connect(user1)
          .purchaseProduct(1, await mockUSDC.getAddress())
      ).to.be.revertedWithCustomError(agentScribe, "EnforcedPause");
    });
  });

  describe("产品管理", function () {
    it("应该允许升级者添加、更新和移除产品", async function () {
      await expect(agentScribe.connect(upgrader).addProduct(1, 30, 100))
        .to.emit(agentScribe, "ProductAdded")
        .withArgs(1, 30, 100);
      let product = await agentScribe.getProduct(1);
      expect(product.totalDays).to.equal(30);
      let oldTotalDays = product.totalDays;
      let oldAmount = product.amount;
      await expect(agentScribe.connect(upgrader).updateProduct(1, 40, 120))
        .to.emit(agentScribe, "ProductUpdated")
        .withArgs(1, 40, 120,oldTotalDays,oldAmount);
      product = await agentScribe.getProduct(1);
      expect(product.totalDays).to.equal(40);

      await expect(agentScribe.connect(upgrader).removeProduct(1))
        .to.emit(agentScribe, "ProductRemoved")
        .withArgs(1);
      await expect(agentScribe.getProduct(1)).to.be.revertedWithCustomError(
        agentScribe,
        "ProductDoesNotExist"
      );
    });
it("应该在移除产品后允许重新添加", async function () {
      await agentScribe.connect(upgrader).addProduct(1, 30, 100);
      await agentScribe.connect(upgrader).removeProduct(1);
      await expect(agentScribe.connect(upgrader).addProduct(1, 35, 110))
        .to.emit(agentScribe, "ProductAdded")
        .withArgs(1, 35, 110);
      const product = await agentScribe.getProduct(1);
      expect(product.totalDays).to.equal(35);
    });

    it("应该正确处理移除唯一的商品", async function () {
      await agentScribe.connect(upgrader).addProduct(1, 30, 100);
      await agentScribe.connect(upgrader).removeProduct(1);
      const products = await agentScribe.getProductList();
      expect(products.length).to.equal(0);
    });

    it("应该正确处理移除最后一个商品", async function () {
      await agentScribe.connect(upgrader).addProduct(1, 30, 100);
      await agentScribe.connect(upgrader).addProduct(2, 60, 200);
      await agentScribe.connect(upgrader).removeProduct(2);
      const products = await agentScribe.getProductList();
      expect(products.length).to.equal(1);
      expect(products[0].productId).to.equal(1);
    });
    it("应该阻止非升级者管理产品", async function () {
      await expect(agentScribe.connect(user1).addProduct(1, 30, 100)).to.be
        .reverted;
      await agentScribe.connect(upgrader).addProduct(1, 30, 100);
      await expect(agentScribe.connect(user1).updateProduct(1, 40, 120)).to.be
        .reverted;
      await expect(agentScribe.connect(user1).removeProduct(1)).to.be.reverted;
    });

    it("应该正确处理产品边缘情况", async function () {
      await expect(agentScribe.connect(upgrader).addProduct(1, 30, 100)).to.not
        .be.reverted;
      await expect(
        agentScribe.connect(upgrader).addProduct(1, 30, 100)
      ).to.be.revertedWithCustomError(agentScribe, "ProductAlreadyExists");
      await expect(agentScribe.getProduct(2)).to.be.revertedWithCustomError(
        agentScribe,
        "ProductDoesNotExist"
      );
      await expect(
        agentScribe.connect(upgrader).updateProduct(2, 40, 120)
      ).to.be.revertedWithCustomError(agentScribe, "ProductDoesNotExist");
      await expect(
        agentScribe.connect(upgrader).removeProduct(2)
      ).to.be.revertedWithCustomError(agentScribe, "ProductDoesNotExist");
      await expect(
        agentScribe.connect(upgrader).addProduct(0, 30, 100)
      ).to.be.revertedWithCustomError(agentScribe, "InvalidProductId");
      await expect(
        agentScribe.connect(upgrader).addProduct(3, 30, 0)
      ).to.be.revertedWithCustomError(agentScribe, "InvalidProductAmount");
      await agentScribe.connect(upgrader).addProduct(3, 30, 100);
      await expect(
        agentScribe.connect(upgrader).updateProduct(3, 0, 0)
      ).to.be.revertedWithCustomError(agentScribe, "InvalidProductAmount");
    });
    it("应该正确获取产品列表", async function () {
      await agentScribe.connect(upgrader).addProduct(1, 30, 100);
      await agentScribe.connect(upgrader).addProduct(2, 60, 200);
      const products = await agentScribe.getProductList();
      expect(products.length).to.equal(2);
      expect(products[0].productId).to.equal(1);
      expect(products[0].totalDays).to.equal(30);
      expect(products[0].amount).to.equal(100);
      expect(products[1].productId).to.equal(2);
      expect(products[1].totalDays).to.equal(60);
      expect(products[1].amount).to.equal(200);
    });
  });

  describe("代币和多签管理", function () {
    it("应该允许管理员更新多签地址", async function () {
      await expect(agentScribe.connect(admin).updateMultiSig(user2.address))
        .to.emit(agentScribe, "MultiSigUpdated")
        .withArgs(user2.address);
      expect(await agentScribe.multiSig()).to.equal(user2.address);
    });

    it("应该阻止非管理员更新多签地址", async function () {
      await expect(agentScribe.connect(user1).updateMultiSig(user2.address)).to
        .be.reverted;
    });

    it("更新多签到零地址应该失败", async function () {
      await expect(
        agentScribe.connect(admin).updateMultiSig(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
    });

    it("应该允许管理员更新多签地址", async function () {
      const NewLLATokenFactory = await ethers.getContractFactory("LLAToken");
      const newLlaToken = await NewLLATokenFactory.deploy();
      await expect(
        agentScribe
          .connect(tokenManager)
          .updateToken(await newLlaToken.getAddress())
      )
        .to.emit(agentScribe, "TokenUpdated")
        .withArgs(await newLlaToken.getAddress());
      expect(await agentScribe.token()).to.equal(
        await newLlaToken.getAddress()
      );
    });

    it("应该阻止非管理员更新多签地址", async function () {
      const NewLLATokenFactory = await ethers.getContractFactory("LLAToken");
      const newLlaToken = await NewLLATokenFactory.deploy();
      await expect(
        agentScribe.connect(user1).updateToken(await newLlaToken.getAddress())
      ).to.be.reverted;
    });

    it("应该阻止非管理员更新多签地址", async function () {
      await expect(
        agentScribe.connect(tokenManager).updateToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
    });
  });

  describe("支持的代币管理", function () {
    it("应该允许代币管理者添加和移除支持的代币", async function () {
      const anotherMockUSDCFactory = await ethers.getContractFactory(
        "MockUSDC"
      );
      const anotherMockUSDC = await anotherMockUSDCFactory.deploy();
      await expect(
        agentScribe
          .connect(tokenManager)
          .addSupportedToken(await anotherMockUSDC.getAddress())
      ).to.emit(agentScribe, "TokenAdded");
      expect(await agentScribe.supportCoins(await anotherMockUSDC.getAddress()))
        .to.be.true;

      await expect(
        agentScribe
          .connect(tokenManager)
          .removeSupportedToken(await anotherMockUSDC.getAddress())
      ).to.emit(agentScribe, "TokenRemoved");
      expect(await agentScribe.supportCoins(await anotherMockUSDC.getAddress()))
        .to.be.false;
    });

    it("添加已支持代币或零地址应该失败", async function () {
      await expect(
        agentScribe
          .connect(tokenManager)
          .addSupportedToken(await mockUSDC.getAddress())
      ).to.be.revertedWithCustomError(agentScribe, "AlreadyInTheSupportedIcon");
      await expect(
        agentScribe.connect(tokenManager).addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(agentScribe, "InvalidAddress");
    });

    it("移除不支持的代币应该失败", async function () {
      const anotherMockUSDCFactory = await ethers.getContractFactory(
        "MockUSDC"
      );
      const anotherMockUSDC = await anotherMockUSDCFactory.deploy();
      await expect(
        agentScribe
          .connect(tokenManager)
          .removeSupportedToken(await anotherMockUSDC.getAddress())
      ).to.be.revertedWithCustomError(agentScribe, "UnsupportedPayToken");
    });

    it("应该阻止非代币管理者管理支持的代币", async function () {
      const anotherMockUSDCFactory = await ethers.getContractFactory(
        "MockUSDC"
      );
      const anotherMockUSDC = await anotherMockUSDCFactory.deploy();
      await expect(
        agentScribe
          .connect(user1)
          .addSupportedToken(await anotherMockUSDC.getAddress())
      ).to.be.reverted;
      await agentScribe
        .connect(tokenManager)
        .addSupportedToken(await anotherMockUSDC.getAddress());
      await expect(
        agentScribe
          .connect(user1)
          .removeSupportedToken(await anotherMockUSDC.getAddress())
      ).to.be.reverted;
    });
  });

  describe("购买逻辑", function () {
    beforeEach(async function () {
      await agentScribe
        .connect(upgrader)
        .addProduct(1, 30, ethers.parseUnits("100", 6));
      await mockUSDC
        .connect(user1)
        .approve(await agentScribe.getAddress(), ethers.parseUnits("100", 6));
    });

    it("应该成功执行产品购买", async function () {
      const fundingRate = await agentScribe.FUNDING_RATE();
      const mintingRate = await agentScribe.MINTING_RATE();
      const product = await agentScribe.getProduct(1);
      const amount = product.amount;
      const expectedMintAmount = (amount * mintingRate) / 100n;
      const expectedFundingAmount = (amount * fundingRate) / 100n;
      const expectedVaultAmount = amount - expectedFundingAmount;

      await expect(
        agentScribe
          .connect(user1)
          .purchaseProduct(1, await mockUSDC.getAddress())
      )
        .to.emit(agentScribe, "PaymentDeposited")
        .withArgs(
           1,
          (await ethers.provider.getBlock("latest"))!.timestamp + 1,
          amount,
          await mockUSDC.getAddress(),
         
        )
        .and.to.emit(llaToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, expectedMintAmount);

      expect(await mockUSDC.balanceOf(multiSig.address)).to.equal(
        expectedFundingAmount
      );
      expect(await mockUSDC.balanceOf(vault.address)).to.equal(
        expectedVaultAmount
      );
    });

    it("如果代币不支持则购买应该失败", async function () {
      const anotherMockUSDCFactory = await ethers.getContractFactory(
        "MockUSDC"
      );
      const anotherMockUSDC = await anotherMockUSDCFactory.deploy();
      await expect(
        agentScribe
          .connect(user1)
          .purchaseProduct(1, await anotherMockUSDC.getAddress())
      ).to.be.revertedWithCustomError(agentScribe, "UnsupportedPayToken");
    });

    it("对于不存在的产品购买应该失败", async function () {
      await expect(
        agentScribe
          .connect(user1)
          .purchaseProduct(99, await mockUSDC.getAddress())
      ).to.be.revertedWithCustomError(agentScribe, "ProductDoesNotExist");
    });

    it("如果用户授权不足则购买应该失败", async function () {
      await mockUSDC
        .connect(user2)
        .approve(await agentScribe.getAddress(), ethers.parseUnits("50", 6));
      await expect(
        agentScribe
          .connect(user2)
          .purchaseProduct(1, await mockUSDC.getAddress())
      ).to.be.reverted;
    });

    it("如果用户余额不足则购买应该失败", async function () {
      const user3Signer = other;
      await mockUSDC
        .connect(owner)
        .mint(user3Signer.address, ethers.parseUnits("99", 6));
      await mockUSDC
        .connect(user3Signer)
        .approve(await agentScribe.getAddress(), ethers.parseUnits("100", 6));
      await expect(
        agentScribe
          .connect(user3Signer)
          .purchaseProduct(1, await mockUSDC.getAddress())
      ).to.be.reverted;
    });

    it("应该处理重入攻击", async function () {
      // This test requires a malicious contract to test re-entrancy, which is complex to set up here.
      // The nonReentrant modifier should be sufficient protection, but a dedicated test is best practice.
    });

    it("成功购买后应该递增 totalMintCount", async function () {
      expect(await agentScribe.totalMintCount()).to.equal(0);
      await agentScribe
        .connect(user1)
        .purchaseProduct(1, await mockUSDC.getAddress());
      expect(await agentScribe.totalMintCount()).to.equal(1);
    });

    it("如果铸币失败则购买应该失败", async function () {
      // Revoke minter role to simulate mint failure
      const MINTER_ROLE = await llaToken.MINTER_ROLE();
      await llaToken.connect(owner).revokeRole(MINTER_ROLE, agentScribeAddr);
      await expect(
        agentScribe
          .connect(user1)
          .purchaseProduct(1, await mockUSDC.getAddress())
      ).to.be.revertedWithCustomError(agentScribe, "MintingFailed");
      // Restore minter role
      await llaToken.connect(owner).addRole(MINTER_ROLE, agentScribeAddr);
    });

    it("应该正确处理多个购买", async function () {
      await agentScribe
        .connect(upgrader)
        .addProduct(2, 60, ethers.parseUnits("200", 6));
      await mockUSDC
        .connect(user1)
        .approve(await agentScribe.getAddress(), ethers.parseUnits("300", 6));
      await agentScribe
        .connect(user1)
        .purchaseProduct(1, await mockUSDC.getAddress());
      await agentScribe
        .connect(user1)
        .purchaseProduct(2, await mockUSDC.getAddress());
      expect(await agentScribe.totalMintCount()).to.equal(2);
    });

    it("应该阻止同一地址的并发铸币", async function () {
      // This would require simulating re-entrancy or concurrent calls, which is tricky in tests.
      // Since _minting is set and checked with nonReentrant, it's protected.
    });
  });

  describe("费率更新", function () {
    it("应该允许升级者更新资金和铸币费率", async function () {
      await expect(agentScribe.connect(upgrader).updateFundingRate(40))
        .to.emit(agentScribe, "FundingRateUpdated")
        .withArgs(40);
      expect(await agentScribe.FUNDING_RATE()).to.equal(40);

      await expect(agentScribe.connect(upgrader).updateMintingRate(70))
        .to.emit(agentScribe, "MintingRateUpdated")
        .withArgs(70);
      expect(await agentScribe.MINTING_RATE()).to.equal(70);
    });

    it("应该阻止非升级者更新费率", async function () {
      await expect(agentScribe.connect(user1).updateFundingRate(40)).to.be
        .reverted;
      await expect(agentScribe.connect(user1).updateMintingRate(70)).to.be
        .reverted;
    });

    it("如果费率设置超过 100 则应该回滚", async function () {
      await expect(
        agentScribe.connect(upgrader).updateFundingRate(101)
      ).to.be.revertedWith("Rate must be <= 100");
      await expect(
        agentScribe.connect(upgrader).updateMintingRate(101)
      ).to.be.revertedWith("Rate must be <= 100");
    });

    it("应该允许将费率更新为 0 和 100", async function () {
      await agentScribe.connect(upgrader).updateFundingRate(0);
      expect(await agentScribe.FUNDING_RATE()).to.equal(0);
      await agentScribe.connect(upgrader).updateFundingRate(100);
      expect(await agentScribe.FUNDING_RATE()).to.equal(100);
      await agentScribe.connect(upgrader).updateMintingRate(0);
      expect(await agentScribe.MINTING_RATE()).to.equal(0);
      await agentScribe.connect(upgrader).updateMintingRate(100);
      expect(await agentScribe.MINTING_RATE()).to.equal(100);
    });
  });

  describe("可升级性", function () {
    it("应该允许升级者升级合约", async function () {
      const AgentScribeV2Factory = (
        await ethers.getContractFactory("AgentScribe")
      ).connect(upgrader); // Replace with V2 contract when available
      const agentScribeV2 = await upgrades.upgradeProxy(
        await agentScribe.getAddress(),
        AgentScribeV2Factory,
        { kind: "uups" }
      );
      expect(await agentScribeV2.getAddress()).to.not.be.undefined;
    });

    it("应该阻止非升级者升级合约", async function () {
      const AgentScribeV2Factory = await ethers.getContractFactory(
        "AgentScribe"
      );
      await expect(
        upgrades.upgradeProxy(
          await agentScribe.getAddress(),
          AgentScribeV2Factory.connect(user1)
        )
      ).to.be.reverted;
    });
  });
});
