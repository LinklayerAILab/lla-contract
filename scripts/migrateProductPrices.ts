import { ethers } from "hardhat";

/**
 * 数据迁移脚本：将升级前的产品价格从 6 位精度转换为 18 位精度
 *
 * 背景：
 * - 升级前：产品价格以 6 位精度存储（例如 5900000 = 5.9 USDC）
 * - 升级后：产品价格统一以 18 位精度存储
 * - 需要将现有产品价格乘以 10^12 进行转换
 */

async function main() {
    // 合约地址
    const contractAddress = "0x1bfecf98f08ec2dad1360915acbd165395aa0381";

    // 旧精度和新精度
    const OLD_DECIMALS = 6;   // 升级前使用 6 位精度
    const NEW_DECIMALS = 18;  // 升级后使用 18 位精度
    const CONVERSION_MULTIPLIER = BigInt(10) ** BigInt(NEW_DECIMALS - OLD_DECIMALS); // 10^12

    console.log("=".repeat(60));
    console.log("产品价格数据迁移脚本");
    console.log("=".repeat(60));
    console.log(`合约地址: ${contractAddress}`);
    console.log(`转换系数: ${CONVERSION_MULTIPLIER} (10^${NEW_DECIMALS - OLD_DECIMALS})`);
    console.log("");

    // 连接到合约
    const ProductSubscription = await ethers.getContractFactory("ProductSubscription");
    const productSubscription = ProductSubscription.attach(contractAddress);

    // 获取所有产品
    console.log("正在获取产品列表...");
    const products = await productSubscription.getProductList();
    console.log(`找到 ${products.length} 个产品\n`);

    if (products.length === 0) {
        console.log("没有需要迁移的产品");
        return;
    }

    // 显示迁移计划
    console.log("迁移计划:");
    console.log("-".repeat(60));
    const migrationsNeeded: { productId: bigint, oldPrice: bigint, newPrice: bigint }[] = [];

    for (const product of products) {
        const oldPrice = product.amount;
        const newPrice = oldPrice * CONVERSION_MULTIPLIER;

        console.log(`产品 ID ${product.productId}:`);
        console.log(`  旧价格 (6位精度): ${oldPrice} (${ethers.formatUnits(oldPrice, OLD_DECIMALS)} USD)`);
        console.log(`  新价格 (18位精度): ${newPrice} (${ethers.formatUnits(newPrice, NEW_DECIMALS)} USD)`);
        console.log("");

        migrationsNeeded.push({
            productId: product.productId,
            oldPrice: oldPrice,
            newPrice: newPrice
        });
    }

    // 确认迁移
    console.log("=".repeat(60));
    console.log(`准备更新 ${migrationsNeeded.length} 个产品的价格`);
    console.log("开始迁移...\n");

    // 执行迁移
    let successCount = 0;
    let failCount = 0;

    for (const migration of migrationsNeeded) {
        try {
            console.log(`正在更新产品 ${migration.productId}...`);

            const tx = await productSubscription.updateProduct(
                migration.productId,
                migration.newPrice
            );

            console.log(`  交易哈希: ${tx.hash}`);
            await tx.wait();
            console.log(`  ✅ 更新成功\n`);

            successCount++;
        } catch (error: any) {
            console.error(`  ❌ 更新失败: ${error.message}\n`);
            failCount++;
        }
    }

    // 验证迁移结果
    console.log("=".repeat(60));
    console.log("验证迁移结果...\n");

    for (const migration of migrationsNeeded) {
        try {
            const product = await productSubscription.getProduct(migration.productId);
            const actualPrice = product.amount;

            if (actualPrice === migration.newPrice) {
                console.log(`✅ 产品 ${migration.productId}: ${ethers.formatUnits(actualPrice, NEW_DECIMALS)} USD (正确)`);
            } else {
                console.log(`⚠️  产品 ${migration.productId}: 预期 ${migration.newPrice}, 实际 ${actualPrice}`);
            }
        } catch (error: any) {
            console.error(`❌ 产品 ${migration.productId}: 验证失败 - ${error.message}`);
        }
    }

    // 总结
    console.log("\n" + "=".repeat(60));
    console.log("迁移完成！");
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failCount}`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
