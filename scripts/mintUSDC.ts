import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";
import fs from "fs";

dotenv.config();

async function main() {
  console.log("Minting MockUSDC tokens...");

  // Load environment variables
  const ownerPrivateKey = process.env.OWNER_ADDR!;

  if (!ownerPrivateKey) {
    throw new Error("Missing OWNER_ADDR in .env file");
  }

  // MockUSDC contract address from deployment
  const MOCKUSDC_ADDRESS = "0x4EC62D4a260205FFBd181aFEc6065849a21821C2";

  // Define Erbie RPC endpoints
  const RPC_ENDPOINTS = [
    "http://192.168.1.235:8560",
    "http://192.168.1.235:8560", // backup
    "http://192.168.1.235:8560", // backup
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
    throw new Error("Failed to connect to any Erbie RPC endpoint");
  }

  // Get available provider
  const provider = await getWorkingProvider();
  const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!, provider);

  console.log("Admin address:", admin.address);

  // Validate address format
  if (!ethers.isAddress(admin.address)) {
    throw new Error(`Invalid address: ${admin.address}`);
  }

  // Check admin balance
  const balance = await provider.getBalance(admin.address);
  console.log(`Admin balance: ${ethers.formatEther(balance)} ERB`);

  // Get contract instance
  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC", admin);
  const mockUSDC = MockUSDCFactory.attach(MOCKUSDC_ADDRESS);

  // Verify contract owner
  const contractOwner = await mockUSDC.owner();
  console.log("Contract Owner:", contractOwner);
  
  if (contractOwner.toLowerCase() !== admin.address.toLowerCase()) {
    throw new Error(`Admin (${admin.address}) is not the contract owner (${contractOwner})`);
  }

  // Mint parameters
  const recipients = [
    { address: admin.address, amount: "10000" }, // 10,000 USDC to admin
    { address: "0xB9cB4030e6543E4C93492879e31e3899aDFfd5a5", amount: "5000" }, // 5,000 USDC to test address
  ];

  console.log("\nStarting mint operations...");
  let totalMinted = BigInt(0);

  // Retry logic for minting
  async function mintWithRetry(to: string, amount: string) {
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds delay
    const mintAmount = ethers.parseUnits(amount, 6);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to mint ${amount} USDC to ${to}...`);
        
        const tx = await mockUSDC.mint(to, mintAmount, {
          gasLimit: 200000,
          gasPrice: ethers.parseUnits("20", "gwei")
        });

        await tx.wait(2);
        console.log(`✅ Minted ${amount} USDC to ${to}`);
        console.log(`Transaction hash: ${tx.hash}`);
        
        return mintAmount;
      } catch (error) {
        console.error(`Mint attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error(`Failed to mint to ${to} after ${maxRetries} attempts`);
        }
        console.log(`Waiting ${retryDelay/1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Execute mint operations
  for (const recipient of recipients) {
    try {
      const mintedAmount = await mintWithRetry(recipient.address, recipient.amount);
      totalMinted += mintedAmount;
      
      // Check balance after minting
      const balance = await mockUSDC.balanceOf(recipient.address);
      console.log(`${recipient.address} balance: ${ethers.formatUnits(balance, 6)} USDC\n`);
    } catch (error) {
      console.error(`Failed to mint to ${recipient.address}:`, error);
    }
  }

  // Final contract state
  console.log("Final contract state:");
  console.log("Total Supply:", ethers.formatUnits(await mockUSDC.totalSupply(), 6), "USDC");
  console.log("Total Minted in this session:", ethers.formatUnits(totalMinted, 6), "USDC");

  // Save mint information
  const info = {
    contract: "MockUSDC",
    network: "erbie",
    contractAddress: MOCKUSDC_ADDRESS,
    adminAddress: admin.address,
    mintOperations: recipients.map(r => ({
      recipient: r.address,
      amount: r.amount,
      success: true
    })),
    totalMinted: ethers.formatUnits(totalMinted, 6),
    finalTotalSupply: ethers.formatUnits(await mockUSDC.totalSupply(), 6),
    time: new Date().toLocaleString(),
  };

  // Create output directory (if not exists)
  const outputDir = path.join(__dirname, "../output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(
    outputDir,
    new Date().toLocaleDateString().replace(/\//g, '-') + "mintMockUSDC.json"
  );
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), "utf-8");
  console.log("Mint information saved to", outputPath);
  console.log("Mint operations completed successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Mint failed:", error);
    process.exit(1);
  });