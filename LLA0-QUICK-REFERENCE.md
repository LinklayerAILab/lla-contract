# LLA0 Token 快速参考

## 📋 基本信息

| 项目 | 值 |
|------|-----|
| 合约名称 | LLA0 |
| 代币符号 | LA0 |
| 精度 | 18 |
| 最大供应量 | 625,000,000 枚 (6.25亿) |
| 初始供应量 | 0 枚 |
| 部署网络 | BSC Testnet (bsctest) |
| Solidity 版本 | 0.8.27 |

---

## 🔑 角色配置

| 角色 | 来源 | 说明 |
|------|------|------|
| DEFAULT_ADMIN | 环境变量 `OWNER_ADDR` (私钥) | 脚本自动从私钥派生地址 |
| PAUSER | 环境变量 `PAUSER_ADDR` (私钥) | 脚本自动从私钥派生地址 |
| MINTER | 固定地址 | `0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311` |

---

## 🚀 快速部署

### 1. 配置 .env

```bash
# 私钥（不含 0x 前缀，脚本会自动转换为地址）
OWNER_ADDR=abc123def456...  # OWNER 私钥
PAUSER_ADDR=789xyz...       # PAUSER 私钥
```

### 2. 部署命令

```bash
npx hardhat run scripts/deployLLA0.ts --network bsctest
```

**部署前会自动检查：**
- ✅ 链 ID（Chain ID: 97）
- ✅ 当前区块高度
- ✅ 账户余额
- ✅ 网络连接状态

### 3. 验证命令

```bash
# 注意：验证时需要使用地址，不是私钥
npx hardhat verify --network bsctest \
  CONTRACT_ADDRESS \
  "DERIVED_ADMIN_ADDRESS" \
  "DERIVED_PAUSER_ADDRESS" \
  "0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311"

# 部署脚本会输出完整的验证命令和地址
```

---

## 🔧 常用命令

### 编译

```bash
npx hardhat compile
```

### 测试

```bash
npx hardhat test test/LLA0-test.ts
```

### Console

```bash
npx hardhat console --network bsctest
```

### 查询合约

```javascript
const lla0 = await ethers.getContractAt("LLA0", "CONTRACT_ADDRESS");
await lla0.name();          // "LLA0"
await lla0.symbol();        // "LA0"
await lla0.totalSupply();   // 当前总供应量
await lla0.MAX_SUPPLY();    // 最大供应量
```

---

## 📝 合约功能

### 用户功能
- ✅ `transfer(to, amount)` - 转账
- ✅ `approve(spender, amount)` - 授权
- ✅ `burn(amount)` - 销毁自己的代币

### MINTER 功能
- 🔐 `mint(to, amount)` - 铸造代币（上限 6.25亿）

### PAUSER 功能
- 🛑 `pause()` - 暂停所有转账
- ▶️ `unpause()` - 恢复转账

### ADMIN 功能
- 👤 `grantRole(role, account)` - 授予角色
- ❌ `revokeRole(role, account)` - 撤销角色

---

## 🔗 重要链接

- **BSCScan Testnet**: https://testnet.bscscan.com
- **BSC Faucet**: https://testnet.binance.org/faucet-smart
- **合约代码**: `contracts/LLA0.sol`
- **测试用例**: `test/LLA0-test.ts`
- **部署脚本**: `scripts/deployLLA0.ts`

---

## ⚠️ 注意事项

1. ✅ **环境变量是私钥**：`OWNER_ADDR` 和 `PAUSER_ADDR` 存储的是私钥，脚本会自动转换为地址
2. ✅ **MINTER 地址固定**：`0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311`
3. ✅ **网络名称**：使用 `bsctest` 而非 `bsc-testnet`
4. ✅ **私钥安全**：永远不要提交 .env 文件到 Git
5. ✅ **查看派生地址**：运行部署脚本时会显示从私钥派生的地址
6. ✅ **测试充分**：主网部署前必须充分测试

---

## 🆘 常见问题

**Q: 部署失败？**
A: 检查 BNB 余额，去水龙头获取测试币

**Q: 验证失败？**
A: 确保参数顺序正确：admin, pauser, minter

**Q: 环境变量应该填私钥还是地址？**
A: 填私钥！脚本会自动从私钥派生地址。

**Q: 如何查看派生的地址？**
A: 运行部署脚本时会显示在 "Derived Addresses" 部分。

**Q: 如何修改 MINTER？**
A: 编辑 `scripts/deployLLA0.ts` 第 26 行

**Q: 合约地址在哪？**
A: 查看 `deployments/` 目录下的 JSON 文件
