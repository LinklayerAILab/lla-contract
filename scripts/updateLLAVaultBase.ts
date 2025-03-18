
import { ethers, upgrades } from "hardhat";
import { verify } from "../utils/verify";
async function main() {
    const fullUrl =
      process.env.SEPOLIA_URL! + "/v3/" + "574138be66974922bc4c949d5b1282ae";
      const provider = new ethers.JsonRpcProvider(fullUrl);
    const deployer = new ethers.Wallet("0x" + process.env.OWNER_ADDR!).connect(
      provider
    );

  console.log("Deploying contracts with the account:", deployer.address);

  // Get the contract factory
  const LLAVaultBaseFactory = (await ethers.getContractFactory("LLAVaultBase")).connect(deployer);

  // Deploy the contract
  const llaVaultBase = await upgrades.upgradeProxy(
      "0x2f174e53cbb94011c04539719399CAa4d32bB121",
      LLAVaultBaseFactory,
    {
      kind: "uups",
    }
  );
    await llaVaultBase.waitForDeployment()
    console.log("Waiting for block confirmations...");
    await llaVaultBase.deploymentTransaction()?.wait(6); // Wait for 6 block confirmations
    const contractAddress = await llaVaultBase.getAddress();  
    const implementationAddress =
      await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("LLAVaultBase proxy contract address:", contractAddress);
    console.log("Verifying implementation contract...");
    // await verify(implementationAddress, []);
    console.log(
      "Contract verification completed implementationAddress:",
      implementationAddress
    );



  console.log("LLAVaultBase deployed to:", await llaVaultBase.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
