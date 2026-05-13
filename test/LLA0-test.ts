import { expect } from "chai";
import { LLA0 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLA0 Token", function () {
  let LLA0Factory: ContractFactory;
  let lla0: LLA0;
  let defaultAdmin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseEther("625000000"); // 6.25亿枚

  before(async function () {
    // 获取测试账户
    [defaultAdmin, pauser, minter, user1, user2, user3] = await ethers.getSigners();

    console.log("=== Test Accounts ===");
    console.log("Default Admin:", defaultAdmin.address);
    console.log("Pauser:", pauser.address);
    console.log("Minter:", minter.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
    console.log("User3:", user3.address);
  });

  beforeEach(async function () {
    // 每个测试前重新部署合约
    LLA0Factory = await ethers.getContractFactory("LLA0");
    lla0 = (await LLA0Factory.deploy(
      defaultAdmin.address,
      pauser.address,
      minter.address
    )) as LLA0;
    await lla0.waitForDeployment();

    const contractAddress = await lla0.getAddress();
    console.log("LLA0 deployed at:", contractAddress);
  });

  // ============================================
  // 1. 部署和初始化测试
  // ============================================
  describe("Deployment and Initialization", function () {
    it("Should set the correct token name and symbol", async function () {
      expect(await lla0.name()).to.equal("LLA0");
      expect(await lla0.symbol()).to.equal("LA0");
    });

    it("Should set the correct decimals", async function () {
      expect(await lla0.decimals()).to.equal(18);
    });

    it("Should set the correct MAX_SUPPLY", async function () {
      expect(await lla0.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("Should have zero initial supply", async function () {
      expect(await lla0.totalSupply()).to.equal(0);
    });

    it("Should assign roles correctly", async function () {
      const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();
      const PAUSER_ROLE = await lla0.PAUSER_ROLE();
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      expect(await lla0.hasRole(DEFAULT_ADMIN_ROLE, defaultAdmin.address)).to.be.true;
      expect(await lla0.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;
      expect(await lla0.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should support AccessControl interface", async function () {
      // IAccessControl interface ID: 0x7965db0b
      const interfaceId = "0x7965db0b";
      expect(await lla0.supportsInterface(interfaceId)).to.be.true;
    });

    it("Should revert when deploying with zero address for admin", async function () {
      await expect(
        LLA0Factory.deploy(ethers.ZeroAddress, pauser.address, minter.address)
      ).to.be.revertedWith("LLA0: admin is zero address");
    });

    it("Should revert when deploying with zero address for pauser", async function () {
      await expect(
        LLA0Factory.deploy(defaultAdmin.address, ethers.ZeroAddress, minter.address)
      ).to.be.revertedWith("LLA0: pauser is zero address");
    });

    it("Should revert when deploying with zero address for minter", async function () {
      await expect(
        LLA0Factory.deploy(defaultAdmin.address, pauser.address, ethers.ZeroAddress)
      ).to.be.revertedWith("LLA0: minter is zero address");
    });
  });

  // ============================================
  // 2. Mint 功能测试
  // ============================================
  describe("Mint Functionality", function () {
    it("Should allow MINTER_ROLE to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(lla0.connect(minter).mint(user1.address, mintAmount))
        .to.emit(lla0, "Minted")
        .withArgs(minter.address, user1.address, mintAmount)
        .and.to.emit(lla0, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, mintAmount);

      expect(await lla0.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount);
    });

    it("Should not allow non-MINTER to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await expect(
        lla0.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MINTER_ROLE);
    });

    it("Should revert when minting to zero address", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        lla0.connect(minter).mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("LLA0: mint to zero address");
    });

    it("Should revert when minting zero amount", async function () {
      await expect(
        lla0.connect(minter).mint(user1.address, 0)
      ).to.be.revertedWith("LLA0: amount is zero");
    });

    it("Should revert when minting exceeds MAX_SUPPLY", async function () {
      const exceedAmount = MAX_SUPPLY + ethers.parseEther("1");

      await expect(
        lla0.connect(minter).mint(user1.address, exceedAmount)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });

    it("Should allow minting up to MAX_SUPPLY", async function () {
      await lla0.connect(minter).mint(user1.address, MAX_SUPPLY);
      expect(await lla0.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("Should revert when total minted exceeds MAX_SUPPLY across multiple mints", async function () {
      const halfSupply = MAX_SUPPLY / 2n;

      // 第一次铸造一半
      await lla0.connect(minter).mint(user1.address, halfSupply);

      // 第二次铸造一半
      await lla0.connect(minter).mint(user2.address, halfSupply);

      // 第三次应该失败
      await expect(
        lla0.connect(minter).mint(user3.address, 1)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });

    it("Should allow minting after burning (re-minting within MAX_SUPPLY)", async function () {
      const mintAmount = ethers.parseEther("1000000");

      // 铸造
      await lla0.connect(minter).mint(user1.address, mintAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount);

      // 用户销毁
      const burnAmount = ethers.parseEther("500000");
      await lla0.connect(user1).burn(burnAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount - burnAmount);

      // 可以重新铸造已销毁的数量
      await lla0.connect(minter).mint(user2.address, burnAmount);
      expect(await lla0.totalSupply()).to.equal(mintAmount);
    });
  });

  // ============================================
  // 3. Burn 功能测试
  // ============================================
  describe("Burn Functionality", function () {
    beforeEach(async function () {
      // 给 user1 铸造一些代币
      const mintAmount = ethers.parseEther("10000");
      await lla0.connect(minter).mint(user1.address, mintAmount);
    });

    it("Should allow users to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      const initialBalance = await lla0.balanceOf(user1.address);

      await expect(lla0.connect(user1).burn(burnAmount))
        .to.emit(lla0, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);

      expect(await lla0.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await lla0.totalSupply()).to.equal(initialBalance - burnAmount);
    });

    it("Should revert when burning zero amount", async function () {
      await expect(
        lla0.connect(user1).burn(0)
      ).to.be.revertedWith("LLA0: amount is zero");
    });

    it("Should revert when burning more than balance", async function () {
      const balance = await lla0.balanceOf(user1.address);
      const exceedAmount = balance + ethers.parseEther("1");

      await expect(
        lla0.connect(user1).burn(exceedAmount)
      ).to.be.revertedWithCustomError(lla0, "ERC20InsufficientBalance");
    });

    it("Should allow burning entire balance", async function () {
      const balance = await lla0.balanceOf(user1.address);

      await lla0.connect(user1).burn(balance);
      expect(await lla0.balanceOf(user1.address)).to.equal(0);
      expect(await lla0.totalSupply()).to.equal(0);
    });
  });

  // ============================================
  // 4. Pause 功能测试
  // ============================================
  describe("Pause Functionality", function () {
    beforeEach(async function () {
      // 给用户铸造代币用于转账测试
      await lla0.connect(minter).mint(user1.address, ethers.parseEther("10000"));
    });

    it("Should allow PAUSER_ROLE to pause the contract", async function () {
      await expect(lla0.connect(pauser).pause())
        .to.emit(lla0, "Paused")
        .withArgs(pauser.address);

      expect(await lla0.paused()).to.be.true;
    });

    it("Should allow PAUSER_ROLE to unpause the contract", async function () {
      await lla0.connect(pauser).pause();

      await expect(lla0.connect(pauser).unpause())
        .to.emit(lla0, "Unpaused")
        .withArgs(pauser.address);

      expect(await lla0.paused()).to.be.false;
    });

    it("Should not allow non-PAUSER to pause", async function () {
      const PAUSER_ROLE = await lla0.PAUSER_ROLE();

      await expect(
        lla0.connect(user1).pause()
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, PAUSER_ROLE);
    });

    it("Should prevent transfers when paused", async function () {
      await lla0.connect(pauser).pause();

      await expect(
        lla0.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(lla0, "EnforcedPause");
    });

    it("Should prevent minting when paused", async function () {
      await lla0.connect(pauser).pause();

      await expect(
        lla0.connect(minter).mint(user2.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(lla0, "EnforcedPause");
    });

    it("Should prevent burning when paused", async function () {
      await lla0.connect(pauser).pause();

      await expect(
        lla0.connect(user1).burn(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(lla0, "EnforcedPause");
    });

    it("Should allow transfers after unpausing", async function () {
      await lla0.connect(pauser).pause();
      await lla0.connect(pauser).unpause();

      const transferAmount = ethers.parseEther("100");
      await expect(lla0.connect(user1).transfer(user2.address, transferAmount))
        .to.emit(lla0, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);
    });
  });

  // ============================================
  // 5. 角色管理测试
  // ============================================
  describe("Role Management", function () {
    it("Should allow DEFAULT_ADMIN to grant roles", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await expect(lla0.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address))
        .to.emit(lla0, "RoleGranted")
        .withArgs(MINTER_ROLE, user1.address, defaultAdmin.address);

      expect(await lla0.hasRole(MINTER_ROLE, user1.address)).to.be.true;

      // user1 现在可以铸造代币
      await lla0.connect(user1).mint(user2.address, ethers.parseEther("1000"));
    });

    it("Should allow DEFAULT_ADMIN to revoke roles", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await lla0.connect(defaultAdmin).revokeRole(MINTER_ROLE, minter.address);
      expect(await lla0.hasRole(MINTER_ROLE, minter.address)).to.be.false;

      // minter 不能再铸造
      await expect(
        lla0.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount");
    });

    it("Should allow users to renounce their own roles", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();

      await lla0.connect(minter).renounceRole(MINTER_ROLE, minter.address);
      expect(await lla0.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("Should not allow non-admin to grant roles", async function () {
      const MINTER_ROLE = await lla0.MINTER_ROLE();
      const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();

      await expect(
        lla0.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(lla0, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });
  });

  // ============================================
  // 6. ERC20 标准功能测试
  // ============================================
  describe("ERC20 Standard Functionality", function () {
    beforeEach(async function () {
      await lla0.connect(minter).mint(user1.address, ethers.parseEther("10000"));
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(lla0.connect(user1).transfer(user2.address, transferAmount))
        .to.emit(lla0, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);

      expect(await lla0.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should approve and transferFrom", async function () {
      const approveAmount = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("200");

      // user1 授权 user2
      await expect(lla0.connect(user1).approve(user2.address, approveAmount))
        .to.emit(lla0, "Approval")
        .withArgs(user1.address, user2.address, approveAmount);

      expect(await lla0.allowance(user1.address, user2.address)).to.equal(approveAmount);

      // user2 从 user1 转账到 user3
      await expect(
        lla0.connect(user2).transferFrom(user1.address, user3.address, transferAmount)
      ).to.emit(lla0, "Transfer")
        .withArgs(user1.address, user3.address, transferAmount);

      expect(await lla0.balanceOf(user3.address)).to.equal(transferAmount);
      expect(await lla0.allowance(user1.address, user2.address)).to.equal(
        approveAmount - transferAmount
      );
    });

    it("Should revert when transferring more than balance", async function () {
      const balance = await lla0.balanceOf(user1.address);
      const exceedAmount = balance + ethers.parseEther("1");

      await expect(
        lla0.connect(user1).transfer(user2.address, exceedAmount)
      ).to.be.revertedWithCustomError(lla0, "ERC20InsufficientBalance");
    });

    it("Should revert when transferring without sufficient allowance", async function () {
      const approveAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("200");

      await lla0.connect(user1).approve(user2.address, approveAmount);

      await expect(
        lla0.connect(user2).transferFrom(user1.address, user3.address, transferAmount)
      ).to.be.revertedWithCustomError(lla0, "ERC20InsufficientAllowance");
    });
  });

  // ============================================
  // 7. EIP-2612 Permit 功能测试
  // ============================================
  describe("EIP-2612 Permit Functionality", function () {
    it("Should have correct domain separator", async function () {
      const domainSeparator = await lla0.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.not.equal(ethers.ZeroHash);
    });

    it("Should have correct initial nonce", async function () {
      expect(await lla0.nonces(user1.address)).to.equal(0);
    });

    // Note: 完整的 permit 签名测试需要更复杂的设置
    // 这里只测试基础功能，实际签名测试可以在集成测试中完成
  });

  // ============================================
  // 8. 边界条件和安全测试
  // ============================================
  describe("Edge Cases and Security", function () {
    it("Should handle multiple users minting and burning", async function () {
      const amount1 = ethers.parseEther("1000000");
      const amount2 = ethers.parseEther("2000000");
      const amount3 = ethers.parseEther("3000000");

      await lla0.connect(minter).mint(user1.address, amount1);
      await lla0.connect(minter).mint(user2.address, amount2);
      await lla0.connect(minter).mint(user3.address, amount3);

      expect(await lla0.totalSupply()).to.equal(amount1 + amount2 + amount3);

      await lla0.connect(user1).burn(amount1 / 2n);
      await lla0.connect(user2).burn(amount2 / 2n);

      const expectedSupply = amount1 + amount2 + amount3 - amount1 / 2n - amount2 / 2n;
      expect(await lla0.totalSupply()).to.equal(expectedSupply);
    });

    it("Should correctly track totalSupply through complex operations", async function () {
      const initialMint = ethers.parseEther("10000000");
      await lla0.connect(minter).mint(user1.address, initialMint);
      expect(await lla0.totalSupply()).to.equal(initialMint);

      // 转账不影响总供应量
      await lla0.connect(user1).transfer(user2.address, ethers.parseEther("1000000"));
      expect(await lla0.totalSupply()).to.equal(initialMint);

      // 销毁减少总供应量
      const burnAmount = ethers.parseEther("500000");
      await lla0.connect(user2).burn(burnAmount);
      expect(await lla0.totalSupply()).to.equal(initialMint - burnAmount);

      // 再次铸造增加总供应量
      const additionalMint = ethers.parseEther("2000000");
      await lla0.connect(minter).mint(user3.address, additionalMint);
      expect(await lla0.totalSupply()).to.equal(initialMint - burnAmount + additionalMint);
    });

    it("Should not overflow when approaching MAX_SUPPLY", async function () {
      // 铸造接近上限
      const almostMax = MAX_SUPPLY - ethers.parseEther("100");
      await lla0.connect(minter).mint(user1.address, almostMax);

      // 可以铸造剩余的
      await lla0.connect(minter).mint(user2.address, ethers.parseEther("100"));
      expect(await lla0.totalSupply()).to.equal(MAX_SUPPLY);

      // 即使是 1 wei 也不能超过
      await expect(
        lla0.connect(minter).mint(user3.address, 1)
      ).to.be.revertedWith("LLA0: exceeds max supply");
    });
  });

  // ============================================
  // 9. 事件测试
  // ============================================
  describe("Events", function () {
    it("Should emit Minted event with correct parameters", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(lla0.connect(minter).mint(user1.address, mintAmount))
        .to.emit(lla0, "Minted")
        .withArgs(minter.address, user1.address, mintAmount);
    });

    it("Should emit Transfer event on mint", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(lla0.connect(minter).mint(user1.address, mintAmount))
        .to.emit(lla0, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, mintAmount);
    });

    it("Should emit Transfer event on burn", async function () {
      const mintAmount = ethers.parseEther("1000");
      await lla0.connect(minter).mint(user1.address, mintAmount);

      const burnAmount = ethers.parseEther("500");
      await expect(lla0.connect(user1).burn(burnAmount))
        .to.emit(lla0, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should emit Paused and Unpaused events", async function () {
      await expect(lla0.connect(pauser).pause())
        .to.emit(lla0, "Paused")
        .withArgs(pauser.address);

      await expect(lla0.connect(pauser).unpause())
        .to.emit(lla0, "Unpaused")
        .withArgs(pauser.address);
    });
  });

  // ============================================
  // 10. Gas 优化测试（可选）
  // ============================================
  describe("Gas Optimization", function () {
    it("Should report gas usage for mint", async function () {
      const tx = await lla0.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      const receipt = await tx.wait();
      console.log("Mint gas used:", receipt?.gasUsed.toString());
    });

    it("Should report gas usage for transfer", async function () {
      await lla0.connect(minter).mint(user1.address, ethers.parseEther("10000"));

      const tx = await lla0.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      const receipt = await tx.wait();
      console.log("Transfer gas used:", receipt?.gasUsed.toString());
    });

    it("Should report gas usage for burn", async function () {
      await lla0.connect(minter).mint(user1.address, ethers.parseEther("10000"));

      const tx = await lla0.connect(user1).burn(ethers.parseEther("100"));
      const receipt = await tx.wait();
      console.log("Burn gas used:", receipt?.gasUsed.toString());
    });
  });
});
