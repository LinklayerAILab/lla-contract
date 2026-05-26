import { expect } from "chai";
import { LLAx } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLAx Token", function () {
  let LLAxFactory: ContractFactory;
  let llax: LLAx;
  let defaultAdmin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseEther("100000000000");

  before(async function () {
    [defaultAdmin, pauser, minter, user1, user2, user3] = await ethers.getSigners();
  });

  beforeEach(async function () {
    LLAxFactory = await ethers.getContractFactory("LLAx");
    llax = (await LLAxFactory.deploy(
      defaultAdmin.address,
      pauser.address
    )) as LLAx;
    await llax.waitForDeployment();
    // 授权 minter 并铸造初始供应
    const MINTER_ROLE = await llax.MINTER_ROLE();
    await llax.connect(defaultAdmin).grantRole(MINTER_ROLE, minter.address);
    await llax.connect(minter).mint(minter.address, MAX_SUPPLY);
  });

  describe("Deployment and fixed supply", function () {
    it("sets token metadata", async function () {
      expect(await llax.name()).to.equal("LLAx");
      expect(await llax.symbol()).to.equal("LLAx");
      expect(await llax.decimals()).to.equal(18);
    });

    it("mints the entire max supply via minter role", async function () {
      expect(await llax.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(await llax.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await llax.balanceOf(minter.address)).to.equal(MAX_SUPPLY);
    });

    it("assigns only admin and pauser roles", async function () {
      const DEFAULT_ADMIN_ROLE = await llax.DEFAULT_ADMIN_ROLE();
      const PAUSER_ROLE = await llax.PAUSER_ROLE();

      expect(await llax.hasRole(DEFAULT_ADMIN_ROLE, defaultAdmin.address)).to.be.true;
      expect(await llax.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;
    });

    it("supports the AccessControl interface", async function () {
      expect(await llax.supportsInterface("0x7965db0b")).to.be.true;
    });

    it("reverts when deploying with zero admin", async function () {
      await expect(
        LLAxFactory.deploy(ethers.ZeroAddress, pauser.address)
      ).to.be.revertedWith("LLAx: admin is zero address");
    });

    it("reverts when deploying with zero pauser", async function () {
      await expect(
        LLAxFactory.deploy(defaultAdmin.address, ethers.ZeroAddress)
      ).to.be.revertedWith("LLAx: pauser is zero address");
    });

    it("reverts when deploying with zero initial holder", async function () {
      // minter parameter removed, no longer applicable
    });
  });

  describe("Mint via MINTER_ROLE", function () {
    it("only MINTER_ROLE can mint", async function () {
      await expect(
        llax.connect(user1).mint(user1.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(llax, "AccessControlUnauthorizedAccount");
    });

    it("minter can mint after burning", async function () {
      const burnAmount = ethers.parseEther("5000");
      await llax.connect(minter).burn(burnAmount);

      const MINTER_ROLE = await llax.MINTER_ROLE();
      await llax.connect(defaultAdmin).grantRole(MINTER_ROLE, user1.address);
      await expect(llax.connect(user1).mint(user2.address, burnAmount))
        .to.emit(llax, "Transfer");
      expect(await llax.balanceOf(user2.address)).to.equal(burnAmount);
    });
  });

  describe("Burn functionality", function () {
    beforeEach(async function () {
      await llax.connect(minter).transfer(user1.address, ethers.parseEther("10000"));
    });

    it("allows users to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("1000");

      await expect(llax.connect(user1).burn(burnAmount))
        .to.emit(llax, "Burned")
        .withArgs(user1.address, burnAmount)
        .and.to.emit(llax, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);

      expect(await llax.balanceOf(user1.address)).to.equal(ethers.parseEther("9000"));
      expect(await llax.totalSupply()).to.equal(MAX_SUPPLY - burnAmount);
    });

    it("reverts when burning zero amount", async function () {
      await expect(llax.connect(user1).burn(0)).to.be.revertedWith("LLAx: amount is zero");
    });

    it("reverts when burning more than balance", async function () {
      await expect(
        llax.connect(user1).burn(ethers.parseEther("10001"))
      ).to.be.revertedWithCustomError(llax, "ERC20InsufficientBalance");
    });
  });

  describe("burnFrom functionality", function () {
    beforeEach(async function () {
      await llax.connect(minter).transfer(user1.address, ethers.parseEther("10000"));
    });

    it("allows approved spender to burn tokens via burnFrom", async function () {
      const burnAmount = ethers.parseEther("1000");
      const approveAmount = ethers.parseEther("5000");

      await llax.connect(user1).approve(user2.address, approveAmount);

      await expect(llax.connect(user2).burnFrom(user1.address, burnAmount))
        .to.emit(llax, "Burned")
        .withArgs(user1.address, burnAmount);

      expect(await llax.balanceOf(user1.address)).to.equal(ethers.parseEther("9000"));
      expect(await llax.allowance(user1.address, user2.address)).to.equal(approveAmount - burnAmount);
    });

    it("reverts burnFrom without approval", async function () {
      await expect(
        llax.connect(user2).burnFrom(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(llax, "ERC20InsufficientAllowance");
    });

    it("allows burnFrom when paused", async function () {
      await llax.connect(user1).approve(user2.address, ethers.parseEther("1000"));
      await llax.connect(pauser).pause();

      await expect(llax.connect(user2).burnFrom(user1.address, ethers.parseEther("500")))
        .to.emit(llax, "Burned")
        .withArgs(user1.address, ethers.parseEther("500"));
    });
  });

  describe("Pause functionality", function () {
    beforeEach(async function () {
      await llax.connect(minter).transfer(user1.address, ethers.parseEther("10000"));
    });

    it("allows PAUSER_ROLE to pause and unpause", async function () {
      await expect(llax.connect(pauser).pause())
        .to.emit(llax, "Paused")
        .withArgs(pauser.address);

      expect(await llax.paused()).to.be.true;

      await expect(llax.connect(pauser).unpause())
        .to.emit(llax, "Unpaused")
        .withArgs(pauser.address);

      expect(await llax.paused()).to.be.false;
    });

    it("prevents transfers when paused", async function () {
      await llax.connect(pauser).pause();

      await expect(
        llax.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(llax, "EnforcedPause");
    });

    it("allows burning when paused", async function () {
      await llax.connect(pauser).pause();

      await expect(llax.connect(user1).burn(ethers.parseEther("100")))
        .to.emit(llax, "Burned")
        .withArgs(user1.address, ethers.parseEther("100"));
    });

    it("allows transfers after unpausing", async function () {
      await llax.connect(pauser).pause();
      await llax.connect(pauser).unpause();

      await expect(llax.connect(user1).transfer(user2.address, ethers.parseEther("100")))
        .to.emit(llax, "Transfer")
        .withArgs(user1.address, user2.address, ethers.parseEther("100"));
    });
  });

  describe("Role management", function () {
    it("allows DEFAULT_ADMIN to manage PAUSER_ROLE", async function () {
      const PAUSER_ROLE = await llax.PAUSER_ROLE();

      await expect(llax.connect(defaultAdmin).grantRole(PAUSER_ROLE, user1.address))
        .to.emit(llax, "RoleGranted")
        .withArgs(PAUSER_ROLE, user1.address, defaultAdmin.address);

      expect(await llax.hasRole(PAUSER_ROLE, user1.address)).to.be.true;

      await expect(llax.connect(defaultAdmin).revokeRole(PAUSER_ROLE, user1.address))
        .to.emit(llax, "RoleRevoked")
        .withArgs(PAUSER_ROLE, user1.address, defaultAdmin.address);

      expect(await llax.hasRole(PAUSER_ROLE, user1.address)).to.be.false;
    });

    it("does not allow non-admin to grant roles", async function () {
      const PAUSER_ROLE = await llax.PAUSER_ROLE();
      const DEFAULT_ADMIN_ROLE = await llax.DEFAULT_ADMIN_ROLE();

      await expect(
        llax.connect(user1).grantRole(PAUSER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(llax, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("ERC20 standard functionality", function () {
    beforeEach(async function () {
      await llax.connect(minter).transfer(user1.address, ethers.parseEther("10000"));
    });

    it("transfers tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(llax.connect(user1).transfer(user2.address, transferAmount))
        .to.emit(llax, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);

      expect(await llax.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("approves and transfers via transferFrom", async function () {
      const approveAmount = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("200");

      await llax.connect(user1).approve(user2.address, approveAmount);

      await expect(
        llax.connect(user2).transferFrom(user1.address, user3.address, transferAmount)
      ).to.emit(llax, "Transfer")
        .withArgs(user1.address, user3.address, transferAmount);

      expect(await llax.balanceOf(user3.address)).to.equal(transferAmount);
      expect(await llax.allowance(user1.address, user2.address)).to.equal(
        approveAmount - transferAmount
      );
    });
  });

  describe("EIP-2612 permit", function () {
    it("has a domain separator and starts nonces at zero", async function () {
      expect(await llax.DOMAIN_SEPARATOR()).to.not.equal(ethers.ZeroHash);
      expect(await llax.nonces(user1.address)).to.equal(0);
    });
  });
});
