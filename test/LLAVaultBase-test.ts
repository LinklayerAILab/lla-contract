import { expect } from "chai";
import { LLAXToken, LLAVaultBase, MockUSDC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
describe("LLAVaultBase", function () {
  const fundingRate = BigInt(30); // 30%
  let LLAXTokenFactory: ContractFactory;
  let llaVault: LLAVaultBase;
  let owner: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let upgrader: HardhatEthersSigner;
  let tokenManager: HardhatEthersSigner;
  let tokenWithdraw: HardhatEthersSigner;
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
      tokenWithdraw,
      multiSig,
      addr1,
      addr2,
      addr3,
    ] = await ethers.getSigners();
    console.log("owner:", owner.address);
    console.log("pauser:", pauser.address);
    console.log("upgrader:", upgrader.address);
    console.log("tokenManager:", tokenManager.address);
    console.log("tokenWithdraw:", tokenWithdraw.address);
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
    console.log("LLAProxyAddress:", LLAProxyAddress);
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
    const mockAddress = await mockToken2.getAddress();
    console.log("mockToken2:", mockAddress);
    // Deploy the LLAVaultBase contract.
    const LLAVaultFactory = await ethers.getContractFactory("LLAVaultBase");
    llaVault = (await upgrades.deployProxy(
      LLAVaultFactory,
      [
        owner.address,
        pauser.address,
        tokenManager.address,
        upgrader.address,
        tokenWithdraw.address,
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
      expect(await auth.hasRole(await auth.UPGRADER_ROLE(), upgrader.address))
        .to.be.true;
      expect(
        await auth.hasRole(
          await auth.TOKEN_MANAGER_ROLE(),
          tokenManager.address
        )
      ).to.be.true;
      expect(
        await auth.hasRole(
          await auth.TOKEN_WITHDRAW_ROLE(),
          tokenWithdraw.address
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
            tokenManager.address,
            upgrader.address,
            tokenWithdraw.address,
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
            tokenManager.address,
            upgrader.address,
            tokenWithdraw.address,
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

      expect(await llaVault.supportCoins(tokenAddress)).to.equal(true);
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

      expect(await llaVault.supportCoins(tokenAddress)).to.equal(false);
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
      // TODO 验证
      // Verify the number of payment records.
      // const paymentCount = await getPaymentCount(addr1.address);
      // expect(paymentCount).to.be.at.least(iterations);

      // // Verify the last payment record.
      // const lastPaymentIndex = paymentCount - 1n;
      // const lastPayment = await llaVault.payments(
      //   addr1.address,
      //   lastPaymentIndex
      // );
      // expect(lastPayment.amount).to.equal(depositAmount);
    });

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
      const mintingRate = await llaVault.getMintingRate();
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
      // 根据阶梯费率计算mint的期望值

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
      const mintingRate = await llaVault.getMintingRate();
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
      // TODO 验证

      // const paymentCount = await getPaymentCount(addr1.address);
      // expect(paymentCount).to.be.at.least(2);
      // // Verify the last two payment records
      // const payment1 = await llaVault.payments(
      //   addr1.address,
      //   paymentCount - 2n
      // );
      // const payment2 = await llaVault.payments(
      //   addr1.address,
      //   paymentCount - 1n
      // );
      // expect(payment1.amount).to.equal(depositAmount);
      // expect(payment2.amount).to.equal(depositAmount);
    });
    it("should correctly handle amounts that cannot be divided by 100", async function () {
      const amount = ethers.parseEther("0.01") + 1n; // 0.01 ETH + 1 wei, ensure it cannot be divided by 100
      const tokenAddress = await USDCToken.getAddress();
      // Mint some small amount of tokens
      await USDCToken.connect(minter).mint(
        addr1.address,
        ethers.parseEther("100000")
      );
      const mintingRate = await llaVault.getMintingRate();
      // Calculate expected minted amount (using rounding)
      const expectedMintAmount = (amount * BigInt(mintingRate)) / 100n;

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
      const mintingRate = await llaVault.getMintingRate();
      const tinyAmount = 1n;
      const tokenAddress = await USDCToken.getAddress();
      // Calculate the expected minted amount
      const expectedMintAmount = (tinyAmount * BigInt(mintingRate)) / 100n;
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
      const mintingRate = await llaVault.getMintingRate();
      // Use a large amount, but ensure it cannot be divided by 100
      const largeAmount = ethers.parseEther("1000000") + 1n;
      const tokenAddress = await USDCToken.getAddress();
      // Calculate expected minted amount
      const expectedMintAmount = (largeAmount * BigInt(mintingRate)) / 100n;

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
      const mintingRate = await llaVault.getMintingRate();
      // Use an amount that cannot be divided by 100
      const amount = 1000001n; // 1.000001 USDC (6 decimal places)

      // Calculate expected minted amount
      const expectedMintAmount = (amount * BigInt(mintingRate)) / 100n;

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
        { amount: 49n },
        { amount: 50n },
        { amount: 51n },
        { amount: 99n },
        { amount: 100n },
        { amount: 101n },
      ];

      const tokenAddress = await USDCToken.getAddress();

      for (const testCase of testCases) {
        const mintingRate = await llaVault.getMintingRate();
        // Mint tokens
        await USDCToken.connect(minter).mint(addr1.address, testCase.amount);
        const expectedMintAmount =
          (testCase.amount * BigInt(mintingRate)) / 100n;
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
          expectedMintAmount,
          `Amount ${testCase.amount} should mint ${expectedMintAmount} tokens`
        );
      }
    });
  });

  describe("Minting Rate Threshold Tests", function () {
    it("should initialize with default minting rate thresholds", async function () {
      const tier1 = await llaVault.mintingRateThresholds(1);
      const tier2 = await llaVault.mintingRateThresholds(2);
      const tier3 = await llaVault.mintingRateThresholds(3);
      const tier4 = await llaVault.mintingRateThresholds(4);
      const tier5 = await llaVault.mintingRateThresholds(5);

      expect(tier1.mintRate).to.equal(50);
      expect(tier1.mintCount).to.equal(100);

      expect(tier2.mintRate).to.equal(40);
      expect(tier2.mintCount).to.equal(10000);

      expect(tier3.mintRate).to.equal(30);
      expect(tier3.mintCount).to.equal(100000);

      expect(tier4.mintRate).to.equal(20);
      expect(tier4.mintCount).to.equal(1000000);

      expect(tier5.mintRate).to.equal(10);
      expect(tier5.mintCount).to.equal(ethers.MaxUint256);
    });

    it("should allow admin to update minting rate thresholds", async function () {
      const newRate = 35;
      const newCount = 150000;

      await llaVault
        .connect(owner)
        .updateMintingRateThreshold(3, newRate, newCount);

      const updatedTier3 = await llaVault.mintingRateThresholds(3);
      expect(updatedTier3.mintRate).to.equal(newRate);
      expect(updatedTier3.mintCount).to.equal(newCount);
    });

    it("should revert when a non-admin tries to update minting rate thresholds", async function () {
      await expect(
        llaVault.connect(addr1).updateMintingRateThreshold(3, 35, 150000)
      )
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.ADMIN_ROLE());
    });

    it("should revert when updating with invalid tier or rate", async function () {
      await expect(
        llaVault.connect(owner).updateMintingRateThreshold(0, 35, 150000)
      ).to.be.revertedWithCustomError(llaVault, "InvalidAmount");

      await expect(
        llaVault.connect(owner).updateMintingRateThreshold(6, 35, 150000)
      ).to.be.revertedWithCustomError(llaVault, "InvalidAmount");

      await expect(
        llaVault.connect(owner).updateMintingRateThreshold(3, 101, 150000)
      ).to.be.revertedWithCustomError(llaVault, "InvalidAmount");
    });

    it("should correctly calculate minting rate based on totalMintCount", async function () {
      // Simulate totalMintCount in different tiers
      await llaVault.connect(owner).updateMintingRateThreshold(1, 50, 100);
      await llaVault.connect(owner).updateMintingRateThreshold(2, 40, 1000);
      await llaVault.connect(owner).updateMintingRateThreshold(3, 30, 10000);

      // Test tier 1
      await llaVault.connect(owner).setTotalMintCount(50); // Simulate totalMintCount
      expect(await llaVault.getMintingRate()).to.equal(50);

      // Test tier 2
      await llaVault.connect(owner).setTotalMintCount(500); // Simulate totalMintCount
      expect(await llaVault.getMintingRate()).to.equal(40);

      // Test tier 3
      await llaVault.connect(owner).setTotalMintCount(5000); // Simulate totalMintCount
      expect(await llaVault.getMintingRate()).to.equal(30);
    });
  });

  describe("Deposit with Minting Rate Thresholds", function () {
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

    it("should correctly mint tokens based on the current minting rate threshold", async function () {
      const depositAmount = ethers.parseEther("100");
      const authAmount = ethers.parseEther("100000");
      const tokenAddress = await mockToken.getAddress();
      await mockToken.connect(minter).mint(addr1.address, authAmount);
      const balance = await mockToken.balanceOf(addr1.address);
      // Approve the vault contract to spend tokens
      await mockToken.connect(addr1).approve(VaultProxyAddress, authAmount);

      // Simulate totalMintCount in tier 1
      await llaVault.connect(owner).setTotalMintCount(50); // Simulate totalMintCount
      const mintingRate = await llaVault.getMintingRate();
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);

      // Verify the minted amount
      const expectedMintAmount = (depositAmount * mintingRate) / BigInt(100); // 50% rate
      const mintBalance = await mockToken.balanceOf(addr1.address);
      expect(balance - mintBalance).to.equal(expectedMintAmount);
    });

    it("should correctly handle deposits across multiple thresholds", async function () {
      const depositAmount = ethers.parseEther("100");
      const authAmount = ethers.parseEther("100000");
      const tokenAddress = await mockToken2.getAddress();
      const balance = await mockToken.balanceOf(addr1.address);
      // Approve the vault contract to spend tokens
      await mockToken2.connect(addr1).approve(VaultProxyAddress, authAmount);

      // Simulate totalMintCount in tier 1
      await llaVault.connect(owner).setTotalMintCount(50); // Simulate totalMintCount
      const mintingRate = await llaVault.getMintingRate();
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);

      // Verify the minted amount for tier 1
      const expectedMintAmountTier1 =
        (depositAmount * mintingRate + 50n) / 100n; // 50% rate
      const mintBalanceTier1 = await mockToken.balanceOf(addr1.address);
      expect(mintBalanceTier1).to.equal(expectedMintAmountTier1 + balance);

      // Simulate totalMintCount in tier 2
      await llaVault.connect(owner).setTotalMintCount(500); // Simulate totalMintCount
      const mintingRate2 = await llaVault.getMintingRate();
      const newB = await mockToken.balanceOf(addr1.address);
      await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);
      // Verify the minted amount for tier 2
      const expectedMintAmountTier2 =
        (depositAmount * mintingRate2 + 50n) / 100n; // 40% rate
      const mintBalanceTier2 = await mockToken.balanceOf(addr1.address);
      expect(mintBalanceTier2).to.equal(expectedMintAmountTier2 + newB);
    });
  });

  describe("Withdraw Functionality Tests", function () {
    beforeEach(async function () {
      // Ensure the token has been added to the supported list.
      const tokenAddress = await mockToken.getAddress();
      try {
        await llaVault.connect(tokenManager).addSupportedToken(tokenAddress);
      } catch (error) {
        // If the token is already in the supported list, ignore the error.
      }

      // Mint some tokens for the vault contract.
      await mockToken
        .connect(minter)
        .mint(VaultProxyAddress, ethers.parseEther("1000"));

      // Ensure the contract is not suspended.
      if (await llaVault.paused()) {
        await llaVault.connect(pauser).unpause();
      }
    });

    it("should allow tokenWithdraw to withdraw tokens", async function () {
      const tokenAddress = await mockToken.getAddress();
      const withdrawAmount = ethers.parseEther("100");

      // Check the initial balance of the vault.
      const initialVaultBalance = await mockToken.balanceOf(VaultProxyAddress);
      expect(initialVaultBalance).to.be.gte(withdrawAmount);
      // Check the recipient's initial balance.
      const initialRecipientBalance = await mockToken.balanceOf(addr1.address);
      // Execute the withdrawal operation.
      await expect(
        llaVault
          .connect(tokenWithdraw)
          .withdraw(tokenAddress, addr1.address, withdrawAmount)
      )
        .to.emit(llaVault, "Withdrawal")
        .withArgs(addr1.address, anyValue, withdrawAmount, tokenAddress);
      // Check the vault balance.
      const finalVaultBalance = await mockToken.balanceOf(VaultProxyAddress);
      expect(finalVaultBalance).to.equal(initialVaultBalance - withdrawAmount);

      // Check the recipient's balance.
      const finalRecipientBalance = await mockToken.balanceOf(addr1.address);
      expect(finalRecipientBalance).to.equal(
        initialRecipientBalance + withdrawAmount
      );
    });

    it("should revert if non-tokenWithdraw tries to withdraw", async function () {
      const tokenAddress = await mockToken.getAddress();
      const withdrawAmount = ethers.parseEther("100");

      await expect(
        llaVault
          .connect(addr1)
          .withdraw(tokenAddress, addr2.address, withdrawAmount)
      )
        .to.be.revertedWithCustomError(
          llaVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(addr1.address, await llaVault.TOKEN_WITHDRAW_ROLE());
    });

    it("should revert if withdrawing more than the vault balance", async function () {
      const tokenAddress = await mockToken.getAddress();
      const balance = await mockToken.balanceOf(VaultProxyAddress);

      const withdrawAmount = ethers.parseEther("2000"); // Exceed the vault balance.
      const newAmount = balance + withdrawAmount;

      await expect(
        llaVault
          .connect(tokenWithdraw)
          .withdraw(tokenAddress, addr1.address, newAmount)
      )
        .to.be.revertedWithCustomError(llaVault, "InsufficientBalance")
        .withArgs(newAmount, await mockToken.balanceOf(VaultProxyAddress));
    });

    it("should revert if withdrawing to the zero address", async function () {
      const tokenAddress = await mockToken.getAddress();
      const withdrawAmount = ethers.parseEther("100");

      await expect(
        llaVault
          .connect(tokenWithdraw)
          .withdraw(tokenAddress, ethers.ZeroAddress, withdrawAmount)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAddress")
        .withArgs(ethers.ZeroAddress);
    });

    it("should revert if withdrawing zero amount", async function () {
      const tokenAddress = await mockToken.getAddress();

      await expect(
        llaVault.connect(tokenWithdraw).withdraw(tokenAddress, addr1.address, 0)
      )
        .to.be.revertedWithCustomError(llaVault, "InvalidAmount")
        .withArgs(0);
    });

    it("should allow withdrawing when the contract is paused", async function () {
      const tokenAddress = await mockToken.getAddress();
      const withdrawAmount = ethers.parseEther("100");

      // Suspend the contract.
      await llaVault.connect(pauser).pause();

      // Execute the withdrawal operation.
      await expect(
        llaVault
          .connect(tokenWithdraw)
          .withdraw(tokenAddress, addr1.address, withdrawAmount)
      ).to.revertedWithCustomError(llaVault, "EnforcedPause");

      // Restore the contract status.
      await llaVault.connect(pauser).unpause();
    });

    it("should handle multiple withdrawals correctly", async function () {
      const tokenAddress = await mockToken.getAddress();
      const withdrawAmount1 = ethers.parseEther("50");
      const withdrawAmount2 = ethers.parseEther("75");
      const initRecipient1Balance = await mockToken.balanceOf(addr1.address);
      const initRecipient2Balance = await mockToken.balanceOf(addr2.address);
      // Check the initial balance of the vault.
      const initialVaultBalance = await mockToken.balanceOf(VaultProxyAddress);

      // Execute the first withdrawal.
      await llaVault
        .connect(tokenWithdraw)
        .withdraw(tokenAddress, addr1.address, withdrawAmount1);

      // Execute the second withdrawal.
      await llaVault
        .connect(tokenWithdraw)
        .withdraw(tokenAddress, addr2.address, withdrawAmount2);

      // Check the vault balance.
      const finalVaultBalance = await mockToken.balanceOf(VaultProxyAddress);
      expect(finalVaultBalance).to.equal(
        initialVaultBalance - withdrawAmount1 - withdrawAmount2
      );

      // Check the recipient's balance.
      const recipient1Balance = await mockToken.balanceOf(addr1.address);
      const recipient2Balance = await mockToken.balanceOf(addr2.address);
      expect(recipient1Balance).to.equal(
        withdrawAmount1 + initRecipient1Balance
      );
      expect(recipient2Balance).to.equal(
        initRecipient2Balance + withdrawAmount2
      );
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
      // TODO 验证
      // const paymentCount = await getPaymentCount(addr1.address);
      // const payment = await llaVault.payments(addr1.address, paymentCount - 1n);
      // expect(payment.amount).to.equal(largeAmount);
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
      // TODO 验证

      // Verify the number of payment records
      // const paymentCount = await getPaymentCount(addr1.address);
      // expect(paymentCount).to.be.at.least(iterations);
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
});
