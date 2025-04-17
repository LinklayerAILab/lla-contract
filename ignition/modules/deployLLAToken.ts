// import { ethers, upgrades } from "hardhat";
// import { LLAToken } from "../../typechain-types";
// import { verify } from "../../utils/verify";
// import * as dotenv from "dotenv";
// const fs = require("fs");
// dotenv.config();

// async function main() {
//   console.log("OWNER_ADDR---", process.env.OWNER_ADDR);
//   try {
//     const provider = new ethers.JsonRpcProvider(
//       "https://bsc-testnet-dataseed.bnbchain.org"
//     );
//     // Get the deployer account
//     const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!).connect(
//       provider
//     );

//     // Validate address format
//       if (!ethers.isAddress(admin.address)) {
//         throw new Error(`Invalid address: ${admin.address}`);
//       }

//     // Get the contract factory
//     const LLATokenFactory = await ethers.getContractFactory("LLAToken");

//     // Deploy the proxy contract
//     const llaToken: LLAToken = await upgrades.deployProxy(
//       LLATokenFactory,
//       [admin.address, admin.address, admin.address, admin.address],
//       {
//         kind: "uups",
//         initializer: "initialize",
//       }
//     );

//     await llaToken.waitForDeployment();

//     const proxyAddress = await llaToken.getAddress();
//     console.log("LLAToken proxy contract address:", proxyAddress);

//     // Get the implementation contract address
//     const implementationAddress =
//       await upgrades.erc1967.getImplementationAddress(proxyAddress);
//     console.log("Implementation contract address:", implementationAddress);

//     // Verify the implementation contract

//     console.log("Waiting for block confirmations...");
//     await llaToken.deploymentTransaction()?.wait(6); // Wait for 6 block confirmations
//     console.log("Verifying implementation contract...");
//     await verify(implementationAddress, []);
//     console.log("Contract verification completed");

//     // Verify initial state
//     console.log("\nVerifying initial contract state:");
//     console.log(
//       "Admin:",
//       await llaToken.hasRole(await llaToken.ADMIN_ROLE(), admin.address)
//     );
//     console.log(
//       "Pauser:",
//       await llaToken.hasRole(await llaToken.PAUSER_ROLE(), admin.address)
//     );
//     console.log(
//       "Minter:",
//       await llaToken.hasRole(await llaToken.MINTER_ROLE(), admin.address)
//     );
//     console.log(
//       "Upgrader:",
//       await llaToken.hasRole(await llaToken.UPGRADER_ROLE(), admin.address)
//     );
//     const info = {
//       contract: "LLAToken",
//       adminAddress: admin.address,
//       pauserAddress: admin.address,
//       minterAddress: admin.address,
//       upgraderAddress: admin.address,
//       proxyAddress: proxyAddress,
//       logicAddress: implementationAddress,
//     };
    
//     const output = "../../output/deployLLAToken.json";
//     await fs.writeFileSync(
//       output,
//       JSON.stringify(info, null, 2),
//       "utf-8"
//     );
//     console.log("Deployment information saved to", output);
//   } catch (error) {
//     console.error("Deployment failed:", error);
//     throw error;
//   }
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MyContractModule", (m: { contract: (arg0: string, arg1: string[]) => any; }) => {
  const myContract = m.contract("MyContract", [
    "constructorArg1",
    "constructorArg2",
  ]);

  return { myContract };
});