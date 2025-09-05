# ProductSubscription 合约部署指南

本指南说明如何将 ProductSubscription 合约部署到 Erbie 链 (Chain ID: 51888)。

## 🚀 快速部署

### 1. 环境准备

确保您的环境变量已配置：
```bash
# .env 文件示例
OWNER_ADDR=0x你的私钥...
PAUSER_ADDR=0x暂停权限私钥...
MINTER_ADDR=0x铸币权限私钥...
UPGRADER_ADDR=0x升级权限私钥...
TOKENMANAGER_ADDR=0x代币管理私钥...
MULTISIG_ADDR=0x多签地址私钥...
```

### 2. 部署合约

```bash
# 使用完整部署脚本
npx hardhat run scripts/deployProductSubscription.ts --network erbie

# 或使用简化部署脚本 (推荐新手使用)
npx hardhat run scripts/deployProductSubscriptionSimple.ts --network erbie
```

### 3. 添加支持的代币

首先在 `scripts/addSupportedTokens.ts` 中配置实际的代币地址：

```typescript
const TOKEN_ADDRESSES = {
  USDT: "0x实际的USDT合约地址",
  USDC: "0x实际的USDC合约地址",
};
```

然后运行：
```bash
# 方式1: 使用环境变量
CONTRACT_ADDRESS=0x部署的合约地址 npx hardhat run scripts/addSupportedTokens.ts --network erbie

# 方式2: 使用命令行参数
npx hardhat run scripts/addSupportedTokens.ts --network erbie 0x部署的合约地址
```

### 4. 添加商品

```bash
# 添加预设的商品
npx hardhat run scripts/addProducts.ts --network erbie 0x部署的合约地址
```

## 🔧 网络配置

已在 `hardhat.config.ts` 中配置了 Erbie 网络：

```typescript
erbie: {
  url: "https://api.erbie.io",
  chainId: 51888,
  gasPrice: "auto",
  timeout: 120000,
}
```

## 📋 部署脚本详解

### deployProductSubscription.ts
- 完整的部署脚本，包含详细的验证和日志
- 自动保存部署信息到 `deployments/` 目录
- 包含角色权限验证

### deployProductSubscriptionSimple.ts
- 简化的部署脚本，适合快速部署
- 所有角色使用同一个地址（适合测试）
- 包含基本的错误处理

### addSupportedTokens.ts
- 批量添加支持的代币
- 自动检查权限和代币状态
- 支持跳过已存在的代币

### addProducts.ts
- 批量添加商品
- 预设了4种订阅套餐
- 自动检查商品是否已存在

## 📝 使用示例

### 完整的部署流程

1. **部署合约**：
```bash
npx hardhat run scripts/deployProductSubscriptionSimple.ts --network erbie
# 记录输出的合约地址
```

2. **配置代币地址**：
编辑 `scripts/addSupportedTokens.ts`，替换实际的代币地址

3. **添加支持代币**：
```bash
npx hardhat run scripts/addSupportedTokens.ts --network erbie 0x你的合约地址
```

4. **添加商品**：
```bash
npx hardhat run scripts/addProducts.ts --network erbie 0x你的合约地址
```

### 验证部署

```bash
# 连接到合约并检查状态
npx hardhat console --network erbie

# 在控制台中运行
const contract = await ethers.getContractAt("ProductSubscription", "0x你的合约地址");
await contract.version(); // 应该返回 "v1.0"
await contract.getProductCount(); // 查看商品数量
```

## ⚠️ 注意事项

### 安全建议

1. **生产环境**：
   - 使用不同的地址分配不同的角色
   - 将关键角色转移给多签钱包
   - 在测试网充分测试后再部署到主网

2. **权限管理**：
   - `DEFAULT_ADMIN_ROLE`: 超级管理员权限
   - `PRODUCT_MANAGER_ROLE`: 商品管理权限
   - `TOKEN_MANAGER_ROLE`: 代币管理权限
   - `PAUSER_ROLE`: 暂停合约权限
   - `UPGRADER_ROLE`: 合约升级权限

3. **Gas 优化**：
   - 批量操作时注意 Gas 限制
   - 在测试网先测试 Gas 消耗

### 故障排除

1. **部署失败**：
   - 检查账户余额是否足够
   - 验证网络连接：`curl https://api.erbie.io`
   - 检查私钥格式是否正确

2. **权限错误**：
   - 确认当前账户有相应的角色权限
   - 使用管理员账户授予权限

3. **代币添加失败**：
   - 验证代币地址是否正确
   - 确认代币合约实现了标准的 ERC20 接口

## 🔍 验证和监控

### 区块链浏览器验证
- 访问 Erbie 区块链浏览器
- 搜索您的合约地址
- 验证交易历史和合约状态

### 合约交互测试
```bash
# 测试购买流程（需要先有支持的代币和商品）
npx hardhat console --network erbie

const contract = await ethers.getContractAt("ProductSubscription", "合约地址");
// 查看支持的代币
await contract.supportCoins("USDT地址");
// 查看商品
await contract.getProduct(1);
```

## 📞 支持

如果遇到问题，请检查：
1. 网络配置是否正确
2. 私钥和地址是否匹配
3. Gas 设置是否合理
4. 代币地址是否有效

部署成功后，请妥善保管：
- 合约地址
- 部署者私钥
- 各角色的私钥
- 部署交易哈希