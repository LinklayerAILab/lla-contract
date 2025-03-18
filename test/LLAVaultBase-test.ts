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
  let VaultProxyAddress: string;
  let LLAProxyAddress: string;
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
    LLAProxyAddress = await mockToken.getAddress();
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

      await LLAAuth.addRole(await LLAAuth.MINTER_ROLE(), VaultProxyAddress);

      expect(
        await LLAAuth.hasRole(await LLAAuth.MINTER_ROLE(), VaultProxyAddress)
      ).to.be.true;
    });

    it("Should set LLA token address correctly", async function () {
      // Verify that the LLA token address is set correctly
      expect(await llaVault.llaToken()).to.equal(LLAProxyAddress);
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
       llaVault.connect(tokenManager).addSupportedToken(LLAProxyAddress)
     )
       .to.emit(llaVault, "TokenAdded")
       .withArgs(LLAProxyAddress, await mockToken.symbol());
   });

   it("Should revert if token already exists", async function () {
     // Attempt to add a token that already exists and expect a revert
     await expect(
       llaVault.connect(tokenManager).addSupportedToken(LLAProxyAddress)
     )
       .to.be.revertedWithCustomError(llaVault, "AlreadyInTheSupportedIcon")
       .withArgs(LLAProxyAddress);
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

     const MINTER_ROLE = await mockToken.MINTER_ROLE();
     const amount = 50000;
     //  1. Add minting permissions to the vault contract.
     await mockToken.connect(owner).addRole(MINTER_ROLE, VaultProxyAddress);
     expect(await mockToken.hasRole(MINTER_ROLE, VaultProxyAddress)).to.be.true;

     // 2.Mint 50,000 tokens to the owner account.
     await mockToken.connect(minter).mint(owner.address, amount);

     //  3.Authorize the vault contract to use 50,000 LLA.
     await mockToken.connect(owner).approve(VaultProxyAddress, amount);

     //  4.Operate the vault contract to deposit 50,000 LLA to the multisig address.
     await llaVault.connect(owner).deposit(LLAProxyAddress, transferAmount);

     //  6.Verify the balance of the multisig address.
     const mulAddrBalance = await mockToken.balanceOf(multiSig.address);
     expect(mulAddrBalance).to.equal(transferAmount);
     const newBalance = await mockToken.balanceOf(owner.address);
     expect(newBalance).to.equal(
       BigInt(amount) -
         BigInt(transferAmount) +
         BigInt(transferAmount) * BigInt(1e18)
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
     await mockToken3.connect(owner).approve(VaultProxyAddress, amount);
     await expect(llaVault.connect(owner).deposit(mockToken3.target, amount))
       .to.be.revertedWithCustomError(llaVault, "UnsupportedToken")
       .withArgs(mockToken3.target);
   });

   it("Deposit Should revert if transfer fails", async function () {
     // Attempt to deposit tokens without approval and expect a revert
     const amount = 100;
     await expect(llaVault.connect(addr2).deposit(LLAProxyAddress, amount))
       .to.be.revertedWithCustomError(mockToken, "ERC20InsufficientAllowance")
       .withArgs(VaultProxyAddress, 0, amount);
   });

   it("Should revert if amount is zero", async function () {
     // Attempt to deposit zero tokens and expect a revert
     const amount = 0;
     await expect(llaVault.connect(addr2).deposit(LLAProxyAddress, amount))
       .to.be.revertedWithCustomError(llaVault, "InvalidAmount")
       .withArgs(amount);
   });
 });

 describe("Payment Records", function () {
   it("The user's transaction records should be queryable correctly.", async function () {
     // Verify that the user's transaction records are queryable correctly
     const amount = 100000;
     const payAmount = 100;
     await mockToken.connect(minter).mint(addr1.address, amount);
     await mockToken.connect(addr1).approve(VaultProxyAddress, payAmount);
     await llaVault.connect(addr1).deposit(LLAProxyAddress, payAmount);

     const payment = await llaVault.payments(addr1.address, 0);
     expect(payment.payer).to.equal(addr1.address);
     expect(payment.amount).to.equal(payAmount);
     expect(payment.token).to.equal(LLAProxyAddress);
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

 describe("String Utils", function () {
   it("Should correctly check if string is empty", async function () {
     expect(await llaVault.isEmpty("")).to.be.true;
     expect(await llaVault.isEmpty("test")).to.be.false;
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
      expect(await llaVault.llaToken()).to.equal(LLAProxyAddress);
      await llaVault.connect(tokenManager).updateLLAToken(mockToken2.target);
      expect(await llaVault.llaToken()).to.equal(mockToken2.target);
      await llaVault.connect(tokenManager).updateLLAToken(LLAProxyAddress);
      expect(await llaVault.llaToken()).to.equal(LLAProxyAddress);
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

 
});
