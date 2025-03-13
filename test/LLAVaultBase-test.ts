import { expect } from "chai";
import { LLAToken, LLAVaultBase } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLAVaultBase", function () {
  let LLATokenFactory: ContractFactory;
  let llaVault: LLAVaultBase;
  let owner: SignerWithAddress;
  let pauser: SignerWithAddress;
  let minter: SignerWithAddress;
  let upgrader: SignerWithAddress;
  let tokenManager: SignerWithAddress;
  let multiSig: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let mockToken: LLAToken;
  const transferAmount = 1000;

  before(async function () {
    // Retrieve test accounts
    [owner, pauser, minter, upgrader, tokenManager, multiSig, addr1, addr2] =
      await ethers.getSigners();
    console.log("owner:", owner.address);
    console.log("pauser:", pauser.address);
    console.log("minter:", minter.address);
    console.log("upgrader:", upgrader.address);
    console.log("tokenManager:", tokenManager.address);
    console.log("multiSig:", multiSig.address);
    console.log("addr1:", addr1.address);

    // Deploy a mock ERC20 token
    LLATokenFactory = await ethers.getContractFactory("LLAToken");
    mockToken = (await upgrades.deployProxy(
      LLATokenFactory,
      [owner.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    )) as LLAToken;

    await mockToken.waitForDeployment();

    // Deploy the LLAVaultBase contract
    const LLAVaultFactory = await ethers.getContractFactory("LLAVaultBase");
    llaVault = (await upgrades.deployProxy(
      LLAVaultFactory,
      [
        owner.address,
        pauser.address,
        minter.address,
        tokenManager.address,
        upgrader.address,
        mockToken.target,
        multiSig.address,
      ],
      {
        initializer: "initialize",
        kind: "uups",
      }
    )) as LLAVaultBase;
    await llaVault.waitForDeployment();
  });

  describe("Initialization", function () {
    it("Should initialize roles correctly", async function () {
      // Verify that roles are assigned correctly
      const auth = llaVault.connect(owner);
      expect(await auth.hasRole(await auth.ADMIN_ROLE(), owner.address)).to.be
        .true;
      expect(await auth.hasRole(await auth.PAUSER_ROLE(), pauser.address)).to.be
        .true;
      expect(await auth.hasRole(await auth.MINTER_ROLE(), minter.address)).to.be
        .true;
      expect(await auth.hasRole(await auth.UPGRADER_ROLE(), upgrader.address))
        .to.be.true;
      expect(
        await auth.hasRole(
          await auth.TOKEN_MANAGER_ROLE(),
          tokenManager.address
        )
      ).to.be.true;
    });

    it("Grant the vault contract minting permissions for the LLA token.", async function () {
      // Grant the vault contract minting permissions for the LLA token
      const LLAAuth = mockToken.connect(owner);
      expect(await LLAAuth.hasRole(await LLAAuth.MINTER_ROLE(), owner.address))
        .to.be.false;

      await LLAAuth.addRole(await LLAAuth.MINTER_ROLE(), llaVault.target);

      expect(
        await LLAAuth.hasRole(await LLAAuth.MINTER_ROLE(), llaVault.target)
      ).to.be.true;
    });

    it("Should set LLA token address correctly", async function () {
      // Verify that the LLA token address is set correctly
      expect(await llaVault.llaToken()).to.equal(mockToken.target);
    });

    it("Should set multiSig address correctly", async function () {
      // Verify that the multiSig address is set correctly
      expect(await llaVault.multiSig()).to.equal(multiSig.address);
    });
  });

  describe("Role Management", function () {
    it("Should add a role", async function () {
      // Add a role and verify
      llaVault.connect(owner);
      const TOKEN_MANAGER_ROLE = await llaVault.TOKEN_MANAGER_ROLE();
      await llaVault.addRole(TOKEN_MANAGER_ROLE, addr1.address);
      expect(await llaVault.hasRole(TOKEN_MANAGER_ROLE, addr1.address)).to.be
        .true;
    });

    it("Should revoke a role", async function () {
      // Revoke a role and verify
      llaVault.connect(owner);
      const UPDATE_ROLE = await llaVault.TOKEN_MANAGER_ROLE();
      await llaVault.revokeRole(UPDATE_ROLE, addr1.address);
      expect(await llaVault.hasRole(UPDATE_ROLE, addr1.address)).to.be.false;
    });
  });

  describe("LLAToken Update", function () {
    it("Should revert if llaToken is zero address", async function () {
      await expect(
        llaVault.connect(tokenManager).updateLLAToken(ethers.ZeroAddress)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });
    it("Should update LLA token address", async function () {
      // Update the LLA token address and verify
      const newTokenFactory = await ethers.getContractFactory("LLAToken");
      const mockToken2 = (await upgrades.deployProxy(
        newTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAToken;

      await mockToken2.waitForDeployment();
      expect(await llaVault.llaToken()).to.equal(mockToken.target);
      await llaVault.connect(tokenManager).updateLLAToken(mockToken2.target);
      expect(await llaVault.llaToken()).to.equal(mockToken2.target);
      await llaVault.connect(tokenManager).updateLLAToken(mockToken.target);
      expect(await llaVault.llaToken()).to.equal(mockToken.target);
    });

    it("Should revert if non-token manager tries to update LLA token", async function () {
      // Attempt to update the LLA token address from a non-token manager account and expect a revert
      const newTokenFactory = await ethers.getContractFactory("LLAToken");
      const mockToken3 = (await upgrades.deployProxy(
        newTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAToken;
      await expect(
        llaVault.connect(addr2).updateLLAToken(mockToken3.target)
      ).to.be.revertedWithCustomError(
        llaVault,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Pausing and Unpausing", function () {
    it("Should pause the contract", async function () {
      // Pause the contract and verify the paused state
      await llaVault.connect(pauser).pause();
      expect(await llaVault.paused()).to.be.true;
    });

    it("Should unpause the contract", async function () {
      // Unpause the contract and verify the paused state
      await llaVault.connect(pauser).unpause();
      expect(await llaVault.paused()).to.be.false;
    });

    it("Should revert if non-pauser tries to pause", async function () {
      // Attempt to pause the contract from a non-pauser account and expect a revert
      await expect(
        llaVault.connect(addr1).pause()
      ).to.be.revertedWithCustomError(
        llaVault,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("Should revert if non-pauser tries to unpause", async function () {
      // Attempt to unpause the contract from a non-pauser account and expect a revert
      await llaVault.connect(pauser).pause();
      await expect(
        llaVault.connect(addr1).unpause()
      ).to.be.revertedWithCustomError(
        llaVault,
        "AccessControlUnauthorizedAccount"
      );
      await llaVault.connect(pauser).unpause();
    });
  });

  describe("Supported Tokens", function () {
    it("Should add a supported token", async function () {
      // Add a supported token and verify
      await expect(
        llaVault.connect(tokenManager).addSupportedToken(mockToken.target)
      )
        .to.emit(llaVault, "TokenAdded")
        .withArgs(mockToken.target, await mockToken.symbol());
    });

    it("Should revert if token already exists", async function () {
      // Attempt to add a token that already exists and expect a revert
      await expect(
        llaVault.connect(tokenManager).addSupportedToken(mockToken.target)
      )
        .to.be.revertedWithCustomError(llaVault, "AlreadyInTheSupportedIcon")
        .withArgs(mockToken.target);
    });

    it("Should revert if token does not exist", async function () {
      // Attempt to remove a token that does not exist and expect a revert
      const newToken = (await upgrades.deployProxy(
        LLATokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAToken;
      await newToken.waitForDeployment();
      await expect(
        llaVault.connect(tokenManager).removeSupportedToken(newToken.target)
      )
        .to.be.revertedWithCustomError(llaVault, "UnsupportedToken")
        .withArgs(newToken.target);
    });

    it("Should remove a supported token", async function () {
      // Remove a supported token and verify
      const newToken = (await upgrades.deployProxy(
        LLATokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAToken;
      await newToken.waitForDeployment();
      await llaVault.connect(tokenManager).addSupportedToken(newToken.target);
      await expect(
        llaVault.connect(tokenManager).removeSupportedToken(newToken.target)
      ).to.emit(llaVault, "TokenRemoved");
    });
  });

  describe("Deposit", function () {
    it("Should deposit tokens", async function () {
      // Deposit tokens and verify the balance
      const amount = 50000;
      await mockToken.connect(minter).mint(owner.address, amount);
      await mockToken.connect(owner).approve(llaVault.target, amount);
      await llaVault.connect(owner).deposit(mockToken.target, transferAmount);
      expect(await mockToken.balanceOf(llaVault.target)).to.equal(
        transferAmount
      );
    });

    it("Should revert if token is unsupported", async function () {
      // Attempt to deposit an unsupported token and expect a revert
      const newTokenFactory = await ethers.getContractFactory("LLAToken");
      const mockToken3 = (await upgrades.deployProxy(
        newTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAToken;

      await mockToken3.waitForDeployment();
      const amount = 100;
      await mockToken3.connect(owner).approve(llaVault.target, amount);
      await expect(llaVault.connect(owner).deposit(mockToken3.target, amount))
        .to.be.revertedWithCustomError(llaVault, "UnsupportedToken")
        .withArgs(mockToken3.target);
    });

    it("Deposit Should revert if transfer fails", async function () {
      // Attempt to deposit tokens without approval and expect a revert
      const amount = 100;
      await expect(llaVault.connect(addr2).deposit(mockToken.target, amount))
        .to.be.revertedWithCustomError(mockToken, "ERC20InsufficientAllowance")
        .withArgs(llaVault.target, 0, amount);
    });

    it("Should revert if amount is zero", async function () {
      // Attempt to deposit zero tokens and expect a revert
      const amount = 0;
      await expect(llaVault.connect(addr2).deposit(mockToken.target, amount))
        .to.be.revertedWithCustomError(llaVault, "InvalidAmount")
        .withArgs(amount);
    });
  });

  describe("Withdrawal", function () {
    it("Should revert if non-multiSig tries to withdraw", async function () {
      // Attempt to withdraw tokens from a non-multiSig account and expect a revert
      const amount = 100;
      await mockToken.connect(owner).transfer(llaVault.target, amount);
      await expect(
        llaVault
          .connect(owner)
          .withdraw(mockToken.target, addr1.address, amount)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidMultisigAddress")
        .withArgs(await llaVault.multiSig());
    });

    it("Should revert if amount is zero", async function () {
      // Attempt to withdraw zero tokens and expect a revert
      await expect(
        llaVault.connect(multiSig).withdraw(mockToken.target, addr1.address, 0)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAmount")
        .withArgs(0);
    });

    it("Withdrawal Should revert if transfer fails", async function () {
      // Attempt to withdraw more tokens than available and expect a revert
      const amount = ethers.MaxUint256;
      await expect(
        llaVault
          .connect(multiSig)
          .withdraw(mockToken.target, addr1.address, amount)
      ).to.be.revertedWithCustomError(llaVault, "WithdrawalLimitExceeded");
    });

    it("Should revert if token is unsupported", async function () {
      // Attempt to withdraw an unsupported token and expect a revert
      const newTokenFactory = await ethers.getContractFactory("LLAToken");
      const mockToken3 = (await upgrades.deployProxy(
        newTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAToken;

      await mockToken3.waitForDeployment();
      const amount = 100;

      await expect(
        llaVault
          .connect(owner)
          .withdraw(mockToken3.target, addr1.address, amount)
      )
        .to.be.revertedWithCustomError(llaVault, "UnsupportedToken")
        .withArgs(mockToken3.target);
    });

    it("Should withdraw tokens to an address", async function () {
      // Withdraw tokens to an address and verify the balance
      // The balance of the account before the deposit
      const oldBalance = await mockToken.balanceOf(addr1.address);
      // The balance of the contract before the deposit
      const contractOldBalance = await mockToken.balanceOf(llaVault.target);
      // Withdraw tokens
      await llaVault
        .connect(multiSig)
        .withdraw(mockToken.target, addr1.address, transferAmount);
      // The balance of the account after the deposit
      const newBalance = await mockToken.balanceOf(addr1.address);
      // The balance of the contract after the deposit
      const contractNewBalance = await mockToken.balanceOf(llaVault.target);
      // Withdraw tokens and verify the balance
      expect(newBalance).to.equal(BigInt(transferAmount) + oldBalance);
      expect(contractNewBalance).to.equal(
        contractOldBalance - BigInt(transferAmount)
      );
    });
  });

  describe("Payment Records", function () {
    it("The user's transaction records should be queryable correctly.", async function () {
      // Verify that the user's transaction records are queryable correctly
      const amount = 100000;
      const payAmount = 100;
      await mockToken.connect(minter).mint(addr1.address, amount);
      await mockToken.connect(addr1).approve(llaVault.target, payAmount);
      await llaVault.connect(addr1).deposit(mockToken.target, payAmount);

      const payment = await llaVault.payments(addr1.address, 0);
      expect(payment.payer).to.equal(addr1.address);
      expect(payment.amount).to.equal(payAmount);
      expect(payment.token).to.equal(mockToken.target);
      expect(payment.isWithdrawn).to.equal(false);

      const latestBlock = await ethers.provider.getBlock("latest");
      expect(payment.timestamp).to.equal(latestBlock?.timestamp);
    });

    it("New users should have no transaction records.", async function () {
      // Verify that new users have no transaction records
      const newUser = addr2;
      await expect(llaVault.payments(newUser.address, 0)).to.be.reverted;
    });
  });

  describe("Emergency Withdrawal", function () {
    it("Should revert emergency withdrawal if not enabled", async function () {
      expect(await llaVault.connect(owner).emergencyWithdrawalEnabled()).to.be
        .false;
      await expect(
        llaVault.connect(owner).emergencyWithdraw(mockToken.target)
      ).to.be.revertedWithCustomError(
        llaVault,
        "EmergencyWithdrawalNotEnabled"
      );
    });
    it("Should enable emergency withdrawal", async function () {
      await expect(llaVault.connect(owner).enableEmergencyWithdrawal()).to.emit(
        llaVault,
        "EmergencyWithdrawalRequested"
      );
      expect(await llaVault.emergencyWithdrawalEnabled()).to.be.true;
    });

    it("Should revert emergency withdrawal if delay not met", async function () {
      await llaVault.connect(owner).enableEmergencyWithdrawal();
      await expect(
        llaVault.connect(owner).emergencyWithdraw(mockToken.target)
      ).to.be.revertedWithCustomError(llaVault, "EmergencyWithdrawalTooEarly");
    });

    it("Should execute emergency withdrawal after delay", async function () {
      const amount = 1000;
      expect(await llaVault.connect(owner).emergencyWithdrawalEnabled()).to.be
        .true;
      await mockToken.connect(minter).mint(llaVault.target, amount);
      await llaVault.connect(owner).enableEmergencyWithdrawal();

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(llaVault.connect(owner).emergencyWithdraw(mockToken.target))
        .to.emit(llaVault, "EmergencyWithdrawalExecuted")
        .withArgs(mockToken.target, await mockToken.balanceOf(llaVault.target));
    });
  });

  describe("Withdrawal Limits", function () {
    it("Should enforce withdrawal delay", async function () {
      const amount = 100;
      await mockToken.connect(minter).mint(llaVault.target, amount * 2);

      await llaVault
        .connect(multiSig)
        .withdraw(mockToken.target, addr1.address, amount);

      await expect(
        llaVault
          .connect(multiSig)
          .withdraw(mockToken.target, addr1.address, amount)
      ).to.be.revertedWithCustomError(llaVault, "WithdrawalTooFrequent");
    });

    // TODO 需要验证下面的测试用例
    it("Should allow withdrawal after delay period", async function () {
      const amount = 100;
      await mockToken.connect(minter).mint(llaVault.target, amount);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        llaVault
          .connect(multiSig)
          .withdraw(mockToken.target, addr1.address, amount)
      ).to.emit(llaVault, "Withdrawal");
    });

    it("Should enforce maximum withdrawal amount", async function () {
      const maxAmount = await llaVault.MAX_WITHDRAWAL_AMOUNT();
      const exceedAmount = maxAmount + BigInt(1);
      await expect(
        llaVault
          .connect(multiSig)
          .withdraw(mockToken.target, addr1.address, exceedAmount)
      ).to.be.revertedWithCustomError(llaVault, "WithdrawalLimitExceeded");
    });
  });

  describe("String Utils", function () {
    it("Should correctly check if string is empty", async function () {
      expect(await llaVault.isEmpty("")).to.be.true;
      expect(await llaVault.isEmpty("test")).to.be.false;
    });
  });
});
