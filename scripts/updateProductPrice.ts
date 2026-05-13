import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0x1bfecf98f08ec2dad1360915acbd165395aa0381"; // 你的合约地址
    const productId = 1;

    // 新价格 - 根据实际业务需求设置
    // 例如: 10 USDT = 10 * 10^18
    const newPrice = ethers.parseUnits("10", 18);

    console.log(`准备更新产品 ${productId} 的价格`);
    console.log(`新价格 (18位精度): ${ethers.formatUnits(newPrice, 18)}`);

    const ProductSubscription = await ethers.getContractFactory("ProductSubscription");
    const productSubscription = ProductSubscription.attach(contractAddress);

    // 获取当前价格
    const currentProduct = await productSubscription.getProduct(productId);
    console.log(`当前价格 (18位精度): ${ethers.formatUnits(currentProduct.amount, 18)}`);

    // 更新价格 (需要 PRODUCT_MANAGER_ROLE)
    const tx = await productSubscription.updateProduct(productId, newPrice);
    console.log(`交易已发送: ${tx.hash}`);

    await tx.wait();
    console.log(`✅ 产品价格更新成功!`);

    // 验证更新
    const updatedProduct = await productSubscription.getProduct(productId);
    console.log(`更新后价格 (18位精度): ${ethers.formatUnits(updatedProduct.amount, 18)}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
