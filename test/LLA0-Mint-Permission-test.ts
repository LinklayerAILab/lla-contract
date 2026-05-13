import { expect } from "chai";
import { LLA0 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLA0 Token - Mint Permission Control (Enhanced)", function () {
  let LLA0Factory: ContractFactory;
  let lla0: LLA0;
  let defaultAdmin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let newMinter: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseEther("625000000"); // 6.25亿枚

  before(async function () {
    [defaultAdmin, pauser, minter, user1, user2, user3, newMinter] = await ethers.getSigners();

    console.log("\n=== Enhanced Mint Permission Test Accounts ===");
    console.log("Default Admin:", defaultAdmin.address);
    console.log("Pauser:", pauser.address);
    console.log("Minter:", minter.address);
    console.log("New Minter:", newMinter.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
    console.log("User3:", user3.address);
  });

  beforeEach(async function () {
    LLA0Factory = await ethers.getContractFactory("LLA0");
    lla0 = (await LLA0Factory.deploy(
      defaultAdmin.address,
      pauser.address,
      minter.address
    )) as LLA0;
    await lla0.waitForDeployment();
  });

  // ============================================
  // 1. 基础权限测试
  // ============================================
  describe("1. Basic Permission Tests", function () {
    it("1.1 Should ONLY allow MINTER_ROLE to mint", async function () {
      const mintAmount = ethers.parseEther("1000");

      // MINTER 可以铸造
      await expect(lla0.connect(minter).mint(user1.address, mintAmount))
        .to.emit(lla0, "Minted")
        .withArgs(minter.address, user1.address, mintAmount);

      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("1.2 Should NOT allow DEFAULT_ADMIN to mint without MINTER_ROLE", async function () {
      const mintAmount = ethers.parseEther("1000");
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      // 验证 defaultAdmin 没有 MINTER_ROLE
      expect(await lla0.hasRole(MINTER_ROLE, defaultAdmin.address)).to.be.false;

      // defaultAdmin 不能铸造
      await expect(
        lla0.connect(defaultAdmin).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(defaultAdmin.address, MINTER_ROLE);
    });

    it("1.3 Should NOT allow PAUSER to mint without MINTER_ROLE", async function () {
      const mintAmount = ethers.parseEther("1000");
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      // 验证 pauser 没有 MINTER_ROLE
      expect(await lla0.hasRole(MINTER_ROLE, pauser.address)).to.be.false;

      // pauser 不能铸造
      await expect(
        lla0.connect(pauser).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(pauser.address, MINTER_ROLE);
    });

    it("1.4 Should NOT allow regular users to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await expect(
        lla0.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MINTER_ROLE);
    });

    it("1.5 Should allow MINTER to mint to themselves", async function () {
      const mintAmount = ethers.parseEther("1000");

      await lla0.connect(minter).mint(minter.address, mintAmount);
      expect(await lla0.balanceOf(minter.address)).to.equal(mintAmount);
    });
  });

  // ============================================
  // 2. 多 MINTER 管理测试
  // ============================================
  describe("2. Multiple Minters Management", function () {
    it("2.1 Should allow DEFAULT_ADMIN to grant MINTER_ROLE to multiple addresses", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      // 授予 user1 和 user2 MINTER_ROLE
      await expect(lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address))
        .to.emit(lla0, "RoleGranted")
        .withArgs(MINTER_ROLE, user1.address, defaultAdmin.address);

      await expect(lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user2.address))
        .to.emit(lla0, "RoleGranted")
        .withArgs(MINTER_ROLE, user2.address, defaultAdmin.address);

      expect(await lla0.hasRole(MINTER_ROLE, user1.address)).to.be.true;
      expect(await lla0.hasRole(MINTER_ROLE, user2.address)).to.be.true;
    });

    it("2.2 Should allow multiple MINTERs to mint independently", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // 授予多个 MINTER 角色
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address);
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user2.address);

      // 原始 minter 铸造
      await lla0.connect(minter).mint(user3.address, mintAmount);

      // user1 作为 minter 铸造
      await lla0.connect(user1).mint(user3.address, mintAmount);

      // user2 作为 minter 铸造
      await lla0.connect(user2).mint(user3.address, mintAmount);

      expect(await lla0.balanceOf(user3.address)).to.equal(mintAmount * 3n);
      expect(await lla0.totalSupply()).to.equal(mintAmount * 3n);
    });

    it("2.3 Should allow multiple MINTERs to mint up to MAX_SUPPLY collectively", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      // 授予 user1 MINTER 角色
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address);

      const halfSupply = MAX_SUPPLY / 2n;

      // 原始 minter 铸造一半
      await lla0.connect(minter).mint(user2.address, halfSupply);

      // user1 作为 minter 铸造另一半
      await lla0.connect(user1).mint(user3.address, halfSupply);

      expect(await lla0.totalSupply()).to.equal(MAX_SUPPLY);

      // 任何 minter 都不能再铸造
      await expect(
        lla0.connect(minter).mint(user2.address, 1)
      ).to.be.revertedWith("LLA0: exceeds max supply");

      await expect(
        lla0.connect(user1).mint(user3.address, 1)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });
  });

  // ============================================
  // 3. 角色撤销和转移测试
  // ============================================
  describe("3. Role Revocation and Transfer", function () {
    it("3.1 Should prevent minting after MINTER_ROLE is revoked", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // 验证 minter 初始可以铸造
      await lla0.connect(minter).mint(user1.address, mintAmount);
      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);

      // 撤销 MINTER_ROLE
      await expect(lla0.connect(defaultAdmin).revokeRole(MINTER_ROLE, minter.address))
        .to.emit(lla0, "RoleRevoked")
        .withArgs(MINTER_ROLE, minter.address, defaultAdmin.address);

      expect(await lla0.hasRole(MINTER_ROLE, minter.address)).to.be.false;

      // 撤销后无法铸造
      await expect(
        lla0.connect(minter).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(minter.address, MINTER_ROLE);
    });

    it("3.2 Should allow minting after MINTER_ROLE is re-granted", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // 撤销角色
      await lla0.connect(defaultAdmin).revokeRole(MINTER_ROLE, minter.address);

      // 重新授予角色
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, minter.address);
      expect(await lla0.hasRole(MINTER_ROLE, minter.address)).to.be.true;

      // 可以再次铸造
      await lla0.connect(minter).mint(user1.address, mintAmount);
      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("3.3 Should allow MINTER to renounce their own role", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // minter 放弃自己的角色
      await expect(lla0.connect(minter).renounceRole(MINTER_ROLE, minter.address))
        .to.emit(lla0, "RoleRevoked")
        .withArgs(MINTER_ROLE, minter.address, minter.address);

      expect(await lla0.hasRole(MINTER_ROLE, minter.address)).to.be.false;

      // 放弃后无法铸造
      await expect(
        lla0.connect(minter).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount");
    });

    it("3.4 Should transfer minting responsibility by revoking and granting", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // 原始 minter 铸造
      await lla0.connect(minter).mint(user1.address, mintAmount);

      // 撤销原 minter，授予新 minter
      await lla0.connect(defaultAdmin).revokeRole(MINTER_ROLE, minter.address);
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, newMinter.address);

      // 原 minter 无法铸造
      await expect(
        lla0.connect(minter).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount");

      // 新 minter 可以铸造
      await lla0.connect(newMinter).mint(user2.address, mintAmount);
      expect(await lla0.balanceOf(user2.address)).to.equal(mintAmount);
    });
  });

  // ============================================
  // 4. 与其他角色交互测试
  // ============================================
  describe("4. Interaction with Other Roles", function () {
    it("4.1 Should NOT allow paused contract to mint (even for MINTER)", async function () {
      const mintAmount = ethers.parseEther("1000");

      // 暂停合约
      await lla0.connect(pauser).pause();

      // MINTER 也无法在暂停状态下铸造
      await expect(
        lla0.connect(minter).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "EnforcedPause");
    });

    it("4.2 Should allow minting after contract is unpaused", async function () {
      const mintAmount = ethers.parseEther("1000");

      // 暂停再恢复
      await lla0.connect(pauser).pause();
      await lla0.connect(pauser).unpause();

      // 恢复后可以铸造
      await lla0.connect(minter).mint(user1.address, mintAmount);
      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("4.3 Should allow DEFAULT_ADMIN to mint if granted MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // 授予 defaultAdmin MINTER_ROLE
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, defaultAdmin.address);

      // 现在 defaultAdmin 可以铸造
      await lla0.connect(defaultAdmin).mint(user1.address, mintAmount);
      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("4.4 Should allow PAUSER to mint if granted MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // 授予 pauser MINTER_ROLE
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, pauser.address);

      // 现在 pauser 可以铸造
      await lla0.connect(pauser).mint(user1.address, mintAmount);
      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("4.5 Should allow one address to have multiple roles and mint", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const PAUSER_ROLE = await lla0.PAUSER_ROLE();
      const mintAmount = ethers.parseEther("1000");

      // user1 同时拥有 MINTER 和 PAUSER 角色
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address);
      await lla0.connect(defaultAdmin).grantRole(PAUSER_ROLE, user1.address);

      expect(await lla0.hasRole(MINTER_ROLE, user1.address)).to.be.true;
      expect(await lla0.hasRole(PAUSER_ROLE, user1.address)).to.be.true;

      // user1 可以铸造
      await lla0.connect(user1).mint(user2.address, mintAmount);

      // user1 也可以暂停
      await lla0.connect(user1).pause();
      expect(await lla0.paused()).to.be.true;
    });
  });

  // ============================================
  // 5. 边界和安全测试
  // ============================================
  describe("5. Edge Cases and Security", function () {
    it("5.1 Should enforce MAX_SUPPLY limit even with MINTER_ROLE", async function () {
      const exceedAmount = MAX_SUPPLY + ethers.parseEther("1");

      await expect(
        lla0.connect(minter).mint(user1.address, exceedAmount)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });

    it("5.2 Should prevent minting even 1 wei over MAX_SUPPLY", async function () {
      // 铸造到上限
      await lla0.connect(minter).mint(user1.address, MAX_SUPPLY);

      // 即使是 1 wei 也不能超过
      await expect(
        lla0.connect(minter).mint(user2.address, 1)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });

    it("5.3 Should prevent MINTER from minting to zero address", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        lla0.connect(minter).mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("LLA0: mint to zero address");
    });

    it("5.4 Should prevent MINTER from minting zero amount", async function () {
      await expect(
        lla0.connect(minter).mint(user1.address, 0)
      ).to.be.revertedWith("LLA0: amount is zero");
    });

    it("5.5 Should allow re-minting after burn within MAX_SUPPLY", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const mintAmount = ethers.parseEther("10000000");
      const burnAmount = ethers.parseEther("5000000");

      // 铸造
      await lla0.connect(minter).mint(user1.address, mintAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount);

      // 销毁
      await lla0.connect(user1).burn(burnAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount - burnAmount);

      // 可以重新铸造销毁的量
      await lla0.connect(minter).mint(user2.address, burnAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount);
    });

    it("5.6 Should track minting across multiple MINTERs correctly", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      // 授予多个 minter
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address);
      await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user2.address);

      const amount1 = ethers.parseEther("100000000"); // 1亿
      const amount2 = ethers.parseEther("200000000"); // 2亿
      const amount3 = ethers.parseEther("300000000"); // 3亿

      // 三个 minter 分别铸造
      await lla0.connect(minter).mint(user3.address, amount1);
      await lla0.connect(user1).mint(user3.address, amount2);
      await lla0.connect(user2).mint(user3.address, amount3);

      const totalMinted = amount1 + amount2 + amount3;
      expect(await lla0.totalSupply()).to.equal(totalMinted);
      expect(await lla0.balanceOf(user3.address)).to.equal(totalMinted);

      // 验证还可以铸造剩余的
      const remaining = MAX_SUPPLY - totalMinted;
      await lla0.connect(minter).mint(user3.address, remaining);
      expect(await lla0.totalSupply()).to.equal(MAX_SUPPLY);

      // 任何 minter 都不能再铸造
      await expect(
        lla0.connect(minter).mint(user3.address, 1)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });
  });

  // ============================================
  // 6. 权限事件测试
  // ============================================
  describe("6. Permission Events", function () {
    it("6.1 Should emit RoleGranted when granting MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await expect(lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address))
        .to.emit(lla0, "RoleGranted")
        .withArgs(MINTER_ROLE, user1.address, defaultAdmin.address);
    });

    it("6.2 Should emit RoleRevoked when revoking MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await expect(lla0.connect(defaultAdmin).revokeRole(MINTER_ROLE, minter.address))
        .to.emit(lla0, "RoleRevoked")
        .withArgs(MINTER_ROLE, minter.address, defaultAdmin.address);
    });

    it("6.3 Should emit Minted and Transfer events on successful mint", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(lla0.connect(minter).mint(user1.address, mintAmount))
        .to.emit(lla0, "Minted")
        .withArgs(minter.address, user1.address, mintAmount)
        .and.to.emit(lla0, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, mintAmount);
    });
  });

  // ============================================
  // 7. 非授权操作尝试测试
  // ============================================
  describe("7. Unauthorized Operation Attempts", function () {
    it("7.1 Should prevent non-admin from granting MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();

      // user1 不是 admin
      await expect(
        lla0.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });

    it("7.2 Should prevent non-admin from revoking MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();

      await expect(
        lla0.connect(user1).revokeRole(MINTER_ROLE, minter.address)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });

    it("7.3 Should prevent MINTER from granting MINTER_ROLE to others", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();

      // MINTER 不是 admin，不能授予角色
      await expect(
        lla0.connect(minter).grantRole(MINTER_ROLE, user1.address)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(minter.address, DEFAULT_ADMIN_ROLE);
    });

    it("7.4 Should prevent user from renouncing MINTER_ROLE for another address", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      // user1 尝试放弃 minter 的角色（应该失败）
      await expect(
        lla0.connect(user1).renounceRole(MINTER_ROLE, minter.address)
      ).to.be.revertedWithCustomError(lla0, "AccessControlBadConfirmation");
    });
  });

  // ============================================
  // 8. Gas 优化测试
  // ============================================
  describe("8. Gas Usage for Mint Operations", function () {
    it("8.1 Should report gas usage for single mint", async function () {
      const mintAmount = ethers.parseEther("1000000");
      const tx = await lla0.connect(minter).mint(user1.address, mintAmount);
      const receipt = await tx.wait();
      console.log("    Gas used for single mint:", receipt?.gasUsed.toString());
    });

    it("8.2 Should report gas usage for mint to MAX_SUPPLY", async function () {
      const tx = await lla0.connect(minter).mint(user1.address, MAX_SUPPLY);
      const receipt = await tx.wait();
      console.log("    Gas used for mint to MAX_SUPPLY:", receipt?.gasUsed.toString());
    });

    it("8.3 Should report gas usage for granting MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const tx = await lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address);
      const receipt = await tx.wait();
      console.log("    Gas used for granting MINTER_ROLE:", receipt?.gasUsed.toString());
    });

    it("8.4 Should report gas usage for revoking MINTER_ROLE", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const tx = await lla0.connect(defaultAdmin).revokeRole(MINTER_ROLE, minter.address);
      const receipt = await tx.wait();
      console.log("    Gas used for revoking MINTER_ROLE:", receipt?.gasUsed.toString());
    });
  });
});
