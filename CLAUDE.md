# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / Test Commands

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run all tests
npx hardhat test

# Run a single test file
npx hardhat test test/ProductSubscription-test.ts

# Run test coverage report
npx hardhat coverage

# Start a local Hardhat node (for local deployment/testing)
npx hardhat node

# Deploy/run a script targeting a specific network
npx hardhat run scripts/<script>.ts --network <network_name>

# Verify a contract on Etherscan/BSCScan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Networks configured in `hardhat.config.ts`: `sepolia`, `bsctest`, `erbie` (custom).

## Architecture

This is a Solidity smart contract project using the **Hardhat** framework with **TypeScript** for scripts and tests. OpenZeppelin Contracts v5 (upgradeable + standard). Solidity compiler: `0.8.28` (via IR pipeline, optimizer enabled with `runs: 1` to minimize bytecode size).

### Contract Layers

**Token Layer:**
- `LLAToken.sol` — Upgradeable ERC20 (UUPS). Role-based access, pausable, burnable, capped supply (`1e27`). Roles: `ADMIN_ROLE`, `PAUSER_ROLE`, `MINTER_ROLE`, `UPGRADER_ROLE`.
- `LLAXToken.sol` — Upgradeable ERC20 (UUPS), similar to LLAToken.
- `LLA0.sol` — **Non-upgradeable** ERC20 + ERC20Permit. AccessControl-based. Capped supply: 6.25亿 (625M). Self-burn (`burn`). Roles: `PAUSER_ROLE`, `MINTER_ROLE`.
- `LLAx.sol` — **Non-upgradeable** ERC20 + ERC20Permit + Ownable. Total supply 1000亿 (100B), **decimals 18**. Simple owner-mintable.
- `NewLLAToken.sol` / `NewLLAXToken.sol` — Next-version token implementations for UUPS upgrades.

**Vault Layer:**
- `LLAVaultBase.sol` — Multi-token vault. Users deposit supported tokens → contract mints LLA at a configurable minting rate + sends a funding share to `multiSig`. Paginated payment record queries. Uses `LLAVaultAuth` for role management.
- `LLAVaultAuth.sol` — Authorization mixin used by `LLAVaultBase`.

**ProductSubscription Layer:**
- `ProductSubscription.sol` — Core subscription product contract. Multi-token payment with decimal-precision conversion. Roles: `ADMIN_ROLE`, `PAUSER_ROLE`, `TOKEN_MANAGER_ROLE`, `PRODUCT_MANAGER_ROLE`. Funds routed to `multiSig`. Upgradeable (UUPS) with `ReentrancyGuard`.

**Agent Layer:**
- `AgentScribe.sol` — Agent subscription service. Upgradeable (UUPS), pausable.

### Library Structure (ProductSubscription support)

All under `contracts/libraries/`:
| Library | Purpose |
|---|---|
| `ProductLib.sol` | `ProductItem` struct (productId, amount) + `findProductIndex` |
| `PurchaseLib.sol` | `PurchaseRecord` struct + `executePayment`, `getTokenSymbol`, `createPurchaseRecord` |
| `QueryLib.sol` | Paginated queries over `PurchaseRecord[]` (max pageSize 50, max page 1000) |
| `ProductQueryLib.sol` | Product list queries with pagination + consistency-aware fetching |
| `AdminLib.sol` | `addSupportedToken`, `removeSupportedToken`, `withdrawTokenToMultisig`, `withdrawAllTokensToMultisig` |
| `DecimalConversionLib.sol` | Price conversion across tokens with different decimals (e.g., 18-decimal USDT → 6-decimal USDC). Rounds **up** to prevent underpayment. |
| `ValidationLib.sol` | Telegram user ID validation (digits only, max 20 chars) |

### Key Patterns

- **UUPS Proxy**: All upgradeable contracts use `@openzeppelin/hardhat-upgrades` → `upgrades.deployProxy()` in scripts/tests and `upgrades.upgradeProxy()` for migrations.
- **Role-based access**: `DEFAULT_ADMIN_ROLE` → `ADMIN_ROLE` (manages others). Each functional role (`PAUSER_ROLE`, `MINTER_ROLE`, `UPGRADER_ROLE`, `TOKEN_MANAGER_ROLE`, `PRODUCT_MANAGER_ROLE`) is separate.
- **Library-extension pattern**: Contracts use `using XLib for YType` to attach library functions to storage arrays/mappings — e.g., `using ProductLib for ProductItem[]`.
- **SafeERC20** is used for all external token transfers; `ReentrancyGuardUpgradeable` on contracts handling funds.
- **Funds flow**: User payments → contract → `multiSig` address. Admin withdraws via `withdrawTokenToMultisig`.

## Environment & Configuration

- **Encrypted env**: Uses `@chainlink/env-enc` (`.env.enc`). Decrypts into env vars at runtime.
- **Private keys** come from env vars: `OWNER_ADDR`, `PAUSER_ADDR`, `MINTER_ADDR`, `UPGRADER_ADDR`, `TOKENMANAGER_ADDR`, `MULTISIG_ADDR`, `TESTADDR_1`, `TESTADDR_2`.
- **Test mocks**: `MockUSDT.sol` (18 decimals), `MockUSDC.sol` (6 decimals), `MockTokenZeroDecimals.sol`, `mocks/ERC20Mock.sol`.
