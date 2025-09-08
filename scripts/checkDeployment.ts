import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("检查已部署的 ProductSubscription 合约...");

  // 已知的实现合约地址（从错误信息获取）
  const implementationAddress = "0x062689De8DAaE323b64624c39C5c1c368F39f5Df";
  
  // 连接到 Sepolia 网络
  const provider = new ethers.JsonRpcProvider("https://eth-sepolia.public.blastapi.io");
  
  console.log("检查实现合约是否已部署...");
  const implCode = await provider.getCode(implementationAddress);
  
  if (implCode && implCode !== "0x") {
    console.log("✅ 实现合约已成功部署:", implementationAddress);
    
    // 查找代理合约地址
    // 通常代理合约会在实现合约部署后立即部署
    console.log("\n查找对应的代理合约地址...");
    
    // 获取最近的交易来查找代理合约地址
    const latestBlock = await provider.getBlockNumber();
    console.log("最新区块:", latestBlock);
    
    // 检查最近几个区块中的合约创建
    for (let i = 0; i < 10; i++) {
      const blockNumber = latestBlock - i;
      const block = await provider.getBlock(blockNumber, true);
      
      if (block && block.transactions) {
        for (const tx of block.transactions) {
          if (typeof tx === 'object' && tx.to === null && tx.data && tx.data.length > 100) {
            // 这是一个合约创建交易
            const receipt = await provider.getTransactionReceipt(tx.hash);
            if (receipt && receipt.contractAddress) {
              // 检查是否是代理合约
              const code = await provider.getCode(receipt.contractAddress);
              if (code && code.includes("363d3d373d3d3d363d73")) { // 代理合约的字节码特征
                console.log(`可能的代理合约地址: ${receipt.contractAddress}`);
                console.log(`交易哈希: ${tx.hash}`);
              }
            }
          }
        }
      }
    }
    
  } else {
    console.log("❌ 实现合约未找到或部署失败");
  }
  
  // 检查具体的交易状态
  const txHash = "0x28cd752724e56ff5b15e00f34a80691908256a9dedc42d44a86c2d8827ff1049";
  console.log(`\n检查交易状态: ${txHash}`);
  
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (receipt) {
      console.log("✅ 交易已确认");
      console.log("区块号:", receipt.blockNumber);
      console.log("Gas 使用:", receipt.gasUsed.toString());
      console.log("状态:", receipt.status === 1 ? "成功" : "失败");
      
      if (receipt.contractAddress) {
        console.log("创建的合约地址:", receipt.contractAddress);
      }
      
      // 显示所有事件日志
      if (receipt.logs.length > 0) {
        console.log("\n事件日志:");
        receipt.logs.forEach((log, index) => {
          console.log(`日志 ${index}:`, log.address);
        });
      }
    }
  } catch (error) {
    console.error("获取交易信息失败:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("检查失败:", error);
    process.exit(1);
  });