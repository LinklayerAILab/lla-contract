import { expect } from "chai";
import { LLAXToken, LLAVaultBase, MockUSDC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { bigint } from "hardhat/internal/core/params/argumentTypes";
describe("LLAVaultBase", function () {
  const mintingRate = BigInt(60); // 60%
  const fundingRate = BigInt(30); // 30%
  let LLAXTokenFactory: ContractFactory;
  let llaVault: LLAVaultBase;
  let owner: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let upgrader: HardhatEthersSigner;
  let tokenManager: HardhatEthersSigner;
  let multiSig: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addr3: HardhatEthersSigner;
  let mockToken: LLAXToken;
  let mockToken2: LLAXToken;
  let VaultProxyAddress: string;
  let LLAProxyAddress: string;
  const transferAmount = 1000;
  let USDCTokenFactory: ContractFactory;
  let USDCToken: MockUSDC;

  before(async function () {
    // Obtain a test account.
    [
      owner,
      pauser,
      minter,
      upgrader,
      tokenManager,
      multiSig,
      addr1,
      addr2,
      addr3,
    ] = await ethers.getSigners();
    console.log("owner:", owner.address);
    console.log("pauser:", pauser.address);
    console.log("minter:", minter.address);
    console.log("upgrader:", upgrader.address);
    console.log("tokenManager:", tokenManager.address);
    console.log("multiSig:", multiSig.address);
    console.log("addr1:", addr1.address);

    // Deploy a mock ERC20 token.
    LLAXTokenFactory = await ethers.getContractFactory("LLAXToken");
    mockToken = (await upgrades.deployProxy(
      LLAXTokenFactory,
      [owner.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    )) as LLAXToken;

    await mockToken.waitForDeployment();
    LLAProxyAddress = await mockToken.getAddress();

    // Deploy a second mock token for testing.
    mockToken2 = (await upgrades.deployProxy(
      LLAXTokenFactory,
      [owner.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    )) as LLAXToken;
    await mockToken2.waitForDeployment();

    // Deploy the LLAVaultBase contract.
    const LLAVaultFactory = await ethers.getContractFactory("LLAVaultBase");
    llaVault = (await upgrades.deployProxy(
      LLAVaultFactory,
      [
        owner.address,
        pauser.address,
        minter.address,
        tokenManager.address,
        upgrader.address,
        LLAProxyAddress,
        multiSig.address,
      ],
      {
        initializer: "initialize",
        kind: "uups",
      }
    )) as LLAVaultBase;
    await llaVault.waitForDeployment();
    VaultProxyAddress = await llaVault.getAddress();

    USDCTokenFactory = await ethers.getContractFactory("MockUSDC");
    USDCToken = (await upgrades.deployProxy(
      USDCTokenFactory,
      [owner.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    )) as LLAXToken;
    // Add as a supported token
    await llaVault
      .connect(tokenManager)
      .addSupportedToken(await USDCToken.getAddress());
  });

  describe("Initialize the test.", function () {
    it("The roles should be correctly initialized.", async function () {
      // Verify that the role assignments are correct.
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

    it("The vault contract should be granted minting permissions for the LLA token.", async function () {
      // Grant the vault contract minting permissions for the LLA token.
      const LLAAuth = mockToken.connect(owner);
      expect(await LLAAuth.hasRole(await LLAAuth.MINTER_ROLE(), owner.address))
        .to.be.false;

      await LLAAuth.addRole(await LLAAuth.MINTER_ROLE(), VaultProxyAddress);

      expect(
        await LLAAuth.hasRole(await LLAAuth.MINTER_ROLE(), VaultProxyAddress)
      ).to.be.true;
    });

    it("The LLA token address should be correctly set.", async function () {
      // Verify that the LLA token address is correctly set.
      expect(await llaVault.token()).to.equal(LLAProxyAddress);
    });

    it("The multisig address should be correctly set.", async function () {
      // Verify that the multisig address is correctly set.
      expect(await llaVault.multiSig()).to.equal(multiSig.address);
    });

    it("The version number should be correctly set.", async function () {
      // Verify that the version number is correctly set.
      expect(await llaVault.version()).to.equal("v1.0");
    });

    it("Using the zero address during initialization should revert.", async function () {
      const LLAVaultFactory = await ethers.getContractFactory("LLAVaultBase");

      // Test the scenario where each parameter is the zero address.
      await expect(
        upgrades.deployProxy(
          LLAVaultFactory,
          [
            ethers.ZeroAddress,
            pauser.address,
            minter.address,
            tokenManager.address,
            upgrader.address,
            LLAProxyAddress,
            multiSig.address,
          ],
          {
            initializer: "initialize",
            kind: "uups",
          }
        )
      )
        .to.be.revertedWithCustomError(LLAVaultFactory, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);

      await expect(
        upgrades.deployProxy(
          LLAVaultFactory,
          [
            owner.address,
            ethers.ZeroAddress,
            minter.address,
            tokenManager.address,
            upgrader.address,
            LLAProxyAddress,
            multiSig.address,
          ],
          {
            initializer: "initialize",
            kind: "uups",
          }
        )
      )
        .to.be.revertedWithCustomError(LLAVaultFactory, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);

      // Similar tests for zero addresses of other parameters can be added in the same manner.
    });
  });

  describe("Role management testing.", function () {
    it("Roles should be added.", async function () {
      // Add roles and verify them.
      llaVault.connect(owner);
      const TOKEN_MANAGER_ROLE = await llaVault.TOKEN_MANAGER_ROLE();

      await llaVault.addRole(TOKEN_MANAGER_ROLE, addr1.address);
      expect(await llaVault.hasRole(TOKEN_MANAGER_ROLE, addr1.address)).to.be
        .true;
    });

    it("Roles should be revoked.", async function () {
      // Revoke roles and verify.
      llaVault.connect(owner);
      const UPDATE_ROLE = await llaVault.TOKEN_MANAGER_ROLE();
      await llaVault.revokeRole(UPDATE_ROLE, addr1.address);
      expect(await llaVault.hasRole(UPDATE_ROLE, addr1.address)).to.be.false;
    });

    it("Adding roles by a non-admin should revert.", async function () {
      const TOKEN_MANAGER_ROLE = await llaVault.TOKEN_MANAGER_ROLE();

      await expect(
        llaVault.connect(addr1).addRole(TOKEN_MANAGER_ROLE, addr2.address)
      )
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.ADMIN_ROLE());
    });

    it("Revoking roles by a non-admin should revert.", async function () {
      const TOKEN_MANAGER_ROLE = await llaVault.TOKEN_MANAGER_ROLE();

      // Add the role first.
      await llaVault.connect(owner).addRole(TOKEN_MANAGER_ROLE, addr2.address);

      // Attempt to revoke by a non-admin.
      await expect(
        llaVault.connect(addr1).revokeRole(TOKEN_MANAGER_ROLE, addr2.address)
      )
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.ADMIN_ROLE());

      // Cleanup: Admin revokes the role.
      await llaVault
        .connect(owner)
        .revokeRole(TOKEN_MANAGER_ROLE, addr2.address);
    });
  });

  describe("Test pausing and unpausing.", function () {
    it("The contract should be paused.", async function () {
      // Pause the contract and verify the paused state.
      await llaVault.connect(pauser).pause();
      expect(await llaVault.paused()).to.be.true;
    });

    it("The contract should be unpaused.", async function () {
      // Unpause the contract and verify the paused state.
      await llaVault.connect(pauser).unpause();
      expect(await llaVault.paused()).to.be.false;
    });

    it("Pausing by a non-pauser should revert.", async function () {
      // Attempt to pause the contract from a non-pauser account and expect it to revert.
      await expect(llaVault.connect(addr1).pause())
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.PAUSER_ROLE());
    });

    it("Unpausing by a non-pauser should revert.", async function () {
      // Attempt to unpause the contract from a non-pauser account and expect it to revert.
      await llaVault.connect(pauser).pause();
      await expect(llaVault.connect(addr1).unpause())
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.PAUSER_ROLE());
      await llaVault.connect(pauser).unpause();
    });

    it("Attempting to pause again when already paused should revert.", async function () {
      await llaVault.connect(pauser).pause();
      await expect(
        llaVault.connect(pauser).pause()
      ).to.be.revertedWithCustomError(llaVault, "EnforcedPause");
      await llaVault.connect(pauser).unpause();
    });

    it("Attempting to unpause when not paused should revert.", async function () {
      await expect(
        llaVault.connect(pauser).unpause()
      ).to.be.revertedWithCustomError(llaVault, "ExpectedPause");
    });
  });

  describe("Test supported token management.", function () {
    it("Supported tokens should be added.", async function () {
      // Add supported tokens and verify them.
      const tokenAddress = await mockToken2.getAddress();
      await expect(
        llaVault.connect(tokenManager).addSupportedToken(tokenAddress)
      )
        .to.emit(llaVault, "TokenAdded")
        .withArgs(tokenAddress, await mockToken2.symbol());

      expect(await llaVault.supportCoins(tokenAddress)).to.equal(
        await mockToken2.symbol()
      );
    });

    it("If the token already exists, it should revert.", async function () {
      // Attempt to add an existing token and expect it to revert.
      const tokenAddress = await mockToken2.getAddress();
      await expect(
        llaVault.connect(tokenManager).addSupportedToken(tokenAddress)
      )
        .to.be.revertedWithCustomError(llaVault, "AlreadyInTheSupportedIcon")
        .withArgs(tokenAddress);
    });

    it("If the token does not exist, removing it should revert.", async function () {
      // Attempt to remove a non-existent token and expect it to revert.
      const newToken = (await upgrades.deployProxy(
        LLAXTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAXToken;
      await newToken.waitForDeployment();
      await expect(
        llaVault.connect(tokenManager).removeSupportedToken(newToken.target)
      )
        .to.be.revertedWithCustomError(llaVault, "UnsupportedToken")
        .withArgs(newToken.target);
    });

    it("Supported tokens should be removed.", async function () {
      // Remove supported tokens and verify.
      const newToken = (await upgrades.deployProxy(
        LLAXTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAXToken;
      await newToken.waitForDeployment();
      const tokenAddress = await newToken.getAddress();
      const tokenSymbol = await newToken.symbol();

      await llaVault.connect(tokenManager).addSupportedToken(tokenAddress);
      await expect(
        llaVault.connect(tokenManager).removeSupportedToken(tokenAddress)
      )
        .to.emit(llaVault, "TokenRemoved")
        .withArgs(tokenAddress, tokenSymbol);

      expect(await llaVault.supportCoins(tokenAddress)).to.equal("");
    });

    it("Adding tokens by a non-token admin should revert.", async function () {
      const tokenAddress = await mockToken.getAddress();

      await expect(llaVault.connect(addr1).addSupportedToken(tokenAddress))
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.TOKEN_MANAGER_ROLE());
    });

    it("Removing tokens by a non-token admin should revert.", async function () {
      const tokenAddress = await mockToken2.getAddress();

      await expect(llaVault.connect(addr1).removeSupportedToken(tokenAddress))
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.TOKEN_MANAGER_ROLE());
    });

    it("Adding a zero address token should revert.", async function () {
      await expect(
        llaVault.connect(tokenManager).addSupportedToken(ethers.ZeroAddress)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("Adding tokens when the contract is paused should revert.", async function () {
      const newToken = (await upgrades.deployProxy(
        LLAXTokenFactory,
        [owner.address, pauser.address, minter.address, upgrader.address],
        {
          kind: "uups",
          initializer: "initialize",
        }
      )) as LLAXToken;
      await newToken.waitForDeployment();

      await llaVault.connect(pauser).pause();

      await expect(
        llaVault.connect(tokenManager).addSupportedToken(newToken.target)
      ).to.be.revertedWithCustomError(llaVault, "EnforcedPause");

      await llaVault.connect(pauser).unpause();
    });

    it("Removing tokens when the contract is paused should revert.", async function () {
      const tokenAddress = await mockToken2.getAddress();

      await llaVault.connect(pauser).pause();

      await expect(
        llaVault.connect(tokenManager).removeSupportedToken(tokenAddress)
      ).to.be.revertedWithCustomError(llaVault, "EnforcedPause");

      await llaVault.connect(pauser).unpause();
    });
  });

  describe("Deposit testing.", function () {
    beforeEach(async function () {
      // Ensure the token is added to the supported list.
      const tokenAddress = await mockToken.getAddress();
      try {
        await llaVault.connect(tokenManager).addSupportedToken(tokenAddress);
      } catch (error) {
        // If the token is already in the supported list, ignore the error.
      }

      // Mint some tokens to the test account.
      await mockToken
        .connect(minter)
        .mint(addr1.address, ethers.parseEther("1000"));
      await mockToken
        .connect(minter)
        .mint(addr2.address, ethers.parseEther("1000"));

      // Ensure the contract is not paused.
      if (await llaVault.paused()) {
        await llaVault.connect(pauser).unpause();
      }

      // Ensure the vault contract has minting permissions.
      try {
        await mockToken
          .connect(owner)
          .addRole(await mockToken.MINTER_ROLE(), VaultProxyAddress);
      } catch (error) {
        // If the permissions are already granted, ignore the error.
      }
    });

    it("Depositing when paused should revert.", async function () {
      const depositAmount = ethers.parseEther("100");
      const tokenAddress = await mockToken.getAddress();

      // Approve the vault contract to spend tokens.
      await mockToken.connect(addr1).approve(VaultProxyAddress, depositAmount);

      // Pause the contract.
      await llaVault.connect(pauser).pause();

      // Expect the deposit to revert.
      await expect(
        llaVault.connect(addr1).deposit(tokenAddress, depositAmount)
      ).to.be.revertedWithCustomError(llaVault, "EnforcedPause");

      // Unpause the contract for cleanup.
      await llaVault.connect(pauser).unpause();
    });

    it("Depositing zero amount should revert.", async function () {
      const tokenAddress = await mockToken.getAddress();

      await expect(llaVault.connect(addr1).deposit(tokenAddress, 0))
        .to.be.revertedWithCustomError(llaVault, "InvalidAmount")
        .withArgs(0);
    });

    it("Depositing an unsupported token should revert.", async function () {
      const unsupportedTokenAddress =
        "0x1234567890123456789012345678901234567890";

      await expect(
        llaVault.connect(addr1).deposit(unsupportedTokenAddress, 100)
      )
        .to.be.revertedWithCustomError(llaVault, "UnsupportedToken")
        .withArgs(unsupportedTokenAddress);
    });

    it("Depositing when the contract is paused should revert.", async function () {
      const depositAmount = ethers.parseEther("100");
      const tokenAddress = await mockToken.getAddress();

      await mockToken.connect(addr1).approve(VaultProxyAddress, depositAmount);
      await llaVault.connect(pauser).pause();

      await expect(
        llaVault.connect(addr1).deposit(tokenAddress, depositAmount)
      ).to.be.revertedWithCustomError(llaVault, "EnforcedPause");

      await llaVault.connect(pauser).unpause();
    });

    it("Depositing when the user has insufficient balance should revert.", async function () {
      const depositAmount = ethers.parseEther("1000000000000000049000"); // Exceeds user balance
      const tokenAddress = await mockToken.getAddress();
      await mockToken.connect(addr1).approve(VaultProxyAddress, depositAmount);
      await expect(llaVault.connect(addr1).deposit(tokenAddress, depositAmount))
        .to.be.reverted; // Insufficient ERC20 balance will cause a revert.
    });

    it("Depositing when the tokens are not sufficiently approved should revert.", async function () {
      const depositAmount = ethers.parseEther("100");
      const approveAmount = ethers.parseEther("50"); // The approved amount is less than the deposit amount.
      const tokenAddress = await mockToken.getAddress();

      await mockToken.connect(addr1).approve(VaultProxyAddress, approveAmount);

      await expect(llaVault.connect(addr1).deposit(tokenAddress, depositAmount))
        .to.be.reverted; // Insufficient approval amount will cause a revert.
    });

    it("Multiple deposits should be handled.", async function () {
      const depositAmount = ethers.parseEther("10");
      const tokenAddress = await mockToken.getAddress();
      const iterations = 3;

      // Approve the vault contract to spend tokens.
      await mockToken
        .connect(addr1)
        .approve(VaultProxyAddress, depositAmount * BigInt(iterations));

      // Perform multiple deposits.
      for (let i = 0; i < iterations; i++) {
        await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);
      }

      // Verify the number of payment records.
      const paymentCount = await getPaymentCount(addr1.address);
      expect(paymentCount).to.be.at.least(iterations);

      // Verify the last payment record.
      const lastPaymentIndex = paymentCount - 1n;
      const lastPayment = await llaVault.payments(
        addr1.address,
        lastPaymentIndex
      );
      expect(lastPayment.amount).to.equal(depositAmount);
    });

    it("Reentrancy attacks should be prevented.", async function () {
      // This test requires deploying a malicious contract to test reentrancy protection.
      // This is a conceptual test to verify the existence of the reentrancy flag.

      const depositAmount = ethers.parseEther("100");
      const tokenAddress = await mockToken.getAddress();

      // Approve the vault contract to spend tokens.
      await mockToken.connect(addr1).approve(VaultProxyAddress, depositAmount);

      // Deposit tokens.

      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);
      // TODO Verify
      // Verify that the reentrancy protection is effective.
      // Note: This is just a conceptual test. In practice, a more complex setup is required.
    });
    // TODO Verify the cases
    it("should correctly calculate and allocate deposit amounts to multisig address and vault contract, and mint corresponding tokens to user address", async function () {
      await mockToken2
        .connect(minter)
        .mint(addr1.address, ethers.parseEther("10000"));
      // Minted LLAX before deposit
      const mintBeforeBalance = await mockToken.balanceOf(addr1.address);
      // Vault initial balance (LLAX Token)
      const selfBalanceBefore = await mockToken2.balanceOf(VaultProxyAddress);
      // Multisig address initial balance (LLAX Token)
      const multiSigBalanceBefore = await mockToken2.balanceOf(
        multiSig.address
      );

      // User initial balance mockToken
      const userBalanceBefore = await mockToken2.balanceOf(addr1.address);
      const depositAmount = ethers.parseEther("100");

      // Approve and deposit
      await mockToken2.connect(addr1).approve(VaultProxyAddress, depositAmount);
      await llaVault
        .connect(addr1)
        .deposit(await mockToken2.getAddress(), depositAmount);

      // Vault initial balance (LLAX Token)
      const selfBalanceAfter = await mockToken2.balanceOf(VaultProxyAddress);
      // Multisig address initial balance (LLAX Token)
      const multiSigBalanceAfter = await mockToken2.balanceOf(multiSig.address);
      const mintAfterBalance = await mockToken.balanceOf(addr1.address);
      // User initial balance mockToken
      const userBalanceAfter = await mockToken2.balanceOf(addr1.address);
      // Calculate expected allocation amounts
      const expectedMultiSigAmount =
        (depositAmount * BigInt(fundingRate)) / BigInt(100);
      const expectedSelfAmount =
        (depositAmount * (BigInt(100) - BigInt(fundingRate))) / BigInt(100);
      const expectedMintAmount =
        (depositAmount * BigInt(mintingRate)) / BigInt(100);

      // Verify the amount received by the multisig address

      expect(multiSigBalanceAfter - multiSigBalanceBefore).to.equal(
        expectedMultiSigAmount
      );
      // Verify the amount received by the vault contract
      expect(selfBalanceAfter - selfBalanceBefore).to.equal(expectedSelfAmount);

      // Verify the user's token balance after deposit
      expect(userBalanceBefore - depositAmount).to.equal(userBalanceAfter);
      // Verify the minted LLA tokens received by the user

      expect(mintBeforeBalance + expectedMintAmount).to.equal(mintAfterBalance);
    });

    it("should correctly trigger PaymentDeposited and MintToAddress events", async function () {
      const depositAmount = ethers.parseEther("50");
      const tokenAddress = await mockToken.getAddress();
      // Calculate expected minted amount
      const expectedMintAmount =
        (depositAmount * BigInt(mintingRate)) / BigInt(100);
      // Approve
      await mockToken.connect(addr1).approve(VaultProxyAddress, depositAmount);
      // Verify event triggers
      await expect(llaVault.connect(addr1).deposit(tokenAddress, depositAmount))
        .to.emit(llaVault, "PaymentDeposited")
        .withArgs(addr1.address, anyValue, depositAmount, tokenAddress)
        .and.to.emit(llaVault, "MintToAddress")
        .withArgs(addr1.address, expectedMintAmount);
    });

    it("should correctly handle deposits under reentrancy protection", async function () {
      const depositAmount = ethers.parseEther("25");
      const tokenAddress = await mockToken.getAddress();
      // Approve
      await mockToken
        .connect(addr1)
        .approve(VaultProxyAddress, depositAmount * BigInt(2));
      // First deposit
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);
      // Immediately perform a second deposit, verify reentrancy protection does not affect normal operation
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);
      // Verify both deposits are recorded
      const paymentCount = await getPaymentCount(addr1.address);
      expect(paymentCount).to.be.at.least(2);
      // Verify the last two payment records
      const payment1 = await llaVault.payments(
        addr1.address,
        paymentCount - 2n
      );
      const payment2 = await llaVault.payments(
        addr1.address,
        paymentCount - 1n
      );
      expect(payment1.amount).to.equal(depositAmount);
      expect(payment2.amount).to.equal(depositAmount);
    });
    it("should correctly handle amounts that cannot be divided by 100", async function () {
      const amount = ethers.parseEther("0.01") + 1n; // 0.01 ETH + 1 wei, ensure it cannot be divided by 100
      const tokenAddress = await USDCToken.getAddress();
      // Mint some small amount of tokens
      await USDCToken.connect(minter).mint(
        addr1.address,
        ethers.parseEther("100000")
      );
      // Calculate expected minted amount (using rounding)
      const expectedMintAmount = (amount * BigInt(mintingRate) + 50n) / 100n;

      // Approve and deposit
      await USDCToken.connect(addr1).approve(VaultProxyAddress, amount);

      // Record balance before deposit
      const balanceBefore = await mockToken.balanceOf(addr1.address);

      // Execute deposit
      await llaVault.connect(addr1).deposit(tokenAddress, amount);

      // Verify the minted amount
      const balanceAfter = await mockToken.balanceOf(addr1.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedMintAmount);
    });
    it("should correctly handle deposits with very small amounts", async function () {
      // Use a very small amount, which may result in a minted amount of 0
      const tinyAmount = 1n;
      const tokenAddress = await USDCToken.getAddress();

      // Calculate the expected minted amount
      const expectedMintAmount =
        (tinyAmount * BigInt(mintingRate) + 50n) / 100n;

      // Mint some small amount of tokens
      await USDCToken.connect(minter).mint(addr1.address, tinyAmount);

      // Approve and deposit
      await USDCToken.connect(addr1).approve(VaultProxyAddress, tinyAmount);

      // Record balance before deposit
      const balanceBefore = await mockToken.balanceOf(addr1.address);

      // Execute deposit
      await llaVault.connect(addr1).deposit(tokenAddress, tinyAmount);

      // Verify the minted amount
      const balanceAfter = await mockToken.balanceOf(addr1.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedMintAmount);
    });
    it("should correctly handle deposit precision for large amounts", async function () {
      // Use a large amount, but ensure it cannot be divided by 100
      const largeAmount = ethers.parseEther("1000000") + 1n;
      const tokenAddress = await USDCToken.getAddress();

      // Calculate expected minted amount
      const expectedMintAmount =
        (largeAmount * BigInt(mintingRate) + 50n) / 100n;

      // Mint a large amount of tokens
      await USDCToken.connect(minter).mint(addr1.address, largeAmount);

      // Approve and deposit
      await USDCToken.connect(addr1).approve(VaultProxyAddress, largeAmount);

      // Record balance before deposit
      const balanceBefore = await mockToken.balanceOf(addr1.address);

      // Execute deposit
      await llaVault.connect(addr1).deposit(tokenAddress, largeAmount);

      // Verify the minted amount
      const balanceAfter = await mockToken.balanceOf(addr1.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedMintAmount);
    });
    it("should correctly handle deposits with low precision tokens", async function () {
      // Use an amount that cannot be divided by 100
      const amount = 1000001n; // 1.000001 USDC (6 decimal places)

      // Calculate expected minted amount
      const expectedMintAmount = (amount * BigInt(mintingRate) + 50n) / 100n;

      // Mint tokens
      await USDCToken.connect(minter).mint(addr1.address, amount);

      // Approve and deposit
      await USDCToken.connect(addr1).approve(VaultProxyAddress, amount);

      // Record balance before deposit
      const balanceBefore = await mockToken.balanceOf(addr1.address);

      // Execute deposit
      await llaVault
        .connect(addr1)
        .deposit(await USDCToken.getAddress(), amount);

      // Verify the minted amount
      const balanceAfter = await mockToken.balanceOf(addr1.address);
      expect(balanceAfter - balanceBefore).to.equal(expectedMintAmount);
    });
    it("should verify the correctness of rounding", async function () {
      // Test rounding edge cases
      const testCases = [
        { amount: 49n, expectedMint: 29n }, // 49 * 60% = 29.4, rounded to 29
        { amount: 50n, expectedMint: 30n }, // 50 * 60% = 30, rounded to 30
        { amount: 51n, expectedMint: 31n }, // 51 * 60% = 30.6, rounded to 31
        { amount: 99n, expectedMint: 59n }, // 99 * 60% = 59.4, rounded to 59
        { amount: 100n, expectedMint: 60n }, // 100 * 60% = 60, rounded to 60
        { amount: 101n, expectedMint: 61n }, // 101 * 60% = 60.6, rounded to 61
      ];

      const tokenAddress = await USDCToken.getAddress();

      for (const testCase of testCases) {
        // Mint tokens
        await USDCToken.connect(minter).mint(addr1.address, testCase.amount);

        // Approve and deposit
        await USDCToken.connect(addr1).approve(
          VaultProxyAddress,
          testCase.amount
        );

        // Record balance before deposit
        const balanceBefore = await mockToken.balanceOf(addr1.address);
        // Execute deposit
        await llaVault.connect(addr1).deposit(tokenAddress, testCase.amount);

        // Verify the minted amount
        const balanceAfter = await mockToken.balanceOf(addr1.address);
        expect(balanceAfter - balanceBefore).to.equal(
          testCase.expectedMint,
          `Amount ${testCase.amount} should mint ${testCase.expectedMint} tokens`
        );
      }
    });
  });

  describe("Test updating the LLA token address.", function () {
    it("should revert when updating the LLA token address to zero address", async function () {
      await expect(
        llaVault.connect(tokenManager).updateToken(ethers.ZeroAddress)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });
    it("Updating the LLA token address should be allowed.", async function () {
      const newTokenAddress = await mockToken2.getAddress();

      await expect(llaVault.connect(tokenManager).updateToken(newTokenAddress))
        .to.emit(llaVault, "TokenUpdated")
        .withArgs(newTokenAddress);

      expect(await llaVault.token()).to.equal(newTokenAddress);

      // Restore the original settings.
      const originalTokenAddress = await mockToken.getAddress();
      await llaVault.connect(tokenManager).updateToken(originalTokenAddress);
    });

    it("Updating the LLA token address by a non-token admin should revert.", async function () {
      const newTokenAddress = await mockToken2.getAddress();

      await expect(llaVault.connect(addr1).updateToken(newTokenAddress))
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.TOKEN_MANAGER_ROLE());
    });

    it("Updating to the zero address should revert.", async function () {
      await expect(
        llaVault.connect(tokenManager).updateToken(ethers.ZeroAddress)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("Updating the LLA token address when the contract is paused should succeed.", async function () {
      const newTokenAddress = await mockToken2.getAddress();

      await llaVault.connect(pauser).pause();

      await llaVault.connect(tokenManager).updateToken(newTokenAddress);
      expect(await llaVault.token()).to.equal(newTokenAddress);

      // Restore the original settings.
      const originalTokenAddress = await mockToken.getAddress();
      await llaVault.connect(tokenManager).updateToken(originalTokenAddress);
      await llaVault.connect(pauser).unpause();
    });
  });

  describe("Payment Record Query Tests", function () {
    beforeEach(async function () {
      // Ensure the token is added to the supported list.
      const tokenAddress = await mockToken.getAddress();
      try {
        await llaVault.connect(tokenManager).addSupportedToken(tokenAddress);
      } catch (error) {
        // If the token is already in the supported list, ignore the error.
      }

      // Mint some tokens to the test account.
      await mockToken
        .connect(minter)
        .mint(addr1.address, ethers.parseEther("1000"));

      // Ensure the contract is not paused.
      if (await llaVault.paused()) {
        await llaVault.connect(pauser).unpause();
      }

      // Ensure the vault contract has minting permissions.
      try {
        await mockToken
          .connect(owner)
          .addRole(await mockToken.MINTER_ROLE(), VaultProxyAddress);
      } catch (error) {
        // If the permissions are already granted, ignore the error.
      }
    });

    it("should correctly record and query payment records", async function () {
      const depositAmount = ethers.parseEther("100");
      const tokenAddress = await mockToken.getAddress();

      // Get the current number of payment records
      const initialPaymentCount = await getPaymentCount(addr1.address);

      // Approve the vault contract to spend tokens
      await mockToken.connect(addr1).approve(VaultProxyAddress, depositAmount);

      // Deposit
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);

      // Verify the number of payment records has increased
      const newPaymentCount = await getPaymentCount(addr1.address);
      expect(newPaymentCount).to.equal(initialPaymentCount + 1n);

      // Verify the content of the payment records
      const payment = await llaVault.getPaymentsByPage(1, 2, addr1.address);
      // Verify payment records
      for (let i = 0; i < payment.data.length; i++) {
        expect(payment.data[i][0]).to.equal(addr1.address);
        expect(payment.data[i][3]).to.equal(tokenAddress);
      }
    });

    it("should be able to query multiple payment records", async function () {
      const depositAmount1 = ethers.parseEther("50");
      const depositAmount2 = ethers.parseEther("75");
      const tokenAddress = await mockToken.getAddress();

      // Get the current number of payment records
      const initialPaymentCount = await getPaymentCount(addr1.address);

      // Approve the vault contract to spend tokens
      await mockToken
        .connect(addr1)
        .approve(VaultProxyAddress, depositAmount1 + depositAmount2);

      // Perform two deposits
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount1);
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount2);

      // Verify the number of payment records has increased
      const newPaymentCount = await getPaymentCount(addr1.address);
      expect(newPaymentCount).to.equal(initialPaymentCount + 2n);

      // Verify the first payment record
      const payment1 = await llaVault.payments(
        addr1.address,
        initialPaymentCount
      );
      expect(payment1.amount).to.equal(depositAmount1);

      // Verify the second payment record
      const payment2 = await llaVault.payments(
        addr1.address,
        initialPaymentCount + 1n
      );
      expect(payment2.amount).to.equal(depositAmount2);
    });

    it("querying non-existent payment records should return empty records", async function () {
      // Query non-existent payment records
      const payment = await llaVault.getPaymentsByPage(3, 10, addr2.address);

      const nonExistentIndex = await getPaymentCount(addr2.address);
      // Verify empty records are returned
      expect(payment.data.length).to.equal(0);
      expect(payment.total).to.equal(0);
      expect(nonExistentIndex).to.equal(0);
    });
  });

  describe("Multi-signature Address Update Tests", function () {
    it("should revert when updating the multi-signature address to zero address", async function () {
      await expect(llaVault.connect(owner).updateMultiSig(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });
    it("should allow updating the multi-signature address", async function () {
      const newMultiSig = addr3.address;

      await expect(llaVault.connect(owner).updateMultiSig(newMultiSig))
        .to.emit(llaVault, "MultiSigUpdated")
        .withArgs(newMultiSig);

      expect(await llaVault.multiSig()).to.equal(newMultiSig);

      // Restore original settings
      await llaVault.connect(owner).updateMultiSig(multiSig.address);
    });

    it("should revert when a non-admin tries to update the multi-signature address", async function () {
      const newMultiSig = addr3.address;

      await expect(llaVault.connect(addr1).updateMultiSig(newMultiSig))
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.ADMIN_ROLE());
    });

    it("should revert when updating to the zero address", async function () {
      await expect(llaVault.connect(owner).updateMultiSig(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("should succeed in updating the multi-signature address when the contract is paused", async function () {
      const newMultiSig = addr3.address;

      await llaVault.connect(pauser).pause();

      await llaVault.connect(owner).updateMultiSig(newMultiSig);
      expect(await llaVault.multiSig()).to.equal(newMultiSig);

      // Restore original settings
      await llaVault.connect(owner).updateMultiSig(multiSig.address);
      await llaVault.connect(pauser).unpause();
    });
  });

  describe("Upgrade Tests", function () {
    // Deploy a new version of the contract for upgrade testing
    let NewLLAVaultFactory: ContractFactory;

    before(async function () {
      // Create a new version of the contract factory
      NewLLAVaultFactory = await ethers.getContractFactory(
        "NewLLAVaultBase",
        upgrader
      );
    });

    it("should upgrade the contract", async function () {
      // Verify the initial version
      expect(await llaVault.version()).to.equal("v1.0");

      // Upgrade the contract
      const upgradedContract = (await upgrades.upgradeProxy(
        await llaVault.getAddress(),
        NewLLAVaultFactory,
        { kind: "uups" }
      )) as LLAVaultBase;
      await upgradedContract.waitForDeployment();

      // Verify the new version
      expect(await upgradedContract.version()).to.equal("v2.0");

      // Restore the original version
      const LLAVaultFactory = await ethers.getContractFactory(
        "LLAVaultBase",
        upgrader
      );
      await upgrades.upgradeProxy(VaultProxyAddress, LLAVaultFactory, {
        kind: "uups",
      });
    });

    it("should revert when a non-upgrader tries to upgrade", async function () {
      const NewLLAVaultFactoryWithNonUpgrader = await ethers.getContractFactory(
        "NewLLAVaultBase",
        addr1
      );

      await expect(
        upgrades.upgradeProxy(
          VaultProxyAddress,
          NewLLAVaultFactoryWithNonUpgrader,
          { kind: "uups" }
        )
      )
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.UPGRADER_ROLE());
    });

    it("should maintain state after upgrade", async function () {
      // Record the current state
      const originalLLAToken = await llaVault.token();
      const originalMultiSig = await llaVault.multiSig();
      const NewLLAVaultFactory2 = await ethers.getContractFactory(
        "NewLLAVaultBase",
        upgrader
      );
      // Upgrade the contract
      const upgradedContract = (await upgrades.upgradeProxy(
        VaultProxyAddress,
        NewLLAVaultFactory2,
        { kind: "uups" }
      )) as LLAVaultBase;

      // Verify the state remains unchanged
      expect(await upgradedContract.token()).to.equal(originalLLAToken);
      expect(await upgradedContract.multiSig()).to.equal(originalMultiSig);

      // Restore the original version
      const LLAVaultFactory = await ethers.getContractFactory(
        "LLAVaultBase",
        upgrader
      );
      await upgrades.upgradeProxy(VaultProxyAddress, LLAVaultFactory, {
        kind: "uups",
      });
    });
  });

  describe("Boundary Condition Tests", function () {
    beforeEach(async function () {
      // Ensure the token is added to the supported list
      const tokenAddress = await mockToken.getAddress();
      try {
        await llaVault.connect(tokenManager).addSupportedToken(tokenAddress);
      } catch (error) {
        // If the token is already in the supported list, ignore the error
      }

      // Mint some tokens to the test account
      await mockToken
        .connect(minter)
        .mint(addr1.address, ethers.parseEther("1000000"));

      // Ensure the contract is not paused
      if (await llaVault.paused()) {
        await llaVault.connect(pauser).unpause();
      }

      // Ensure the vault contract has minting permissions
      try {
        await mockToken
          .connect(owner)
          .addRole(await mockToken.MINTER_ROLE(), VaultProxyAddress);
      } catch (error) {
        // If the permissions are already granted, ignore the error
      }
    });

    it("should handle large amount deposits", async function () {
      const largeAmount = ethers.parseEther("1000000"); // 1 million tokens
      const tokenAddress = await mockToken.getAddress();

      // Approve the vault contract to spend tokens
      await mockToken.connect(addr1).approve(VaultProxyAddress, largeAmount);

      // Deposit
      await llaVault.connect(addr1).deposit(tokenAddress, largeAmount);

      // Verify the payment record
      const paymentCount = await getPaymentCount(addr1.address);
      const payment = await llaVault.payments(addr1.address, paymentCount - 1n);
      expect(payment.amount).to.equal(largeAmount);
    });

    it("should handle multiple deposits", async function () {
      const amount = ethers.parseEther("10");
      const iterations = 10;
      const tokenAddress = await mockToken.getAddress();

      // Approve the vault contract to spend tokens
      await mockToken
        .connect(addr1)
        .approve(VaultProxyAddress, amount * BigInt(iterations));

      // Perform multiple deposits
      for (let i = 0; i < iterations; i++) {
        await llaVault.connect(addr1).deposit(tokenAddress, amount);
      }

      // Verify the number of payment records
      const paymentCount = await getPaymentCount(addr1.address);
      expect(paymentCount).to.be.at.least(iterations);
    });
  });

  describe("Event Tests", function () {
    beforeEach(async function () {
      // Ensure the token is added to the supported list
      const tokenAddress = await mockToken.getAddress();
      try {
        await llaVault.connect(tokenManager).addSupportedToken(tokenAddress);
      } catch (error) {
        // If the token is already in the supported list, ignore the error
      }

      // Mint some tokens to the test account
      await mockToken
        .connect(minter)
        .mint(addr1.address, ethers.parseEther("1000"));

      // Ensure the contract is not paused
      if (await llaVault.paused()) {
        await llaVault.connect(pauser).unpause();
      }

      // Ensure the vault contract has minting permissions
      try {
        await mockToken
          .connect(owner)
          .addRole(await mockToken.MINTER_ROLE(), VaultProxyAddress);
      } catch (error) {
        // If the permissions are already granted, ignore the error
      }
    });

    it("should emit the Paused event", async function () {
      await expect(llaVault.connect(pauser).pause())
        .to.emit(llaVault, "Paused")
        .withArgs(pauser.address);

      await llaVault.connect(pauser).unpause();
    });

    it("should emit the Unpaused event", async function () {
      await llaVault.connect(pauser).pause();

      await expect(llaVault.connect(pauser).unpause())
        .to.emit(llaVault, "Unpaused")
        .withArgs(pauser.address);
    });

    it("should emit the RoleGranted event", async function () {
      const TOKEN_MANAGER_ROLE = await llaVault.TOKEN_MANAGER_ROLE();

      await expect(
        llaVault.connect(owner).addRole(TOKEN_MANAGER_ROLE, addr3.address)
      )
        .to.emit(llaVault, "RoleGranted")
        .withArgs(TOKEN_MANAGER_ROLE, addr3.address, owner.address);

      // Cleanup
      await llaVault
        .connect(owner)
        .revokeRole(TOKEN_MANAGER_ROLE, addr3.address);
    });

    it("should emit the RoleRevoked event", async function () {
      const TOKEN_MANAGER_ROLE = await llaVault.TOKEN_MANAGER_ROLE();

      // Grant the role first
      await llaVault.connect(owner).addRole(TOKEN_MANAGER_ROLE, addr3.address);

      await expect(
        llaVault.connect(owner).revokeRole(TOKEN_MANAGER_ROLE, addr3.address)
      )
        .to.emit(llaVault, "RoleRevoked")
        .withArgs(TOKEN_MANAGER_ROLE, addr3.address, owner.address);
    });
  });

  /**
   * @notice Helper function to get the number of payment records.
   * @param address Helper function to get the number of payment records.
   * @returns
   */
  async function getPaymentCount(address: string) {
    return await llaVault.getPaymentCount(address);
  }
});
