# ProductSubscription V2 升级说明

## 漏洞修复概述

### 问题描述
V1版本存在严重的多币种精度处理漏洞：
- 产品价格直接存储原始数值，不考虑不同代币的精度差异
- 导致同一产品在不同精度代币下价格天差地别
- 攻击者可以利用低精度代币以极低价格购买产品

### 修复方案
V2升级实现了标准化的精度处理机制：
- 引入BASE_DECIMALS = 18作为基准精度
- 所有产品价格以18位精度存储和计算
- 购买时根据代币精度自动转换实际支付金额
- 添加代币精度验证和存储

## 升级内容

### 新增状态变量
```solidity
uint8 public constant BASE_DECIMALS = 18;
mapping(address => uint8) public tokenDecimals;
```

### 修改的函数
1. `addSupportedToken()` - 添加精度获取和验证
2. `removeSupportedToken()` - 清理精度记录
3. `purchaseProduct()` - 添加精度转换逻辑

### 新增函数
1. `convertPriceForToken()` - 精度转换核心函数
2. `batchUpdateTokenDecimals()` - 批量更新现有代币精度
3. `setTokenDecimals()` - 手动设置代币精度
4. `getPaymentInfo()` - 获取支付信息（前端使用）

## 升级步骤

### 1. 合约升级
```bash
# 设置代理合约地址
export PROXY_ADDRESS="0x你的代理合约地址"

# 执行升级
npx hardhat run scripts/upgradeProductSubscription.ts --network your-network
```

### 2. 升级后数据迁移
升级完成后必须执行以下步骤：

#### A. 更新现有代币精度信息
```typescript
// 获取所有现有支持的代币地址
const existingTokens = [
    "0x...", // USDT 地址
    "0x...", // USDC 地址
    // ... 其他代币地址
];

// 批量更新精度
await contract.batchUpdateTokenDecimals(existingTokens);
```

#### B. 验证精度信息
```typescript
for (const token of existingTokens) {
    const decimals = await contract.tokenDecimals(token);
    console.log(`Token ${token} decimals: ${decimals}`);
}
```

#### C. 测试精度转换
```typescript
const productId = 1;
const testTokens = [usdtAddress, daiAddress];

for (const token of testTokens) {
    const [amount, symbol, decimals] = await contract.getPaymentInfo(productId, token);
    console.log(`Product ${productId} costs ${amount} ${symbol} (${decimals} decimals)`);
}
```

### 3. 前端更新
前端需要使用新的`getPaymentInfo()`函数来显示准确的支付金额：

```javascript
// 获取产品在特定代币下的支付信息
const [actualAmount, tokenSymbol, tokenDecimals] = await contract.getPaymentInfo(productId, tokenAddress);

// 格式化显示
const formattedAmount = ethers.formatUnits(actualAmount, tokenDecimals);
console.log(`Price: ${formattedAmount} ${tokenSymbol}`);
```

## 存储布局兼容性

升级保持了存储布局兼容性：
- 缩减了`__gap`数组大小（从48到46）
- 新增状态变量占用2个存储槽
- 所有现有数据保持不变

## 安全考虑

### 1. 精度限制
- 限制代币最大精度为18位，拒绝超过此限制的代币
- 防止精度转换时的数值溢出

### 2. 权限控制
- `batchUpdateTokenDecimals()` 仅限ADMIN_ROLE调用
- `setTokenDecimals()` 仅限ADMIN_ROLE调用
- 保持现有的代币管理权限不变

### 3. 回退机制
- 如果代币精度获取失败，自动拒绝添加
- 手动设置功能作为特殊情况的备选方案

## 测试验证

运行完整的测试套件验证升级：

```bash
# 运行新的多代币精度测试
npx hardhat test test/ProductSubscription-MultiToken-test.ts

# 运行原有测试确保兼容性
npx hardhat test test/ProductSubscription-test.ts
```

## 升级检查清单

- [ ] 合约升级成功
- [ ] 所有现有代币精度信息已更新
- [ ] 验证精度转换功能正常
- [ ] 测试购买功能在不同精度代币下工作正常
- [ ] 前端已更新使用新的查询函数
- [ ] 运行完整测试套件验证

## 紧急情况处理

如果升级后发现问题：
1. 暂停合约操作：`pause()`
2. 检查代币精度设置是否正确
3. 使用`setTokenDecimals()`手动修正精度信息
4. 如有必要，准备回滚到上一个版本

## 注意事项

1. **升级前备份**：确保有完整的状态和配置备份
2. **测试网验证**：先在测试网络上完成升级和测试
3. **监控升级**：升级后密切监控合约行为和交易
4. **用户通知**：提前通知用户升级时间和可能的服务中断