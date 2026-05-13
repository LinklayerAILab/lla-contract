# LLA0 本地测试指南

## 🏠 在 Hardhat 本地网络测试部署

在部署到 BSC 测试网之前，强烈建议先在本地 Hardhat 网络测试部署流程。

---

## 🚀 快速开始

### 1. 启动本地 Hardhat 节点

在第一个终端窗口运行：

```bash
npx hardhat node
```

**输出示例：**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

...
```

**保持此终端运行！**

---

### 2. 配置本地测试环境变量

创建或编辑 `.env` 文件：

```bash
# 使用 Hardhat 提供的测试账户私钥（仅用于本地测试！）
OWNER_ADDR=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PAUSER_ADDR=59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

⚠️ **警告**：这些是 Hardhat 默认的测试私钥，**仅用于本地测试，切勿用于主网或测试网！**

---

### 3. 运行部署脚本

在第二个终端窗口运行：

```bash
npx hardhat run scripts/deployLLA0.ts --network localhost
```

---

## 📊 本地部署输出示例

```
========================================
  Deploying LLA0 Token to BSC Testnet
========================================

Loaded OWNER_ADDR from env
Loaded PAUSER_ADDR from env
Network: localhost

--- Environment Variables (Private Keys) ---
OWNER_ADDR (Private Key): 0xac0974be...2ff80
PAUSER_ADDR (Private Key): 0x59c6995e...8690d

--- Derived Addresses ---
OWNER_ADDR → DEFAULT_ADMIN: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
PAUSER_ADDR → PAUSER: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

--- Fixed Addresses ---
MINTER (Fixed): 0xBa7B3387D88Bd7675DE8B492a9067dc6B7A59311

Deploying with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Account balance: 10000.0 ETH

========================================
    Network Information
========================================
Chain ID: 31337
Current Block Height: 0
Network Name: hardhat
Network Type: Hardhat Local Network
ℹ️  Running on local Hardhat network - For testing purposes

[Attempt 1/3] Deploying LLA0 contract...
Waiting for deployment transaction...
Deployment tx hash: 0x...
Waiting for confirmations...

✅ LLA0 deployed successfully at: 0x5FbDB2315678afecb367f032d93F642f64180aa3

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

✅ Deployment to local Hardhat network completed successfully!
```

---

## 🔍 测试合约功能

部署成功后，可以使用 Hardhat console 测试合约功能：

### 1. 启动 Console

```bash
npx hardhat console --network localhost
```

### 2. 连接到已部署的合约

```javascript
// 使用部署时输出的合约地址
const lla0 = await ethers.getContractAt("LLA0", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

// 查看基本信息
console.log("Name:", await lla0.name());  // LLA0
console.log("Symbol:", await lla0.symbol());  // LA0
console.log("Max Supply:", await lla0.MAX_SUPPLY());  // 625000000000000000000000000
console.log("Total Supply:", await lla0.totalSupply());  // 0
```

### 3. 测试铸造功能

```javascript
// 获取账户
const [owner, pauser, minter, user1] = await ethers.getSigners();

// 获取 MINTER_ROLE（需要先授予角色或使用已有 MINTER）
const MINTER_ROLE = await lla0.MINTER_ROLE();

// 检查是否有 MINTER 权限
const hasMinterRole = await lla0.hasRole(MINTER_ROLE, owner.address);
console.log("Has Minter Role:", hasMinterRole);

// 如果没有，先授予角色（使用 DEFAULT_ADMIN）
if (!hasMinterRole) {
  await lla0.grantRole(MINTER_ROLE, owner.address);
}

// 铸造代币
const mintAmount = ethers.parseEther("1000000");  // 100万枚
await lla0.mint(user1.address, mintAmount);

// 查看余额
console.log("User1 Balance:", ethers.formatEther(await lla0.balanceOf(user1.address)));
console.log("Total Supply:", ethers.formatEther(await lla0.totalSupply()));
```

### 4. 测试转账功能

```javascript
// user1 转账给其他人
const transferAmount = ethers.parseEther("10000");
await lla0.connect(user1).transfer(owner.address, transferAmount);

console.log("After transfer:");
console.log("User1 Balance:", ethers.formatEther(await lla0.balanceOf(user1.address)));
console.log("Owner Balance:", ethers.formatEther(await lla0.balanceOf(owner.address)));
```

### 5. 测试销毁功能

```javascript
// user1 销毁自己的代币
const burnAmount = ethers.parseEther("5000");
await lla0.connect(user1).burn(burnAmount);

console.log("After burn:");
console.log("User1 Balance:", ethers.formatEther(await lla0.balanceOf(user1.address)));
console.log("Total Supply:", ethers.formatEther(await lla0.totalSupply()));
```

### 6. 测试暂停功能

```javascript
// 获取 PAUSER_ROLE
const PAUSER_ROLE = await lla0.PAUSER_ROLE();

// 授予 pauser 账户暂停权限（如果还没有）
const hasPauserRole = await lla0.hasRole(PAUSER_ROLE, pauser.address);
if (!hasPauserRole) {
  await lla0.grantRole(PAUSER_ROLE, pauser.address);
}

// 暂停合约
await lla0.connect(pauser).pause();
console.log("Contract paused:", await lla0.paused());  // true

// 尝试转账（应该失败）
try {
  await lla0.connect(user1).transfer(owner.address, ethers.parseEther("100"));
} catch (error) {
  console.log("Transfer failed as expected:", error.message);
}

// 恢复合约
await lla0.connect(pauser).unpause();
console.log("Contract paused:", await lla0.paused());  // false

// 现在可以转账了
await lla0.connect(user1).transfer(owner.address, ethers.parseEther("100"));
console.log("Transfer succeeded after unpause");
```

---

## 🧪 运行自动化测试

在本地测试的同时，也应该运行自动化测试套件：

```bash
# 运行所有 LLA0 测试
npx hardhat test test/LLA0-test.ts

# 查看详细输出
npx hardhat test test/LLA0-test.ts --verbose

# 查看 Gas 报告
REPORT_GAS=true npx hardhat test test/LLA0-test.ts
```

---

## 📋 本地测试 vs BSC 测试网对比

| 特性 | 本地 Hardhat | BSC 测试网 |
|------|-------------|-----------|
| **启动速度** | 即时 | 需要等待区块确认 |
| **成本** | 免费 | 需要测试网 BNB |
| **网络速度** | 极快 | 依赖网络 |
| **重置** | 可随时重置 | 不可重置 |
| **区块浏览器** | 无 | BSCScan |
| **真实性** | 模拟环境 | 真实测试网 |
| **Chain ID** | 31337 | 97 |

---

## 🔄 在不同网络之间切换

### 本地网络
```bash
npx hardhat run scripts/deployLLA0.ts --network localhost
```

### BSC 测试网
```bash
npx hardhat run scripts/deployLLA0.ts --network bsctest
```

### Hardhat 默认网络（无需启动节点）
```bash
npx hardhat run scripts/deployLLA0.ts
```

---

## ⚠️ 注意事项

### 1. 私钥安全

**本地测试：**
```bash
# ✅ 可以使用 Hardhat 默认私钥
OWNER_ADDR=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**测试网/主网：**
```bash
# ❌ 永远不要使用公开的私钥！
# ✅ 生成新的私钥
OWNER_ADDR=your_real_private_key_here
```

### 2. 账户余额

- **本地网络**：每个账户默认 10000 ETH/BNB
- **测试网**：需要从水龙头获取
- **主网**：需要真实资金

### 3. 网络检测

脚本会自动检测当前网络：

```
Chain ID: 31337 → Hardhat Local Network
Chain ID: 97 → BSC Testnet
Chain ID: 56 → BSC Mainnet (会警告！)
```

### 4. 合约地址

- **本地网络**：每次重启节点后，合约地址会重置
- **测试网/主网**：合约地址永久有效

---

## 🎯 推荐的测试流程

1. **本地单元测试** ✅
   ```bash
   npx hardhat test test/LLA0-test.ts
   ```

2. **本地部署测试** ✅
   ```bash
   npx hardhat node  # 终端1
   npx hardhat run scripts/deployLLA0.ts --network localhost  # 终端2
   ```

3. **本地交互测试** ✅
   ```bash
   npx hardhat console --network localhost
   # 手动测试各种功能
   ```

4. **BSC 测试网部署** ✅
   ```bash
   npx hardhat run scripts/deployLLA0.ts --network bsctest
   ```

5. **测试网验证** ✅
   - 在 BSCScan 查看合约
   - 使用真实钱包交互测试

6. **主网部署** ⚠️
   - 完成安全审计
   - 使用多签钱包
   - 小心验证所有参数

---

## 🆘 常见问题

**Q: 本地节点启动后出错？**
A: 确保端口 8545 未被占用，或使用 `--port` 指定其他端口

**Q: 部署后找不到合约？**
A: 检查是否在正确的网络（localhost vs bsctest）

**Q: 如何重置本地网络？**
A: 重启 `npx hardhat node`

**Q: 本地测试需要真实的 BNB 吗？**
A: 不需要，Hardhat 会自动提供测试资金

**Q: 可以在本地网络验证合约吗？**
A: 不需要，本地网络不需要验证

---

## 📚 相关文档

- [部署到 BSC 测试网](./DEPLOY-BSC-TESTNET.md)
- [快速参考](./LLA0-QUICK-REFERENCE.md)
- [测试用例](./test/LLA0-test.ts)
- [Hardhat 文档](https://hardhat.org/docs)
