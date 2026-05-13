# LLA0 部署脚本输出示例

## 完整输出示例

运行 `npx hardhat run scripts/deployLLA0.ts --network bsctest` 后的完整输出：

```
========================================
  Deploying LLA0 Token to BSC Testnet
========================================

Loaded OWNER_ADDR from env
Loaded PAUSER_ADDR from env
Network: bsctest

--- Environment Variables (Private Keys) ---
OWNER_ADDR (Private Key): 0xabc123de...4567
PAUSER_ADDR (Private Key): 0x87654321...abcd

--- Derived Addresses ---
OWNER_ADDR → DEFAULT_ADMIN: 0x1234567890abcdef1234567890abcdef12345678
PAUSER_ADDR → PAUSER: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

--- Fixed Addresses ---
MINTER (Fixed): 0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311

Deploying with account: 0x1234567890abcdef1234567890abcdef12345678
Account balance: 0.5 BNB

========================================
    Network Information
========================================
Chain ID: 97
Current Block Height: 45678901
Network Name: bnbt
✅ Chain ID verified: BSC Testnet

[Attempt 1/3] Deploying LLA0 contract...
Waiting for deployment transaction...
Deployment tx hash: 0xabc123def456789abc123def456789abc123def456789abc123def456789abcd
Waiting for confirmations...

✅ LLA0 deployed successfully at: 0xDEF456789ABC123DEF456789ABC123DEF4567890

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
Contract Address: 0xDEF456789ABC123DEF456789ABC123DEF4567890
Network: bsctest
Deployment info saved to: deployments/LLA0-bsctest-2025-01-17T12-00-00-000Z.json

========================================
    Contract Verification (BSCScan)
========================================
To verify the contract on BSCScan, run:
npx hardhat verify --network bsctest 0xDEF456789ABC123DEF456789ABC123DEF4567890 "0x1234567890abcdef1234567890abcdef12345678" "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" "0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311"

BSCScan Testnet: https://testnet.bscscan.com/address/0xDEF456789ABC123DEF456789ABC123DEF4567890

✅ Deployment to BSC Testnet completed successfully!

🎉 All done!
```

---

## 输出说明

### 1. 环境变量加载检查
```
Loaded OWNER_ADDR from env
Loaded PAUSER_ADDR from env
```
- 确认私钥已从 .env 文件成功加载

### 2. 私钥信息（隐藏）
```
--- Environment Variables (Private Keys) ---
OWNER_ADDR (Private Key): 0xabc123de...4567
PAUSER_ADDR (Private Key): 0x87654321...abcd
```
- 只显示私钥的前 10 位和后 4 位
- 保护隐私，防止私钥泄露

### 3. 派生的地址
```
--- Derived Addresses ---
OWNER_ADDR → DEFAULT_ADMIN: 0x1234567890abcdef1234567890abcdef12345678
PAUSER_ADDR → PAUSER: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```
- 从私钥自动派生的公钥地址
- 这些地址将被用于角色分配

### 4. 固定地址
```
--- Fixed Addresses ---
MINTER (Fixed): 0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311
```
- MINTER 角色使用固定地址

### 5. 部署者信息
```
Deploying with account: 0x1234567890abcdef1234567890abcdef12345678
Account balance: 0.5 BNB
```
- 显示部署账户地址和余额
- 确保有足够的 BNB 支付 gas

### 6. **网络信息（新增）** ⭐
```
========================================
    Network Information
========================================
Chain ID: 97
Current Block Height: 45678901
Network Name: bnbt
✅ Chain ID verified: BSC Testnet
```
- **Chain ID**: 当前连接的区块链 ID（BSC Testnet = 97）
- **Current Block Height**: 当前区块高度
- **Network Name**: 网络名称
- **验证结果**: 自动验证是否连接到正确的网络

### 7. 部署过程
```
[Attempt 1/3] Deploying LLA0 contract...
Waiting for deployment transaction...
Deployment tx hash: 0xabc123...
Waiting for confirmations...
```
- 显示部署尝试次数
- 显示交易哈希
- 等待区块确认

### 8. 合约状态验证
```
Name: LLA0
Symbol: LA0
Decimals: 18
Max Supply: 625000000.0 LA0
Total Supply: 0.0 LA0

--- Role Verification ---
DEFAULT_ADMIN_ROLE assigned: ✅
PAUSER_ROLE assigned: ✅
MINTER_ROLE assigned: ✅
```
- 验证代币基本信息
- 验证所有角色正确分配

### 9. 部署总结
```
Contract Address: 0xDEF456...
Network: bsctest
Deployment info saved to: deployments/LLA0-bsctest-2025-01-17T12-00-00-000Z.json
```
- 合约地址
- 部署的网络
- 部署信息保存位置

### 10. 验证命令
```
To verify the contract on BSCScan, run:
npx hardhat verify --network bsctest 0xDEF... "0x1234..." "0xabcd..." "0xBa7B..."

BSCScan Testnet: https://testnet.bscscan.com/address/0xDEF...
```
- 完整的验证命令（复制即可使用）
- BSCScan 链接

---

## 网络验证说明

### ✅ 正确的网络
```
Chain ID: 97
✅ Chain ID verified: BSC Testnet
```

### ⚠️ 错误的网络
如果连接到错误的网络，会显示警告：
```
Chain ID: 56
⚠️  Warning: Expected Chain ID 97 (BSC Testnet), but got 56
```

这表示您可能连接到了 BSC 主网而不是测试网，请检查配置！

---

## 常见链 ID 参考

| 网络 | Chain ID | 说明 |
|------|----------|------|
| BSC Testnet | 97 | 币安智能链测试网 ✅ |
| BSC Mainnet | 56 | 币安智能链主网 |
| Ethereum Mainnet | 1 | 以太坊主网 |
| Sepolia Testnet | 11155111 | 以太坊 Sepolia 测试网 |
| Polygon Mainnet | 137 | Polygon 主网 |
| Polygon Mumbai | 80001 | Polygon 测试网 |

---

## 部署信息 JSON 文件

部署成功后，所有信息会保存在 `deployments/` 目录下：

```json
{
  "network": "bsctest",
  "contractName": "LLA0",
  "contractAddress": "0xDEF456...",
  "deployer": "0x1234...",
  "deploymentTxHash": "0xabc123...",
  "timestamp": "2025-01-17T12:00:00.000Z",
  "networkInfo": {
    "chainId": "97",
    "blockHeight": "45678901",
    "networkName": "bnbt"
  },
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
  },
  "verification": {
    "adminRoleAssigned": true,
    "pauserRoleAssigned": true,
    "minterRoleAssigned": true
  }
}
```

---

## 故障排除

### 链 ID 不匹配
**问题**: `Warning: Expected Chain ID 97, but got X`

**原因**: 连接到错误的网络

**解决**:
1. 检查 hardhat.config.ts 中的 RPC URL
2. 确保使用 `--network bsctest`
3. 检查 .env 中的网络配置

### 区块高度为 0
**问题**: `Current Block Height: 0`

**原因**: RPC 节点无响应或网络连接问题

**解决**:
1. 检查网络连接
2. 更换 RPC 端点
3. 等待几秒后重试
