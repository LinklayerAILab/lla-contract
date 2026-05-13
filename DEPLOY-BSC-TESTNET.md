# LLA0 部署到币安测试网指南

## 📋 配置说明

### 网络配置
- **网络**: BSC Testnet (币安智能链测试网)
- **RPC URL**: https://data-seed-prebsc-1-s1.binance.org:8545/
- **Chain ID**: 97
- **浏览器**: https://testnet.bscscan.com

### 角色地址配置

| 角色 | 来源 | 说明 |
|------|------|------|
| **DEFAULT_ADMIN** | 环境变量 `OWNER_ADDR` (私钥) | 从私钥派生地址 |
| **PAUSER** | 环境变量 `PAUSER_ADDR` (私钥) | 从私钥派生地址 |
| **MINTER** | 固定地址 | `0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311` |

---

## 🔧 环境准备

### 1. 配置 .env 文件

创建或编辑 `.env` 文件，添加以下配置：

```bash
# OWNER 私钥（需要有 BNB 测试币，用于部署和作为 DEFAULT_ADMIN）
OWNER_ADDR=your_owner_private_key_here_without_0x

# PAUSER 私钥（用于作为 PAUSER 角色）
PAUSER_ADDR=your_pauser_private_key_here_without_0x

# BSCScan API Key（用于合约验证）
BSCSCAN_API_KEY=your_bscscan_api_key_here
```

**注意：**
- `OWNER_ADDR` 和 `PAUSER_ADDR` 都是**私钥**，脚本会自动转换为地址
- 私钥不要包含 `0x` 前缀（脚本会自动处理）
- 私钥格式：64位十六进制字符串（例如：`abc123...def`）

### 2. 获取测试网 BNB

访问以下水龙头获取测试 BNB：
- https://testnet.binance.org/faucet-smart
- https://testnet.bnbchain.org/faucet-smart

每次可以领取 0.5 BNB（约每24小时一次）

### 3. 检查 hardhat.config.ts

确保配置文件包含 BSC 测试网配置（已配置，网络名称为 `bsctest`）：

```typescript
networks: {
  bsctest: {
    url: "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
    chainId: 97,
    accounts: [OWNER_ADDR, ...],
  },
}
```

---

## 🚀 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 编译合约

```bash
npx hardhat compile
```

### 3. 运行部署脚本

```bash
npx hardhat run scripts/deployLLA0.ts --network bsctest
```

### 4. 预期输出

```
========================================
  Deploying LLA0 Token to BSC Testnet
========================================

Network: bsctest

--- Environment Variables (Private Keys) ---
OWNER_ADDR (Private Key): 0xabc123...def
PAUSER_ADDR (Private Key): 0x456789...xyz

--- Derived Addresses ---
OWNER_ADDR → DEFAULT_ADMIN: 0x1234567890abcdef1234567890abcdef12345678
PAUSER_ADDR → PAUSER: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

--- Fixed Addresses ---
MINTER (Fixed): 0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311

Deploying with account: 0x1234...5678
Account balance: 0.5 BNB

========================================
    Network Information
========================================
Chain ID: 97
Current Block Height: 12345678
Network Name: bnbt
✅ Chain ID verified: BSC Testnet

[Attempt 1/3] Deploying LLA0 contract...
Waiting for deployment transaction...
Deployment tx hash: 0xabc123...
Waiting for confirmations...

✅ LLA0 deployed successfully at: 0xDEF456...

========================================
    Verifying Contract State
========================================
Name: LLA0
Symbol: LA0
Decimals: 18
Max Supply: 625000000.0 LA0
Total Supply: 0.0 LA0

--- Role Verification ---
DEFAULT_ADMIN_ROLE assigned: ✅
PAUSER_ROLE assigned: ✅
MINTER_ROLE assigned: ✅

========================================
    Deployment Summary
========================================
Contract Address: 0xDEF456...
Network: bsctest
Deployment info saved to: deployments/LLA0-bsctest-2025-01-17T12-00-00.json

========================================
    Contract Verification (BSCScan)
========================================
To verify the contract on BSCScan, run:
npx hardhat verify --network bsc-testnet 0xDEF456... "0x1234..." "0xabcd..." "0xBa7B..."

BSCScan Testnet: https://testnet.bscscan.com/address/0xDEF456...

✅ Deployment to BSC Testnet completed successfully!

🎉 All done!
```

---

## 🔍 验证合约

### 自动验证（推荐）

```bash
# 使用部署时派生的地址（不是私钥！）
npx hardhat verify --network bsctest \
  CONTRACT_ADDRESS \
  "DERIVED_ADMIN_ADDRESS" \
  "DERIVED_PAUSER_ADDRESS" \
  "0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311"
```

**注意：** 部署脚本会在输出中显示完整的验证命令和派生的地址，直接复制使用即可。

### 手动验证

1. 访问 https://testnet.bscscan.com
2. 搜索您的合约地址
3. 点击 "Contract" 标签
4. 点击 "Verify and Publish"
5. 选择 Compiler 版本（0.8.27）
6. 上传源代码

---

## ✅ 部署后检查

### 1. 在 BSCScan 查看合约

访问：`https://testnet.bscscan.com/address/YOUR_CONTRACT_ADDRESS`

检查：
- ✅ 合约已部署
- ✅ 构造函数参数正确
- ✅ 交易状态成功

### 2. 验证角色分配

使用 Hardhat console：

```bash
npx hardhat console --network bsctest
```

```javascript
const lla0 = await ethers.getContractAt("LLA0", "YOUR_CONTRACT_ADDRESS");

// 检查 DEFAULT_ADMIN_ROLE
const adminRole = await lla0.DEFAULT_ADMIN_ROLE();
console.log(await lla0.hasRole(adminRole, "YOUR_OWNER_ADDR"));  // 应该是 true

// 检查 PAUSER_ROLE
const pauserRole = await lla0.PAUSER_ROLE();
console.log(await lla0.hasRole(pauserRole, "YOUR_PAUSER_ADDR"));  // 应该是 true

// 检查 MINTER_ROLE
const minterRole = await lla0.MINTER_ROLE();
console.log(await lla0.hasRole(minterRole, "0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311"));  // 应该是 true
```

### 3. 测试基本功能

```javascript
// 查看代币信息
console.log("Name:", await lla0.name());  // LLA0
console.log("Symbol:", await lla0.symbol());  // LA0
console.log("Max Supply:", await lla0.MAX_SUPPLY());  // 625000000000000000000000000
console.log("Total Supply:", await lla0.totalSupply());  // 0

// 测试铸造（需要使用 MINTER 账户）
// await lla0.mint("RECIPIENT_ADDRESS", ethers.parseEther("1000"));
```

---

## 📊 部署信息存储

部署成功后，信息会保存在 `deployments/` 目录：

```json
{
  "network": "bsctest",
  "contractName": "LLA0",
  "contractAddress": "0xDEF456...",
  "deployer": "0x1234...",
  "deploymentTxHash": "0xabc123...",
  "timestamp": "2025-01-17T12:00:00.000Z",
  "tokenInfo": {
    "name": "LLA0",
    "symbol": "LA0",
    "decimals": "18",
    "maxSupply": "625000000.0",
    "initialSupply": "0.0"
  },
  "roles": {
    "defaultAdmin": "0x1234...",
    "pauser": "0xabcd...",
    "minter": "0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311"
  }
}
```

---

## ⚠️ 注意事项

### 安全提醒
1. ✅ **私钥安全**：
   - 永远不要将私钥提交到 Git
   - 确保 `.env` 文件在 `.gitignore` 中
   - 脚本会隐藏私钥，只显示前后几位
   - 部署时会自动从私钥派生公钥地址
2. ✅ **测试网代币**：测试网 BNB 无价值，仅用于测试
3. ✅ **合约地址**：保存好部署的合约地址和派生的角色地址
4. ✅ **角色管理**：确认所有角色地址正确（脚本会显示派生的地址）

### MINTER 地址说明
- 固定地址：`0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311`
- 该地址拥有铸造权限，可以铸造代币（上限 6.25 亿）
- 请确保该地址的安全性

### 常见问题

**Q: 部署失败，提示 "Deployer account has no BNB balance"？**
A: 去水龙头获取测试 BNB：https://testnet.binance.org/faucet-smart

**Q: 如何更改 MINTER 地址？**
A: 修改 `scripts/deployLLA0.ts` 第 17 行的地址

**Q: 验证失败怎么办？**
A: 确保构造函数参数顺序正确：defaultAdmin, pauser, minter

**Q: 为什么环境变量是私钥而不是地址？**
A: 因为部署者需要使用私钥签署交易。脚本会自动从私钥派生出地址用于角色分配。

**Q: 派生的地址在哪里查看？**
A: 部署脚本运行时会在 "Derived Addresses" 部分显示所有派生的地址，并保存在部署信息 JSON 文件中。

**Q: 如何在主网部署？**
A: 不建议使用此脚本直接部署主网，请先充分测试并进行安全审计

---

## 🔗 相关链接

- **BSC Testnet 浏览器**: https://testnet.bscscan.com
- **BSC Testnet 水龙头**: https://testnet.binance.org/faucet-smart
- **BSC 文档**: https://docs.bnbchain.org
- **Hardhat 文档**: https://hardhat.org/docs

---

## 📞 支持

如有问题，请查看：
- LLA0 合约代码：`contracts/LLA0.sol`
- 测试用例：`test/LLA0-test.ts`
- 部署指南：`LLA0-DEPLOYMENT-GUIDE.md`
