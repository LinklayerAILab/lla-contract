import { ethers } from "hardhat";

async function main() {
    // 合约地址 - 从交易中获取
    const contractAddress = "0x1bfecf98f08ec2dad1360915acbd165395aa0381";
    const tokenAddress = "0x1ada6f3be29f26158a8f3c42ecf9464f526f102b";

    // 连接到合约
    const ProductSubscription = await ethers.getContractFactory("ProductSubscription");
    const productSubscription = ProductSubscription.attach(contractAddress);

    try {
        // 查询产品ID 1
        const productId = 1;
        console.log(`\n查询产品 ID: ${productId}`);
        console.log("=".repeat(50));

        const product = await productSubscription.getProduct(productId);
        console.log(`产品ID: ${product.productId}`);
        console.log(`金额(原始): ${product.amount}`);
        console.log(`金额(18位精度): ${ethers.formatUnits(product.amount, 18)}`);

        // 查询代币精度
        const tokenDecimals = await productSubscription.tokenDecimals(tokenAddress);
        console.log(`\n代币地址: ${tokenAddress}`);
        console.log(`代币精度: ${tokenDecimals}`);

        // 查询转换后的价格
        try {
            const convertedPrice = await productSubscription.convertPriceForToken(
                product.amount,
                tokenAddress
            );
            console.log(`\n转换后价格(原始): ${convertedPrice}`);
            console.log(`转换后价格(${tokenDecimals}位精度): ${ethers.formatUnits(convertedPrice, tokenDecimals)}`);
        } catch (error: any) {
            console.error(`\n❌ 价格转换失败: ${error.message}`);

            // 计算最小支持的价格
            const decimalDiff = 18 - Number(tokenDecimals);
            const minPrice = BigInt(10) ** BigInt(decimalDiff);
            console.log(`\n当前代币精度(${tokenDecimals})下,最小支持的产品价格:`);
            console.log(`  - 原始值: ${minPrice}`);
            console.log(`  - 18位精度: ${ethers.formatUnits(minPrice, 18)}`);
            console.log(`\n当前产品价格太小,需要更新产品价格或使用更高精度的代币。`);
        }

        // 查询产品列表
        console.log(`\n所有产品列表:`);
        console.log("=".repeat(50));
        const products = await productSubscription.getProducts(1, 10);
        products.forEach((p: any, index: number) => {
            console.log(`${index + 1}. 产品ID: ${p.productId}, 金额: ${ethers.formatUnits(p.amount, 18)}`);
        });

    } catch (error: any) {
        console.error("查询失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
