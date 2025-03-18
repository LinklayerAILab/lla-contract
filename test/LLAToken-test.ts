import { expect } from "chai";
import { LLAToken } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLAToken", function () {
  let LLATokenFactory: ContractFactory;
  let llaToken: LLAToken;
  let owner: SignerWithAddress;
  let pauser: SignerWithAddress;
  let minter: SignerWithAddress;
  let upgrader: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let proxyAddress: string;

  before(async function () {
    // Retrieve test accounts
    [owner, pauser, minter, upgrader, addr1, addr2] = await ethers.getSigners();
    console.log("owner:", owner.address);
    console.log("pauser:", pauser.address);
    console.log("minter:", minter.address);
    console.log("upgrader:", upgrader.address);
    console.log("addr1:", addr1.address);
    console.log("addr2:", addr2.address);

    // Get contract factory
    LLATokenFactory = await ethers.getContractFactory("LLAToken");

    // Deploy contract
    llaToken = (await upgrades.deployProxy(
      LLATokenFactory,
      [owner.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    )) as LLAToken;
    await llaToken.waitForDeployment();
    proxyAddress = await llaToken.getAddress();
    console.log("proxyAddress", proxyAddress);
  });

  describe("Initialization", function () {
    it("Should initialize roles correctly", async function () {
      // Verify that roles are assigned correctly
      expect(await llaToken.hasRole(await llaToken.ADMIN_ROLE(), owner.address))
        .to.be.true;
      expect(
        await llaToken.hasRole(await llaToken.PAUSER_ROLE(), pauser.address)
      ).to.be.true;
      expect(
        await llaToken.hasRole(await llaToken.MINTER_ROLE(), minter.address)
      ).to.be.true;
      expect(
        await llaToken.hasRole(await llaToken.UPGRADER_ROLE(), upgrader.address)
      ).to.be.true;
    });

    it("Should set the name and symbol correctly", async function () {
      // Verify that the name and symbol are set correctly
      expect(await llaToken.name()).to.equal("LLA");
      expect(await llaToken.symbol()).to.equal("LLA");
    });
  });

  describe("Minting", function () {
    it("Should mint tokens to an address", async function () {
      // Mint tokens to addr1 and verify the balance
      const amount = 100;
      await llaToken.connect(minter).mint(addr1.address, amount);
      expect(await llaToken.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should revert if non-minter tries to mint", async function () {
      // Attempt to mint tokens from a non-minter account and expect a revert
      const amount = 100;
      await expect(llaToken.connect(addr1).mint(addr2.address, amount))
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaToken.MINTER_ROLE());
    });
  });

  describe("Burning", function () {
    it("Should burn tokens from the owner", async function () {
      // Mint tokens to the contract address and then burn them, verifying the balance
      const amount = 100;
      await llaToken.connect(minter).mint(minter, amount);
      expect(await llaToken.balanceOf(minter)).to.equal(amount);
      await llaToken.connect(minter).burn(amount);
      expect(await llaToken.balanceOf(minter)).to.equal(0);
    });

    it("Should revert if trying to burn more than balance", async function () {
      // Attempt to burn more tokens than available and expect a revert
      const balance = await llaToken.balanceOf(addr1.address);
      await expect(llaToken.connect(addr1).burn(balance + 1n))
        .to.be.revertedWithCustomError(llaToken, "ERC20InsufficientBalance")
        .withArgs(addr1.address, balance, balance + 1n);
    });
  });

  describe("Pausing", function () {
    it("Should pause and unpause the contract", async function () {
      // Pause and unpause the contract, verifying the paused state
      await llaToken.connect(pauser).pause();
      expect(await llaToken.paused()).to.be.true;
      await llaToken.connect(pauser).unpause();
      expect(await llaToken.paused()).to.be.false;
    });

    it("Should revert if non-pauser tries to pause", async function () {
      // Attempt to pause the contract from a non-pauser account and expect a revert
      await expect(llaToken.connect(addr1).pause())
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, llaToken.PAUSER_ROLE());
    });
  });

  describe("Upgrading", function () {
    it("Should upgrade the contract", async function () {
      // Verify the initial version, upgrade the contract, and verify the new version
      const v1version = await llaToken.version();
      expect(v1version).to.equal("v1.0");
      const NewLLAToken = await ethers.getContractFactory(
        "NewLLAToken",
        upgrader
      );
      let upgradedContract;
      upgradedContract = await upgrades.upgradeProxy(
        await llaToken.getAddress(),
        NewLLAToken,
        {
          kind: "uups",
        }
      );
      const newVersion = await upgradedContract.version();
      expect(newVersion).to.equal("v2.0", "version invalid");
      // 还原成第一版本，方便测试
      const LLAToken = await ethers.getContractFactory("LLAToken", upgrader);
      await upgrades.upgradeProxy(await llaToken.getAddress(), LLAToken, {
        kind: "uups",
      });
    });

    it("Should revert if non-upgrader tries to upgrade", async function () {
      // Attempt to upgrade the contract from a non-upgrader account and expect a revert
      const UPDATE_ROLE_HASH = await llaToken.UPGRADER_ROLE();
      const NewLLAToken = await ethers.getContractFactory(
        "NewLLAToken",
        pauser
      );
      await expect(
        upgrades.upgradeProxy(await llaToken.getAddress(), NewLLAToken, {
          kind: "uups",
        })
      )
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(pauser.address, UPDATE_ROLE_HASH);
    });
  });

  describe("Role Management", function () {
    it("Should add a role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await llaToken.connect(owner).addRole(ADMIN_ROLE, addr1.address);
      expect(await llaToken.hasRole(ADMIN_ROLE, addr1.address)).to.be.true;
    });

    it("Should revert if non-admin tries to add role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await expect(llaToken.connect(addr2).addRole(ADMIN_ROLE, addr1.address))
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr2.address, ADMIN_ROLE);
    });

    it("Should revoke a role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await llaToken.connect(owner).revokeRole(ADMIN_ROLE, addr1.address);
      expect(await llaToken.hasRole(ADMIN_ROLE, addr1.address)).to.be.false;
    });

    it("Should revert if non-admin tries to revoke role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await expect(
        llaToken.connect(addr2).revokeRole(ADMIN_ROLE, addr1.address)
      )
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr2.address, ADMIN_ROLE);
    });
  });

  describe("Transfer Restrictions When Paused", function () {
    it("Should block transfers when paused", async function () {
      const amount = 100;
      await llaToken.connect(minter).mint(addr1.address, amount);
      await llaToken.connect(pauser).pause();

      await expect(
        llaToken.connect(addr1).transfer(addr2.address, amount)
      ).to.be.revertedWithCustomError(llaToken, "EnforcedPause");

      await llaToken.connect(pauser).unpause();
    });

    it("Should allow transfers when unpaused", async function () {
      const amount = 100;
      await llaToken.connect(addr1).transfer(addr2.address, amount);
      expect(await llaToken.balanceOf(addr2.address)).to.equal(amount);
    });
  });

  describe("Contract Version", function () {
    it("Should return correct version", async function () {
      expect(await llaToken.version()).to.equal("v1.0");
    });
  });

  describe("Zero Amount Operations", function () {
    it("Should revert on zero amount mint", async function () {
      await expect(llaToken.connect(minter).mint(addr1.address, 0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
      await expect(llaToken.connect(minter).mint(ethers.ZeroAddress, 100))
        .to.be.revertedWithCustomError(llaToken, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("Should revert on zero amount burn", async function () {
      await expect(llaToken.connect(owner).burn(0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
    });
  });
});
