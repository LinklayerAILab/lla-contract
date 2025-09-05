import { ethers } from "hardhat";

// 示例商品配置
const PRODUCTS = [
  {
    id: 1,
    name: "基础订阅",
    totalDays: 30,
    amount: "10.00" // 10 USDT/USDC
  },
  {
    id: 2,
    name: "高级订阅",
    totalDays: 90,
    amount: "25.00" // 25 USDT/USDC
  },
  {
    id: 3,
    name: "专业订阅",
    totalDays: 180,
    amount: "45.00" // 45 USDT/USDC
  },
  {
    id: 4,
    name: "企业订阅",
    totalDays: 365,
    amount: "80.00" // 80 USDT/USDC
  }
];

async function main() {
  console.log("开始添加商品...");

  // 从命令行参数或环境变量获取合约地址
  const contractAddress = process.env.CONTRACT_ADDRESS || process.argv[2];
  
  if (!contractAddress) {
    console.error("❌ 请提供合约地址:");
    console.log("方式1: CONTRACT_ADDRESS=0x... npx hardhat run scripts/addProducts.ts --network erbie");
    console.log("方式2: npx hardhat run scripts/addProducts.ts --network erbie 0x...");
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

    // 检查是否有PRODUCT_MANAGER_ROLE权限
    const PRODUCT_MANAGER_ROLE = await contract.PRODUCT_MANAGER_ROLE();
    const hasRole = await contract.hasRole(PRODUCT_MANAGER_ROLE, deployer.address);
    
    if (!hasRole) {
      console.error("❌ 当前账户没有 PRODUCT_MANAGER_ROLE 权限");
      console.log("需要联系管理员授予权限或使用有权限的账户");
      process.exit(1);
    }

    console.log("✅ 权限验证通过");

    // 显示当前商品数量
    const currentProductCount = await contract.getProductCount();
    console.log("当前商品数量:", currentProductCount.toString());

    // 添加商品
    console.log("\n=== 开始添加商品 ===");
    
    for (const product of PRODUCTS) {
      try {
        // 检查商品是否已存在
        try {
          await contract.getProduct(product.id);
          console.log(`⏭️  商品 ID ${product.id} (${product.name}) 已存在，跳过`);
          continue;
        } catch (error) {
          // 商品不存在，继续添加
        }

        console.log(`正在添加商品: ${product.name} (ID: ${product.id})`);
        console.log(`- 时长: ${product.totalDays} 天`);
        console.log(`- 价格: ${product.amount} USDT/USDC`);

        // 将价格转换为合约使用的格式 (假设使用6位小数的代币如USDT/USDC)
        const amountInWei = ethers.parseUnits(product.amount, 6);
        
        const tx = await contract.addProduct(
          product.id,
          product.totalDays,
          amountInWei
        );
        
        console.log(`交易哈希: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ ${product.name} 添加成功! Gas使用: ${receipt.gasUsed}\n`);
        
      } catch (error) {
        console.error(`❌ 添加商品 ${product.name} 失败:`, error.message);
        console.log(""); // 空行分隔
      }
    }

    // 显示最终的商品列表
    console.log("=== 当前商品列表 ===");
    const finalProductCount = await contract.getProductCount();
    console.log("商品总数:", finalProductCount.toString());

    if (finalProductCount > 0n) {
      try {
        const productList = await contract.getProductList();
        
        productList.forEach((product, index) => {
          console.log(`${index + 1}. ID: ${product.productId}, 天数: ${product.totalDays}, 价格: ${ethers.formatUnits(product.amount, 6)} USDT/USDC`);
        });
      } catch (error) {
        console.log("获取商品列表失败:", error.message);
      }
    }

  } catch (error) {
    console.error("❌ 操作失败:", error);
    throw error;
  }

  console.log("\n✅ 商品添加操作完成!");
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