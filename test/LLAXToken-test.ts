import { expect } from "chai";
import { LLAXToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLAXToken", function () {
  let LLATokenFactory: ContractFactory;
  let llaToken: LLAXToken;
  let owner: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let upgrader: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addr3: HardhatEthersSigner;
  let proxyAddress: string;

  before(async function () {
    // Retrieve test accounts
    [owner, pauser, minter, upgrader, addr1, addr2, addr3] =
      await ethers.getSigners();
    console.log("owner:", owner.address);
    console.log("pauser:", pauser.address);
    console.log("minter:", minter.address);
    console.log("upgrader:", upgrader.address);
    console.log("addr1:", addr1.address);
    console.log("addr2:", addr2.address);
    console.log("addr3:", addr3.address);

    // Get contract factory
    LLATokenFactory = await ethers.getContractFactory("LLAXToken");

    // Deploy contract
    llaToken = (await upgrades.deployProxy(
      LLATokenFactory,
      [owner.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    )) as LLAXToken;
    await llaToken.waitForDeployment();
    proxyAddress = await llaToken.getAddress();
    console.log("proxyAddress", proxyAddress);
  });

  describe("Initialization Tests", function () {
    it("should initialize roles correctly", async function () {
      // Verify role assignments
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

    it("should set name and symbol correctly", async function () {
      // Verify name and symbol
      expect(await llaToken.name()).to.equal("LLAX");
      expect(await llaToken.symbol()).to.equal("LLAX");
    });

    it("should have the correct total supply constant", async function () {
      const expectedTotalSupply = ethers.parseEther("650000000"); // 6_5000_0000 * 1e18
      expect(await llaToken.TOTAL_SUPPLY()).to.equal(expectedTotalSupply);
    });

    it("should revert when initialized with zero address", async function () {
      const newFactory = await ethers.getContractFactory("LLAXToken");

      await expect(
        upgrades.deployProxy(
          newFactory,
          [
            ethers.ZeroAddress,
            pauser.address,
            minter.address,
            upgrader.address,
          ],
          { kind: "uups", initializer: "initialize" }
        )
      )
        .to.be.revertedWithCustomError(newFactory, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);

      await expect(
        upgrades.deployProxy(
          newFactory,
          [owner.address, ethers.ZeroAddress, minter.address, upgrader.address],
          { kind: "uups", initializer: "initialize" }
        )
      )
        .to.be.revertedWithCustomError(newFactory, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);

      await expect(
        upgrades.deployProxy(
          newFactory,
          [owner.address, pauser.address, ethers.ZeroAddress, upgrader.address],
          { kind: "uups", initializer: "initialize" }
        )
      )
        .to.be.revertedWithCustomError(newFactory, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);

      await expect(
        upgrades.deployProxy(
          newFactory,
          [owner.address, pauser.address, minter.address, ethers.ZeroAddress],
          { kind: "uups", initializer: "initialize" }
        )
      )
        .to.be.revertedWithCustomError(newFactory, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });
  });

  

  describe("Burning Tests", function () {
    it("should burn tokens from the owner", async function () {
      // Mint tokens to the contract address and then burn them, verify balance
      const amount = 100;
      await llaToken.connect(minter).mint(minter.address, amount);
      expect(await llaToken.balanceOf(minter.address)).to.equal(amount);
      await llaToken.connect(minter).burn(amount);
      expect(await llaToken.balanceOf(minter.address)).to.equal(0);
    });

    it("should update total supply after burning", async function () {
      const burnAmount = 50;
      await llaToken.connect(minter).mint(addr1.address, burnAmount);
      const initialSupply = await llaToken.totalSupply();
      await llaToken.connect(addr1).burn(burnAmount);
      expect(await llaToken.totalSupply()).to.equal(
        initialSupply - BigInt(burnAmount)
      );
    });

    it("should revert when burning more tokens than balance", async function () {
      // Attempt to burn more tokens than available and expect a revert
      const balance = await llaToken.balanceOf(addr1.address);
      await expect(llaToken.connect(addr1).burn(balance + 1n))
        .to.be.revertedWithCustomError(llaToken, "ERC20InsufficientBalance")
        .withArgs(addr1.address, balance, balance + 1n);
    });

    it("should revert when burning zero amount", async function () {
      await expect(llaToken.connect(owner).burn(0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
    });

    it("should allow partial balance burning", async function () {
      const initialAmount = 200;
      const burnAmount = 50;
      await llaToken.connect(minter).mint(addr2.address, initialAmount);
      const initialBalance = await llaToken.balanceOf(addr2.address);
      await llaToken.connect(addr2).burn(burnAmount);
      expect(await llaToken.balanceOf(addr2.address)).to.equal(
        initialBalance - BigInt(burnAmount)
      );
    });
  });

  describe("Pause Functionality Tests", function () {
    it("should revert when non-PAUSER_ROLE address tries to pause", async function () {
      await expect(llaToken.connect(addr1).pause())
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaToken.PAUSER_ROLE());
    });

    it("should revert when non-PAUSER_ROLE address tries to unpause", async function () {
      await llaToken.connect(pauser).pause(); // Pause the contract first
      await expect(llaToken.connect(addr1).unpause())
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaToken.PAUSER_ROLE());
      await llaToken.connect(pauser).unpause(); // Unpause the contract
    });
    it("should pause and unpause the contract", async function () {
      // Pause and unpause the contract, verify pause state
      await llaToken.connect(pauser).pause();
      expect(await llaToken.paused()).to.be.true;
      await llaToken.connect(pauser).unpause();
      expect(await llaToken.paused()).to.be.false;
    });

    it("should revert when non-pauser tries to pause", async function () {
      // Attempt to pause the contract from a non-pauser account and expect a revert
      await expect(llaToken.connect(addr1).pause())
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaToken.PAUSER_ROLE());
    });

    it("should revert when non-pauser tries to unpause", async function () {
      await llaToken.connect(pauser).pause();
      await expect(llaToken.connect(addr1).unpause())
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaToken.PAUSER_ROLE());
      await llaToken.connect(pauser).unpause();
    });

    it("should revert when trying to pause while already paused", async function () {
      await llaToken.connect(pauser).pause();
      await expect(
        llaToken.connect(pauser).pause()
      ).to.be.revertedWithCustomError(llaToken, "EnforcedPause");
      await llaToken.connect(pauser).unpause();
    });

    it("should revert when trying to unpause while not paused", async function () {
      await expect(
        llaToken.connect(pauser).unpause()
      ).to.be.revertedWithCustomError(llaToken, "ExpectedPause");
    });
  });

  describe("Upgrade Tests", function () {
    it("should upgrade the contract", async function () {
      // Verify initial version, upgrade the contract, and verify new version
      const v1version = await llaToken.version();
      expect(v1version).to.equal("v1.0");
      const NewLLAToken = await ethers.getContractFactory(
        "NewLLAXToken",
        upgrader
      );
      let upgradedContract;
      upgradedContract = await upgrades.upgradeProxy(
        await llaToken.getAddress(),
        NewLLAToken,
        {
          kind: "uups",
        }
      ) as LLAXToken;
      const newVersion = await upgradedContract.version();
      expect(newVersion).to.equal("v2.0", "Invalid version");
      // Revert to the first version for testing
      const LLAToken = await ethers.getContractFactory("LLAXToken", upgrader);
      await upgrades.upgradeProxy(await llaToken.getAddress(), LLAToken, {
        kind: "uups",
      });
    });

    it("should revert when non-upgrader tries to upgrade", async function () {
      // Attempt to upgrade the contract from a non-upgrader account and expect a revert
      const UPDATE_ROLE_HASH = await llaToken.UPGRADER_ROLE();
      const NewLLAToken = await ethers.getContractFactory(
        "NewLLAXToken",
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

    it("should retain state after upgrade", async function () {
      // Mint some tokens before upgrade
      const mintAmount = 500;
      await llaToken.connect(minter).mint(addr1.address, mintAmount);
      const balanceBefore = await llaToken.balanceOf(addr1.address);

      // Upgrade the contract
      const NewLLAToken = await ethers.getContractFactory(
        "NewLLAXToken",
        upgrader
      );
      const upgradedContract = await upgrades.upgradeProxy(
        await llaToken.getAddress(),
        NewLLAToken,
        { kind: "uups" }
      ) as LLAXToken;

      // Check balance after upgrade
      const balanceAfter = await upgradedContract.balanceOf(addr1.address);
      expect(balanceAfter).to.equal(balanceBefore);

      // Revert to the original contract
      const LLAToken = await ethers.getContractFactory("LLAXToken", upgrader);
      await upgrades.upgradeProxy(await llaToken.getAddress(), LLAToken, {
        kind: "uups",
      });
    });
  });

  describe("Role Management Tests", function () {
    it("should add a role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await llaToken.connect(owner).addRole(ADMIN_ROLE, addr1.address);
      expect(await llaToken.hasRole(ADMIN_ROLE, addr1.address)).to.be.true;
    });

    it("should revert when non-admin tries to add a role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await expect(llaToken.connect(addr2).addRole(ADMIN_ROLE, addr1.address))
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr2.address, ADMIN_ROLE);
    });

    it("should revoke a role", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      await llaToken.connect(owner).revokeRole(ADMIN_ROLE, addr1.address);
      expect(await llaToken.hasRole(ADMIN_ROLE, addr1.address)).to.be.false;
    });

    it("should revert when non-admin tries to revoke a role", async function () {
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

    it("should add multiple roles to the same address", async function () {
      const ADMIN_ROLE = await llaToken.ADMIN_ROLE();
      const MINTER_ROLE = await llaToken.MINTER_ROLE();

      await llaToken.connect(owner).addRole(ADMIN_ROLE, addr3.address);
      await llaToken.connect(owner).addRole(MINTER_ROLE, addr3.address);

      expect(await llaToken.hasRole(ADMIN_ROLE, addr3.address)).to.be.true;
      expect(await llaToken.hasRole(MINTER_ROLE, addr3.address)).to.be.true;

      // Clean up test state
      await llaToken.connect(owner).revokeRole(ADMIN_ROLE, addr3.address);
      await llaToken.connect(owner).revokeRole(MINTER_ROLE, addr3.address);
    });
  });

  describe("Transfer Restrictions Tests", function () {
    it("should block transfers when paused", async function () {
      const amount = 100;
      await llaToken.connect(minter).mint(addr1.address, amount);
      await llaToken.connect(pauser).pause();

      await expect(
        llaToken.connect(addr1).transfer(addr2.address, amount)
      ).to.be.revertedWithCustomError(llaToken, "EnforcedPause");

      await llaToken.connect(pauser).unpause();
    });

    it("should allow transfers when unpaused", async function () {
      const amount = 100;
      const oldBalance = await llaToken.balanceOf(addr2.address);
      await llaToken.connect(addr1).transfer(addr2.address, amount);
      expect(await llaToken.balanceOf(addr2.address)).to.equal(
        BigInt(oldBalance) + BigInt(amount)
      );
    });

    it("should block approvals when paused", async function () {
      const amount = 100;
      await llaToken.connect(pauser).pause();
      await expect(
        llaToken.connect(addr1).approve(addr2.address, amount)
      ).to.be.revertedWithCustomError(llaToken, "EnforcedPause");

      await llaToken.connect(pauser).unpause();
    });

    it("should block transferFrom when paused", async function () {
      const amount = 100;
      await llaToken.connect(minter).mint(addr1.address, amount);
      await llaToken.connect(addr1).approve(addr2.address, amount);
      await llaToken.connect(pauser).pause();
      await expect(
        llaToken
          .connect(addr2)
          .transferFrom(addr1.address, addr3.address, amount)
      ).to.be.revertedWithCustomError(llaToken, "EnforcedPause");

      await llaToken.connect(pauser).unpause();
    });
  });

  describe("Contract Version Tests", function () {
    it("should return the correct version", async function () {
      expect(await llaToken.version()).to.equal("v1.0");
    });
  });

  describe("Zero Amount Operations Tests", function () {
    it("should revert when minting zero amount", async function () {
      await expect(llaToken.connect(minter).mint(addr1.address, 0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
    });

    it("should revert when minting to zero address", async function () {
      await expect(llaToken.connect(minter).mint(ethers.ZeroAddress, 100))
        .to.be.revertedWithCustomError(llaToken, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("should revert when burning zero amount", async function () {
      await expect(llaToken.connect(owner).burn(0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
    });
  });

  describe("ERC20 Standard Functionality Tests", function () {
    it("should correctly execute approve and allowance", async function () {
      const amount = 100;
      await llaToken.connect(addr1).approve(addr2.address, amount);
      expect(await llaToken.allowance(addr1.address, addr2.address)).to.equal(
        amount
      );
    });

    it("The transferFrom function should be executed correctly.", async function () {
      const amount = 50;
      const o1 = await llaToken.balanceOf(addr1.address);
      const o2 = await llaToken.balanceOf(addr2.address);
      const o3 = await llaToken.balanceOf(addr3.address);
      await llaToken.connect(addr1).approve(addr2.address, amount);
      const aa = await llaToken.allowance(addr1.address, addr2.address);
      await llaToken
        .connect(addr2)
        .transferFrom(addr1.address, addr3.address, amount);
      const aa3 = await llaToken.allowance(addr1.address, addr2.address);
      expect(await llaToken.balanceOf(addr1.address)).to.equal(
        BigInt(o1) - BigInt(amount)
      );
      expect(await llaToken.balanceOf(addr3.address)).to.equal(
        BigInt(o3) + BigInt(amount)
      );
      expect(await llaToken.allowance(addr1.address, addr2.address)).to.equal(
        BigInt(aa) - BigInt(amount)
      );
    });

    it("should correctly handle increase and decrease allowance", async function () {
      const initialAmount = 100;
      const increaseAmount = 50;
      const decreaseAmount = 30;

      await llaToken.connect(addr1).approve(addr2.address, initialAmount);

      await llaToken
        .connect(addr1)
        .approve(addr2.address, initialAmount + increaseAmount);
      expect(await llaToken.allowance(addr1.address, addr2.address)).to.equal(
        initialAmount + increaseAmount
      );

      await llaToken
        .connect(addr1)
        .approve(
          addr2.address,
          initialAmount + increaseAmount - decreaseAmount
        );
      expect(await llaToken.allowance(addr1.address, addr2.address)).to.equal(
        initialAmount + increaseAmount - decreaseAmount
      );
    });
  });

  describe("Boundary Condition Tests", function () {
    it("should handle large amount transfers", async function () {
      const o2 = await llaToken.balanceOf(addr2.address);
      const largeAmount = ethers.parseEther("1000000"); // 1 million tokens
      await llaToken.connect(minter).mint(addr1.address, largeAmount);
      await llaToken.connect(addr1).transfer(addr2.address, largeAmount);
      expect(await llaToken.balanceOf(addr2.address)).to.equal(
        o2 + largeAmount
      );
    });

    it("should handle multiple transfers", async function () {
      const amount = 10;
      const iterations = 10;

      // Mint enough tokens first
      await llaToken.connect(minter).mint(addr1.address, amount * iterations);
      const o3 = await llaToken.balanceOf(addr3.address);
      // Execute multiple transfers
      for (let i = 0; i < iterations; i++) {
        await llaToken.connect(addr1).transfer(addr3.address, amount);
      }

      expect(await llaToken.balanceOf(addr3.address)).to.equal(
        BigInt(amount * iterations) + BigInt(o3)
      );
    });
  });
  describe("Minting Tests", function () {
    // Test minting with a zero address and zero amount.
    it("should revert when minting to zero address", async function () {
      await expect(llaToken.connect(minter).mint(ethers.ZeroAddress, 100))
        .to.be.revertedWithCustomError(llaToken, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("should revert when minting zero amount", async function () {
      await expect(llaToken.connect(minter).mint(addr1.address, 0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
    });

    it("should mint tokens to an address", async function () {
      // Mint tokens to addr1 and verify balance
       const b1 = await llaToken.balanceOf(addr1.address);
       // Mint tokens to addr1 and verify balance
       const amount = ethers.parseEther("100");
       await llaToken.connect(minter).mint(addr1.address, amount);
       expect(await llaToken.balanceOf(addr1.address)).to.equal(b1 + amount);
    });

    it("should mint a large amount of tokens", async function () {
      const b1 = await llaToken.balanceOf(addr3.address);
      const largeAmount = ethers.parseEther("1000000"); // 1 million tokens
      await llaToken.connect(minter).mint(addr3.address, largeAmount);
      expect(await llaToken.balanceOf(addr3.address)).to.equal(
        largeAmount + b1
      );
    });

    it("should revert when non-minter tries to mint", async function () {
      // Attempt to mint from a non-minter account and expect a revert
      const amount = 100;
      await expect(llaToken.connect(addr1).mint(addr2.address, amount))
        .to.be.revertedWithCustomError(
          llaToken,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaToken.MINTER_ROLE());
    });

    it("should revert when minting zero amount", async function () {
      await expect(llaToken.connect(minter).mint(addr1.address, 0))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(0);
    });

    it("should revert when minting to zero address", async function () {
      await expect(llaToken.connect(minter).mint(ethers.ZeroAddress, 100))
        .to.be.revertedWithCustomError(llaToken, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("should update total supply after minting", async function () {
      const initialSupply = await llaToken.totalSupply();
      const mintAmount = 1000;
      await llaToken.connect(minter).mint(addr1.address, mintAmount);
      expect(await llaToken.totalSupply()).to.equal(
        initialSupply + BigInt(mintAmount)
      );
    });
    it("should update total supply after minting", async function () {
      const initialSupply = await llaToken.totalSupply();
      const mintAmount = 1000;
      await llaToken.connect(minter).mint(addr1.address, mintAmount);
      expect(await llaToken.totalSupply()).to.equal(
        initialSupply + BigInt(mintAmount)
      );
    });

    it("should allow minting up to the total supply", async function () {
      const maxSupply = await llaToken.TOTAL_SUPPLY();
      const hadSupply = await llaToken.totalSupply();

      const mintAmount = maxSupply - hadSupply;

      // Mint tokens up to the maximum supply
      await llaToken.connect(minter).mint(addr1.address, mintAmount);

      // Verify total supply matches the maximum supply
      const totalSupplyAfterMint = await llaToken.totalSupply();

      expect(totalSupplyAfterMint).to.equal(maxSupply);

      await expect(llaToken.connect(minter).mint(addr1.address, mintAmount))
        .to.be.revertedWithCustomError(llaToken, "InvalidAmount")
        .withArgs(mintAmount);
    });
  });
});
