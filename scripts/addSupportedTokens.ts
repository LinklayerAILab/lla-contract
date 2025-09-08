import { ethers } from "hardhat";

// 常用代币地址 (请根据实际情况修改)
const TOKEN_ADDRESSES = {
  // 这些是示例地址，请替换为实际的代币地址
  USDT: "0x0000000000000000000000000000000000000000", // 请替换为实际USDT地址
  USDC: "0x0000000000000000000000000000000000000000", // 请替换为实际USDC地址
};

async function main() {
  console.log("开始添加支持的代币...");

  // 从命令行参数或环境变量获取合约地址
  const contractAddress = process.env.CONTRACT_ADDRESS || process.argv[2];
  
  if (!contractAddress) {
    console.error("❌ 请提供合约地址:");
    console.log("方式1: CONTRACT_ADDRESS=0x... npx hardhat run scripts/addSupportedTokens.ts --network erbie");
    console.log("方式2: npx hardhat run scripts/addSupportedTokens.ts --network erbie 0x...");
    process.exit(1);
  }

  console.log("合约地址:", contractAddress);

  // 获取签名者
  const [deployer] = await ethers.getSigners();
  console.log("操作者地址:", deployer.address);

  // 连接到已部署的合约
  const ProductSubscription = await ethers.getContractFactory("ProductSubscription");
  const contract = ProductSubscription.attach(contractAddress);

  try {
    // 验证合约连接
    const version = await contract.version();
    console.log("合约版本:", version);

    // 检查是否有TOKEN_MANAGER_ROLE权限
    const TOKEN_MANAGER_ROLE = await contract.TOKEN_MANAGER_ROLE();
    const hasRole = await contract.hasRole(TOKEN_MANAGER_ROLE, deployer.address);
    
    if (!hasRole) {
      console.error("❌ 当前账户没有 TOKEN_MANAGER_ROLE 权限");
      console.log("需要联系管理员授予权限或使用有权限的账户");
      process.exit(1);
    }

    console.log("✅ 权限验证通过");

    // 添加支持的代币
    const tokensToAdd = [
      { name: "USDT", address: TOKEN_ADDRESSES.USDT },
      { name: "USDC", address: TOKEN_ADDRESSES.USDC },
    ];

    for (const token of tokensToAdd) {
      if (token.address === "0x0000000000000000000000000000000000000000") {
        console.log(`⏭️  跳过 ${token.name}: 地址未配置`);
        continue;
      }

      try {
        // 检查是否已经支持
        const isSupported = await contract.supportCoins(token.address);
        if (isSupported) {
          console.log(`✅ ${token.name} (${token.address}) 已经是支持的代币`);
          continue;
        }

        console.log(`正在添加 ${token.name} (${token.address})...`);
        
        const tx = await contract.addSupportedToken(token.address);
        console.log(`交易哈希: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ ${token.name} 添加成功! Gas使用: ${receipt.gasUsed}`);
        
      } catch (error) {
        console.error(`❌ 添加 ${token.name} 失败:`, error.message);
      }
    }

    // 显示当前支持的代币
    console.log("\n=== 当前支持的代币 ===");
    for (const token of tokensToAdd) {
      if (token.address !== "0x0000000000000000000000000000000000000000") {
        try {
          const isSupported = await contract.supportCoins(token.address);
          console.log(`${token.name}: ${isSupported ? '✅ 支持' : '❌ 不支持'}`);
        } catch (error) {
          console.log(`${token.name}: ❓ 检查失败`);
        }
      }
    }

  } catch (error) {
    console.error("❌ 操作失败:", error);
    throw error;
  }

  console.log("\n✅ 代币添加操作完成!");
}

main()
  .then(() => {
    console.log("🎉 所有操作完成!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 执行失败:", error.message);
    process.exit(1);
  });