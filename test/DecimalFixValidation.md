# 多币种精度漏洞修复验证

## 测试环境配置

- **MockUSDT**: 18 精度 (decimals = 18)
- **MockUSDC**: 6 精度 (decimals = 6)  
- **基准精度**: 18 位 (BASE_DECIMALS = 18)

## 核心修复验证

### 1. 精度转换测试

```typescript
// 测试用例：convertPriceForToken应该正确转换不同精度代币的价格
const basePrice = ethers.parseUnits("100", 18); // 100美元，18位精度

// USDT (18精度): 应该返回原始价格
const usdtPrice = await productSubscription.convertPriceForToken(basePrice, mockUSDT.address);
expect(usdtPrice).to.equal(basePrice); // 100000000000000000000

// USDC (6精度): 应该转换为6位精度  
const usdcPrice = await productSubscription.convertPriceForToken(basePrice, mockUSDC.address);
expect(usdcPrice).to.equal(ethers.parseUnits("100", 6)); // 100000000
```

### 2. 购买等值验证

```typescript
// 测试用例：不同精度代币购买同一产品应支付相同美元价值
const productPrice = ethers.parseUnits("200", 18); // 200美元的产品

// 用户1用USDT购买 (18精度)
await productSubscription.connect(user1).purchaseProduct(productId, "order-usdt-001", mockUSDT.address, TELEGRAM_USER_ID_1);

// 用户2用USDC购买 (6精度)  
await productSubscription.connect(user2).purchaseProduct(productId, "order-usdc-001", mockUSDC.address, TELEGRAM_USER_ID_2);

// 验证多签地址收到的代币数量
expect(finalUSDTBalance - initialUSDTBalance).to.equal(ethers.parseUnits("200", 18)); // 200.000000000000000000 USDT
expect(finalUSDCBalance - initialUSDCBalance).to.equal(ethers.parseUnits("200", 6));  // 200.000000 USDC
```

## 漏洞修复前后对比

### V1版本（有漏洞）
假设产品价格存储为 `100 * 10^18`（100美元）：

| 代币 | 精度 | V1支付金额 | 实际价值 |
|------|------|------------|----------|
| USDT | 18 | 100 * 10^18 | $100 ✓ |
| USDC | 6  | 100 * 10^18 | $100,000,000,000,000 ❌ |

### V2版本（已修复）
相同的产品价格 `100 * 10^18`：

| 代币 | 精度 | V2支付金额 | 实际价值 | 转换逻辑 |
|------|------|------------|----------|----------|
| USDT | 18 | 100 * 10^18 | $100 ✓ | 无需转换 |
| USDC | 6  | 100 * 10^6  | $100 ✓ | 除以10^(18-6) |

## 关键测试用例

### 1. 精度信息存储测试
```typescript
it("应该正确存储不同精度代币的精度信息", async function () {
    expect(await productSubscription.tokenDecimals(mockUSDT.address)).to.equal(18);
    expect(await productSubscription.tokenDecimals(mockUSDC.address)).to.equal(6);
    expect(await productSubscription.BASE_DECIMALS()).to.equal(18);
});
```

### 2. 支付信息查询测试
```typescript
it("getPaymentInfo应该返回正确的支付信息", async function () {
    const [usdtAmount, usdtSymbol, usdtDecimals] = await productSubscription.getPaymentInfo(productId, mockUSDT.address);
    const [usdcAmount, usdcSymbol, usdcDecimals] = await productSubscription.getPaymentInfo(productId, mockUSDC.address);
    
    expect(usdtAmount).to.equal(ethers.parseUnits("50", 18));
    expect(usdcAmount).to.equal(ethers.parseUnits("50", 6));
});
```

### 3. 购买记录准确性测试
```typescript
it("购买记录应该记录实际支付的代币数量", async function () {
    await productSubscription.connect(user1).purchaseProduct(productId, "order-record-test", mockUSDC.address, TELEGRAM_USER_ID_1);
    
    const records = await productSubscription.getPurchaseRecordsByTelegramUserId(TELEGRAM_USER_ID_1, 1, 10);
    expect(records[0].amount).to.equal(ethers.parseUnits("150", 6)); // 实际支付的USDC数量
});
```

### 4. 事件记录准确性测试
```typescript
it("事件应该记录实际支付的代币数量", async function () {
    await expect(transaction).to.emit(productSubscription, "PaymentDeposited")
        .withArgs(productId, buyer, userId, timestamp, ethers.parseUnits("75", 18), mockUSDT.address, purchaseId);
});
```

### 5. 管理功能测试
```typescript
it("批量更新代币精度功能应该正常工作", async function () {
    await productSubscription.connect(admin).batchUpdateTokenDecimals([mockUSDT.address, mockUSDC.address]);
    expect(await productSubscription.tokenDecimals(mockUSDT.address)).to.equal(18);
    expect(await productSubscription.tokenDecimals(mockUSDC.address)).to.equal(6);
});
```

## 安全边界测试

### 1. 精度验证
```typescript
it("应该拒绝超过18位精度的代币", async function () {
    const invalidToken = await ERC20MockFactory.deploy("Invalid Token", "INVALID", 19);
    await expect(productSubscription.addSupportedToken(invalidToken.address))
        .to.be.revertedWith("Unsupported decimals");
});
```

### 2. 未设置精度的代币
```typescript
it("应该拒绝精度未设置的代币购买", async function () {
    await productSubscription.connect(admin).setTokenDecimals(mockUSDT.address, 0);
    await expect(productSubscription.purchaseProduct(...))
        .to.be.revertedWith("Token not supported or decimals not set");
});
```

## 运行测试

```bash
# 运行所有多币种精度测试
npx hardhat test test/ProductSubscription-test.ts --grep "V2升级：多币种精度处理测试"

# 运行完整测试套件
npx hardhat test test/ProductSubscription-test.ts
```

## 预期结果

✅ 所有测试用例应该通过  
✅ 不同精度代币购买同一产品支付相同美元价值  
✅ 购买记录和事件记录实际支付金额  
✅ 精度转换函数正确工作  
✅ 管理功能正常运行  
✅ 安全边界检查生效