import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("开始升级 ProductSubscription 合约...");

    // 获取现有的代理合约地址（需要根据实际部署地址修改）
    const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x..."; // 替换为实际的代理合约地址
    
    if (PROXY_ADDRESS === "0x...") {
        throw new Error("请设置正确的 PROXY_ADDRESS 环境变量");
    }

    console.log(`代理合约地址: ${PROXY_ADDRESS}`);

    // 获取新的合约工厂
    const ProductSubscriptionV2Factory = await ethers.getContractFactory("ProductSubscription");

    console.log("正在升级合约...");
    
    // 执行升级
    const upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, ProductSubscriptionV2Factory);
    
    await upgradedContract.waitForDeployment();
    
    console.log(`合约升级成功！`);
    console.log(`代理合约地址: ${PROXY_ADDRESS}`);
    console.log(`新实现合约地址: ${await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS)}`);

    // 验证升级后的合约
    console.log("\n验证升级后的合约功能...");
    
    // 检查新的常量和函数是否存在
    const BASE_DECIMALS = await upgradedContract.BASE_DECIMALS();
    console.log(`BASE_DECIMALS: ${BASE_DECIMALS}`);
    
    // 如果有现有的支持代币，需要批量更新它们的精度信息
    console.log("\n准备升级后的数据迁移步骤：");
    console.log("1. 调用 batchUpdateTokenDecimals() 为现有代币设置精度");
    console.log("2. 验证所有代币的精度信息");
    console.log("3. 测试精度转换功能");
    
    console.log("\n升级完成！");
}

// 升级后的数据迁移函数
async function postUpgradeMigration(contractAddress: string) {
    console.log("执行升级后数据迁移...");
    
    const contract = await ethers.getContractAt("ProductSubscription", contractAddress);
    
    // 假设我们知道现有支持的代币地址
    const existingTokens = [
        // 在这里添加现有支持的代币地址
        // "0x...", // USDT
        // "0x...", // USDC
    ];
    
    if (existingTokens.length > 0) {
        console.log(`为 ${existingTokens.length} 个现有代币更新精度信息...`);
        
        const [admin] = await ethers.getSigners();
        const tx = await contract.connect(admin).batchUpdateTokenDecimals(existingTokens);
        await tx.wait();
        
        console.log("精度信息更新完成！");
        
        // 验证精度信息
        for (const token of existingTokens) {
            const decimals = await contract.tokenDecimals(token);
            console.log(`代币 ${token} 精度: ${decimals}`);
        }
    }
    
    console.log("数据迁移完成！");
}

main()
    .then(() => {
        console.log("\n升级脚本执行完毕");
        process.exit(0);
    })
    .catch((error) => {
        console.error("升级失败:", error);
        process.exit(1);
    });

export { postUpgradeMigration };