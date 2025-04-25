import { ethers } from "hardhat";
import { LLAToken } from "../../typechain-types";
import * as dotenv from "dotenv";
dotenv.config();
const fs = require("fs");
async function main() {
  console.log("add Minter LLAToken to bsctest network...");

  // Define multiple RPC nodes
  const RPC_ENDPOINTS = [
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
  ];

  // Create provider function
  async function createProvider(endpoint: string) {
    return new ethers.JsonRpcProvider(endpoint);
  }
  // Try to connect to available RPC nodes
  async function getWorkingProvider() {
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const provider = await createProvider(endpoint);
        // Test connection
        await provider.getBlockNumber();
        console.log(`Successfully connected to ${endpoint}`);
        return provider;
      } catch (error) {
        console.log(`Failed to connect to ${endpoint}, trying next...`);
      }
    }
    throw new Error("Failed to connect to any RPC endpoint");
  }
  // Get available provider
  const provider = await getWorkingProvider();
  const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!, provider);
  console.log("Admin address:", admin.address);
  // Validate address format
  if (!ethers.isAddress(admin.address)) {
    throw new Error(`Invalid address: ${admin.address}`);
  }

  // Retry logic for add minter role
  async function addMinterWithRetry() {
    const maxRetries = 5;
    const retryDelay = 10000;

    // read contract
    const deployInfo = require("../../output/deployLLAToken.json");
    const proxyAddress = deployInfo.proxyAddress;

    // connect contract
    const LLATokenFactory = await ethers.getContractFactory("LLAToken", admin);
    const llaToken = LLATokenFactory.attach(
      proxyAddress
    ) as unknown as LLAToken;

    const newMinterAddress = "0xCBD46A2D6c99A7B8daa2C35DE2aEad37Aa36f506";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to add minter role...`);

        // add Minter role
        const tx = await llaToken.addRole(
          await llaToken.MINTER_ROLE(),
          newMinterAddress
        );
        await tx.wait(2);

        // verify
        const hasMinterRole = await llaToken.hasRole(
          await llaToken.MINTER_ROLE(),
          newMinterAddress
        );
        console.log(`Minter role added successfully: ${hasMinterRole}`);

        return true;
      } catch (error) {
        console.error(`Add minter attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error("Max retries reached. Add minter failed.");
        }
        console.log(`Waiting ${retryDelay / 1000} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  await addMinterWithRetry();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Add minter failed:", error);
    process.exit(1);
  });
