import { ethers, upgrades } from "hardhat";
import { verify } from "../../utils/verify";
async function main() {
  const fullUrl =
    process.env.SEPOLIA_URL! + "/v3/" + "574138be66974922bc4c949d5b1282ae";
  const provider = new ethers.JsonRpcProvider(fullUrl);
  const deployer = new ethers.Wallet("0x" + process.env.OWNER_ADDR!).connect(
    provider
  );
  const pauser = new ethers.Wallet("0x" + process.env.PAUSER_ADDR!).connect(
    provider
  );
  const minter = new ethers.Wallet("0x" + process.env.MINTER_ADDR!).connect(
    provider
  );
  const tokenManager = new ethers.Wallet(
    "0x" + process.env.TOKENMANAGER_ADDR!
  ).connect(provider);
  const upgrader = new ethers.Wallet("0x" + process.env.UPGRADER_ADDR!).connect(
    provider
  );

  const multiSig = "0x2af0CC36a308880EA98E09f1f50d369F613c98f5"; // Replace with the actual multisig address
  const llaToken = "0xA0cf9963880258C62899afeAc8465c3E8B53FB94"; // Replace with the actual LLA token address

  console.log("Deploying contracts with the account:", deployer.address);

  // Get the contract factory
  const LLAVaultBaseFactory = await ethers.getContractFactory("LLAVaultBase");

  // Set initialization parameters
  const defaultAdmin = deployer.address;

  // Deploy the contract
  const llaVaultBase = await upgrades.deployProxy(
    LLAVaultBaseFactory,
    [
      defaultAdmin,
      pauser.address,
      minter.address,
      tokenManager.address,
      upgrader.address,
      llaToken,
      multiSig,
    ],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await llaVaultBase.waitForDeployment();
  console.log("Waiting for block confirmations...");
  await llaVaultBase.deploymentTransaction()?.wait(6); // Wait for 6 block confirmations
  const contractAddress = await llaVaultBase.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    contractAddress
  );
  console.log("LLAVaultBase proxy contract address:", contractAddress);
  console.log("Verifying implementation contract...");
  // await verify(implementationAddress, []);
  // console.log("Contract verification completed");

  console.log("LLAVaultBase deployed to:", await llaVaultBase.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
