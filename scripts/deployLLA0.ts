import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";
import fs from "fs";

dotenv.config();

async function main() {
  console.log("========================================");
  console.log("  Deploying LLA0 Token to BSC Testnet");
  console.log("========================================\n");

  // 从环境变量加载配置
  const NETWORK = "bsctest";  // 固定为币安测试网（对应 hardhat.config.ts 中的网络名称）

  // 从私钥派生地址
  const ownerPrivateKey = process.env.OWNER_ADDR!;
  const pauserPrivateKey = process.env.PAUSER_ADDR!;
  console.log(ownerPrivateKey?"Loaded OWNER_ADDR from env":"Missing OWNER_ADDR in env");
  console.log(pauserPrivateKey?"Loaded PAUSER_ADDR from env":"Missing PAUSER_ADDR in env");
  // 使用 ethers.Wallet 从私钥获取地址
  const ownerWallet = new ethers.Wallet(ownerPrivateKey.startsWith('0x') ? ownerPrivateKey : '0x' + ownerPrivateKey);
  const pauserWallet = new ethers.Wallet(pauserPrivateKey.startsWith('0x') ? pauserPrivateKey : '0x' + pauserPrivateKey);

  const DEFAULT_ADMIN = ownerWallet.address;  // 从私钥派生地址
  const PAUSER = pauserWallet.address;        // 从私钥派生地址
  const MINTER = "0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311";  // 固定的 Minter 地址

  console.log("Network:", NETWORK);
  console.log("\n--- Environment Variables (Private Keys) ---");
  console.log("OWNER_ADDR (Private Key):", ownerPrivateKey.substring(0, 10) + "..." + ownerPrivateKey.substring(ownerPrivateKey.length - 4));
  console.log("PAUSER_ADDR (Private Key):", pauserPrivateKey.substring(0, 10) + "..." + pauserPrivateKey.substring(pauserPrivateKey.length - 4));
  console.log("\n--- Derived Addresses ---");
  console.log("OWNER_ADDR → DEFAULT_ADMIN:", DEFAULT_ADMIN);
  console.log("PAUSER_ADDR → PAUSER:", PAUSER);
  console.log("\n--- Fixed Addresses ---");
  console.log("MINTER (Fixed):", MINTER);

  // 验证必需的环境变量
  if (!DEFAULT_ADMIN || !PAUSER) {
    throw new Error(
      "Missing required environment variables. Please set OWNER_ADDR and PAUSER_ADDR in .env file"
    );
  }

  // 验证地址格式
  if (
    !ethers.isAddress(DEFAULT_ADMIN) ||
    !ethers.isAddress(PAUSER) ||
    !ethers.isAddress(MINTER)
  ) {
    throw new Error("Invalid address format");
  }

  // 获取部署者
  const [deployer] = await ethers.getSigners();
  console.log("\nDeploying with account:", deployer.address);

  // 检查部署者余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  if (balance === 0n) {
    throw new Error("Deployer account has no BNB balance");
  }

  // 获取并打印网络信息
  console.log("\n========================================");
  console.log("    Network Information");
  console.log("========================================");

  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();

  console.log("Chain ID:", network.chainId.toString());
  console.log("Current Block Height:", blockNumber);
  console.log("Network Name:", network.name || "Unknown");

  // 验证链 ID
  const chainIdMap: { [key: string]: string } = {
    "1": "Ethereum Mainnet",
    "11155111": "Sepolia Testnet",
    "56": "BSC Mainnet",
    "97": "BSC Testnet",
    "137": "Polygon Mainnet",
    "80001": "Polygon Mumbai Testnet",
    "31337": "Hardhat Local Network",
    "1337": "Localhost Network"
  };

  const chainIdStr = network.chainId.toString();
  const chainName = chainIdMap[chainIdStr] || "Unknown Network";

  console.log(`Network Type: ${chainName}`);

  // 根据网络给出相应提示
  if (network.chainId === 97n) {
    console.log("✅ Connected to BSC Testnet - Ready for deployment");
  } else if (network.chainId === 31337n || network.chainId === 1337n) {
    console.log("ℹ️  Running on local Hardhat network - For testing purposes");
  } else if (network.chainId === 56n) {
    console.warn("⚠️  WARNING: Connected to BSC MAINNET! Ensure this is intentional!");
  } else {
    console.warn(`⚠️  Warning: This script is designed for BSC Testnet (Chain ID 97), current: ${network.chainId}`);
  }

  // 部署合约（带重试机制）
  async function deployWithRetry() {
    const maxRetries = 3;
    const retryDelay = 5000; // 5秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n[Attempt ${attempt}/${maxRetries}] Deploying LLA0 contract...`);

        const LLA0Factory = await ethers.getContractFactory("LLA0");

        // 部署合约
        const lla0 = await LLA0Factory.deploy(
          DEFAULT_ADMIN,
          PAUSER,
          MINTER
        );

        console.log("Waiting for deployment transaction...");
        await lla0.waitForDeployment();

        // 等待额外的区块确认
        const deployTx = lla0.deploymentTransaction();
        if (deployTx) {
          console.log("Deployment tx hash:", deployTx.hash);
          console.log("Waiting for confirmations...");
          await deployTx.wait(2); // 等待2个区块确认
        }

        const contractAddress = await lla0.getAddress();
        console.log("\n✅ LLA0 deployed successfully at:", contractAddress);

        return { contractAddress, lla0 };
      } catch (error) {
        console.error(`❌ Deployment attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          throw new Error("Max retries reached. Deployment failed.");
        }

        console.log(`Waiting ${retryDelay / 1000} seconds before retrying...\n`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  const result = await deployWithRetry();
  if (!result) {
    throw new Error("Deployment failed");
  }

  const { contractAddress, lla0 } = result;

  // 验证合约状态
  console.log("\n========================================");
  console.log("    Verifying Contract State");
  console.log("========================================");

  try {
    const name = await lla0.name();
    const symbol = await lla0.symbol();
    const decimals = await lla0.decimals();
    const maxSupply = await lla0.MAX_SUPPLY();
    const totalSupply = await lla0.totalSupply();

    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals);
    console.log("Max Supply:", ethers.formatEther(maxSupply), symbol);
    console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);

    // 验证角色
    console.log("\n--- Role Verification ---");
    const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();
    const PAUSER_ROLE = await lla0.PAUSER_ROLE();
    const MINTER_ROLE = await lla0.MINTER_ROLE();

    const hasAdminRole = await lla0.hasRole(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN);
    const hasPauserRole = await lla0.hasRole(PAUSER_ROLE, PAUSER);
    const hasMinterRole = await lla0.hasRole(MINTER_ROLE, MINTER);

    console.log("DEFAULT_ADMIN_ROLE assigned:", hasAdminRole ? "✅" : "❌");
    console.log("PAUSER_ROLE assigned:", hasPauserRole ? "✅" : "❌");
    console.log("MINTER_ROLE assigned:", hasMinterRole ? "✅" : "❌");

    if (!hasAdminRole || !hasPauserRole || !hasMinterRole) {
      console.warn("⚠️  Warning: Not all roles are assigned correctly!");
    }

    // 保存部署信息
    const deploymentInfo = {
      network: NETWORK,
      contractName: "LLA0",
      contractAddress: contractAddress,
      deployer: deployer.address,
      deploymentTxHash: lla0.deploymentTransaction()?.hash || "",
      timestamp: new Date().toISOString(),
      networkInfo: {
        chainId: network.chainId.toString(),
        blockHeight: blockNumber.toString(),
        networkName: network.name || "Unknown",
      },
      tokenInfo: {
        name: name,
        symbol: symbol,
        decimals: decimals.toString(),
        maxSupply: ethers.formatEther(maxSupply),
        initialSupply: ethers.formatEther(totalSupply),
      },
      roles: {
        defaultAdmin: DEFAULT_ADMIN,
        pauser: PAUSER,
        minter: MINTER,
      },
      verification: {
        adminRoleAssigned: hasAdminRole,
        pauserRoleAssigned: hasPauserRole,
        minterRoleAssigned: hasMinterRole,
      },
    };

    // 创建输出目录
    const outputDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 保存部署信息到 JSON 文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `LLA0-${NETWORK}-${timestamp}.json`;
    const outputPath = path.join(outputDir, filename);

    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2), "utf-8");

    console.log("\n========================================");
    console.log("    Deployment Summary");
    console.log("========================================");
    console.log("Contract Address:", contractAddress);
    console.log("Network:", NETWORK);
    console.log("Deployment info saved to:", outputPath);

    // 生成验证命令（BSCScan）
    console.log("\n========================================");
    console.log("    Contract Verification (BSCScan)");
    console.log("========================================");
    console.log("To verify the contract on BSCScan, run:");
    console.log(
      `npx hardhat verify --network ${NETWORK} ${contractAddress} "${DEFAULT_ADMIN}" "${PAUSER}" "${MINTER}"`
    );
    console.log("\nBSCScan Testnet:", `https://testnet.bscscan.com/address/${contractAddress}`);

    console.log("\n✅ Deployment to BSC Testnet completed successfully!");

    return deploymentInfo;
  } catch (error) {
    console.error("❌ Error during contract verification:", error);
    throw error;
  }
}

// 执行部署
main()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

