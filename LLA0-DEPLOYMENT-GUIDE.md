# LLA0 Token 部署和测试指南

## 📋 目录

- [合约概述](#合约概述)
- [环境准备](#环境准备)
- [运行测试](#运行测试)
- [部署合约](#部署合约)
- [合约验证](#合约验证)
- [部署后操作](#部署后操作)
- [安全建议](#安全建议)

---

## 🎯 合约概述

**LLA0** 是一个基于 OpenZeppelin 5.5.0 的 ERC20 代币合约，具有以下特性：

### 核心功能
- ✅ **ERC20 标准**: 完全符合 ERC20 标准
- ✅ **EIP-2612 Permit**: 支持无 gas 授权
- ✅ **可暂停**: 紧急情况下可暂停所有转账
- ✅ **受控铸造**: 只有 MINTER_ROLE 可以铸造代币
- ✅ **用户销毁**: 用户可以销毁自己的代币
- ✅ **访问控制**: 基于角色的权限管理

### 代币参数
| 参数 | 值 |
|------|-----|
| 名称 | LLA0 |
| 符号 | LA0 |
| 精度 | 18 |
| 最大供应量 | 625,000,000 (6.25亿) |
| 初始供应量 | 0 |

### 角色权限
- `DEFAULT_ADMIN_ROLE`: 管理所有角色的权限
- `MINTER_ROLE`: 铸造代币（不超过最大供应量）
- `PAUSER_ROLE`: 暂停/恢复合约

---

## 🔧 环境准备

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 网络配置
NETWORK=sepolia  # 或 mainnet, bsc, polygon 等

# 部署者私钥（不要泄露！）
DEPLOYER_PRIVATE_KEY=your_private_key_here

# 角色地址
DEFAULT_ADMIN_ADDR=0x...  # 默认管理员地址
PAUSER_ADDR=0x...         # 暂停者地址
MINTER_ADDR=0x...         # 铸造者地址

# Etherscan API Key (用于合约验证)
ETHERSCAN_API_KEY=your_api_key_here
```

### 3. 配置网络

确保 `hardhat.config.ts` 中配置了目标网络：

```typescript
networks: {
  sepolia: {
    url: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
    accounts: [DEPLOYER_PRIVATE_KEY],
  },
  // ... 其他网络
}
```

---

## 🧪 运行测试

### 运行所有测试

```bash
npx hardhat test
```

### 运行 LLA0 测试

```bash
npx hardhat test test/LLA0-test.ts
```

### 查看 Gas 报告

```bash
REPORT_GAS=true npx hardhat test test/LLA0-test.ts
```

### 查看覆盖率

```bash
npx hardhat coverage
```

### 测试用例说明

测试文件 `test/LLA0-test.ts` 包含以下测试模块：

1. **部署和初始化测试** - 验证合约正确部署和初始化
2. **Mint 功能测试** - 测试代币铸造功能和限制
3. **Burn 功能测试** - 测试代币销毁功能
4. **Pause 功能测试** - 测试暂停/恢复功能
5. **角色管理测试** - 测试访问控制和权限管理
6. **ERC20 标准功能测试** - 测试转账、授权等标准功能
7. **Permit 功能测试** - 测试 EIP-2612 功能
8. **边界条件测试** - 测试各种边界情况和安全性
9. **事件测试** - 验证所有事件正确触发
10. **Gas 优化测试** - 报告主要操作的 gas 消耗

---

## 🚀 部署合约

### 1. 本地测试网部署

```bash
# 启动本地节点
npx hardhat node

# 在新终端部署
npx hardhat run scripts/deployLLA0.ts --network localhost
```

### 2. 测试网部署 (Sepolia)

```bash
npx hardhat run scripts/deployLLA0.ts --network sepolia
```

### 3. 主网部署

⚠️ **部署到主网前请务必：**
1. 完成所有测试
2. 进行安全审计
3. 使用多签钱包管理角色
4. 仔细检查所有地址

```bash
npx hardhat run scripts/deployLLA0.ts --network mainnet
```

### 4. 部署输出

部署成功后会：
- 在控制台显示合约地址和配置信息
- 在 `deployments/` 目录下保存 JSON 格式的部署信息
- 显示 Etherscan 验证命令

示例输出：
```
========================================
    Deploying LLA0 Token Contract
========================================

Network: sepolia
Default Admin: 0x1234...
Pauser: 0x5678...
Minter: 0x9abc...

✅ LLA0 deployed successfully at: 0xDEF...

========================================
    Contract Verification
========================================
To verify the contract on block explorer, run:
npx hardhat verify --network sepolia 0xDEF... "0x1234..." "0x5678..." "0x9abc..."

✅ Deployment completed successfully!
```

---

## 🔍 合约验证

### Etherscan 验证

```bash
npx hardhat verify --network sepolia \
  DEPLOYED_CONTRACT_ADDRESS \
  "DEFAULT_ADMIN_ADDRESS" \
  "PAUSER_ADDRESS" \
  "MINTER_ADDRESS"
```

### 验证成功后

访问区块浏览器（如 Etherscan）可以：
- 查看合约源代码
- 直接与合约交互
- 查看所有交易历史

---

## ⚙️ 部署后操作

### 1. 验证角色分配

使用区块浏览器或 Hardhat console 验证：

```javascript
const lla0 = await ethers.getContractAt("LLA0", "DEPLOYED_ADDRESS");

// 检查角色
const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();
await lla0.hasRole(DEFAULT_ADMIN_ROLE, "ADMIN_ADDRESS");
```

### 2. 铸造初始代币（可选）

```javascript
// 使用 MINTER_ROLE 账户
const lla0 = await ethers.getContractAt("LLA0", "DEPLOYED_ADDRESS");
await lla0.mint("RECIPIENT_ADDRESS", ethers.parseEther("1000000"));
```

### 3. 转移角色到多签钱包（强烈推荐）

```javascript
// 使用 DEFAULT_ADMIN_ROLE 账户
const GNOSIS_SAFE_ADDRESS = "0x..."; // Gnosis Safe 多签地址

const DEFAULT_ADMIN_ROLE = await lla0.DEFAULT_ADMIN_ROLE();
const MINTER_ROLE = await lla0.MINTER_ROLE();
const PAUSER_ROLE = await lla0.PAUSER_ROLE();

// 授予多签钱包所有角色
await lla0.grantRole(DEFAULT_ADMIN_ROLE, GNOSIS_SAFE_ADDRESS);
await lla0.grantRole(MINTER_ROLE, GNOSIS_SAFE_ADDRESS);
await lla0.grantRole(PAUSER_ROLE, GNOSIS_SAFE_ADDRESS);

// 撤销原地址的角色
await lla0.renounceRole(DEFAULT_ADMIN_ROLE, "YOUR_ADDRESS");
await lla0.renounceRole(MINTER_ROLE, "YOUR_ADDRESS");
await lla0.renounceRole(PAUSER_ROLE, "YOUR_ADDRESS");
```

---

## 🔒 安全建议

### 部署前
1. ✅ 运行完整测试套件
2. ✅ 进行代码审计（建议第三方）
3. ✅ 在测试网充分测试
4. ✅ 使用硬件钱包管理私钥

### 部署时
1. ✅ 仔细检查所有地址参数
2. ✅ 使用多签钱包作为角色地址
3. ✅ 保存所有部署信息
4. ✅ 验证合约源代码

### 部署后
1. ✅ 验证角色正确分配
2. ✅ 将角色转移到多签钱包
3. ✅ 设置监控和告警
4. ✅ 准备应急响应计划

### 最佳实践

#### 多签钱包配置
- **DEFAULT_ADMIN_ROLE**: 3/5 或 4/7 多签
- **MINTER_ROLE**: 2/3 或 3/5 多签
- **PAUSER_ROLE**: 2/3 多签（应急响应）

#### 权限分离
- ❌ 不要让同一个地址拥有所有角色
- ✅ 使用不同的多签钱包管理不同角色
- ✅ 定期审查角色成员

#### 应急预案
- 📋 准备暂停合约的流程
- 📋 准备角色撤销的流程
- 📋 建立 24/7 监控系统

---

## 📚 常用命令参考

### Hardhat Console

```bash
# 连接到已部署的合约
npx hardhat console --network sepolia

# 在 console 中
const lla0 = await ethers.getContractAt("LLA0", "DEPLOYED_ADDRESS");
await lla0.name();
await lla0.totalSupply();
await lla0.balanceOf("ADDRESS");
```

### 查询链上信息

```javascript
// 获取合约实例
const lla0 = await ethers.getContractAt("LLA0", "DEPLOYED_ADDRESS");

// 基本信息
console.log("Name:", await lla0.name());
console.log("Symbol:", await lla0.symbol());
console.log("Total Supply:", await lla0.totalSupply());
console.log("Max Supply:", await lla0.MAX_SUPPLY());

// 角色检查
const MINTER_ROLE = await lla0.MINTER_ROLE();
console.log("Has Minter Role:", await lla0.hasRole(MINTER_ROLE, "ADDRESS"));
```

---

## 🆘 故障排除

### 部署失败

**问题**: Gas 不足
```
Error: insufficient funds for gas * price + value
```
**解决**: 确保部署账户有足够的 ETH

**问题**: Nonce 错误
```
Error: nonce has already been used
```
**解决**: 等待之前的交易确认或重置 nonce

### 测试失败

**问题**: TypeChain 类型错误
```
Cannot find module '../typechain-types'
```
**解决**: 运行 `npx hardhat compile` 生成类型

### 验证失败

**问题**: 构造函数参数不匹配
**解决**: 确保验证命令中的参数与部署时完全一致

---

## 📞 联系方式

如有问题，请联系开发团队或提交 Issue。

---

## 📄 许可证

MIT License
