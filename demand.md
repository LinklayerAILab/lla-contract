# `Deposit`

`存入USDT或者USDC，获取一定的LLA`

---

## 任务

- LLA 合约
- 金库合约
- 权限管理合约
- 测试合约

## 合约功能

- LLA Contract
- ERC20 代币，带有MinterRole，允许质押合约角色铸造LLA
- AccessManager Contract

需要配置合约部署者为可升级合约的角色
需要配置金库合约为可以mint LLA的地址
需要配置合约部署者为可更改汇率的角色
需要配置合约部署者可以增加或删减支持的Token 列表
配置relayer角色来操作mint

## Vault Contract

- 合约部署者可提取USDC/USDT`
- 存储付款记录，需考虑具体的字段(payer，time，amount,token type等)
- 设置汇率(USDT/LLA)
- 支持暂停提取，pauseable合约继承

---

## Test Contract

- 主要是测试部分需要写mock 合约`

---

## 要求

```
- solidity 编码规范，基本注释
- 使用UUPS升级合约模式
- 测试UUPS升级是否正常
```

```
测试框架使用forge，可在hardhat 中使用forge插件
需要进行单元测试，覆盖函数和逻辑分支更需要进行集成测试，测试三个合约的交互:用户deposit USDT,金库合约mint LLA,用户收到LLA模糊测试(FUZZing):使用模糊测试工具自动生成大量的随机输入，测试合约是有意外行为·转账使用safeERC20
- 使用ownable 合约来管理合约所有权
- 使用AccessControl合约来做权限控制，或者其他库，若有更优解·需使用接口定义金库合约行为
- 使用safeMath做运算
支持暂停合约
部署配置脚本化
```

最新更新于 2025年2月26日
