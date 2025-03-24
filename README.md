# LLA Contract Project Guide

This project includes the LLA token and vault contract system, developed using the Hardhat framework. Below are the setup, testing, and deployment guidelines for the project.

## Project Structure

lla-contract/
├── contracts/                 # Smart contract source code
│   ├── LLAToken.sol           # LLA token contract
│   ├── LLAVaultBase.sol       # Vault base contract
│   └── LLAVaultAuth.sol       # Authorization management contract
├── scripts/                   # Deployment scripts
├── test/                      # Test files
│   ├── LLAVaultBase-test.ts   # Vault contract tests
│   └── LLAToken-test.ts       # Token contract tests
├── hardhat.config.ts          # Hardhat configuration file
└── README.md                  # Project documentation

## Environment Requirements

- Node.js v16+
- npm or yarn

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/lla-contract.git 
cd lla-contract
npm install
```

## Contract Overview

- `LLAToken.sol`: An LLA token contract implementing the ERC20 standard.
- `LLAVaultBase.sol`: The vault base contract, containing basic vault functionalities.
- `LLAVaultAuth.sol`: The authorization management contract, used for managing vault permissions.

### LLAToken

LLA token is an upgradable ERC20-compliant token with the following features:

- Pausable transactions
- Role-based access control
- Upgradeable design (UUPS pattern)
- Token minting and burning capabilities

### LLAVaultBase

The LLA vault contract is used for managing token deposits and withdrawals, with the following features:

- Support for multiple token deposits
- Automatic minting of LLA tokens upon deposit
- Paginated payment record queries
- Role-based access control
- Upgradeable design (UUPS pattern)

### LLAVaultAuth

The authorization management contract is used for managing vault permissions, with the following features:

- Role-based access control
- Upgradeable design (UUPS pattern)

## Testing

The project uses the Hardhat testing framework and Chai assertion library for testing.

### Running All Tests

```bash
npx hardhat test
```

### Running Specific Test Files

```bash
npx hardhat test test/LLAVaultBase-test.ts
npx hardhat test test/LLAToken-test.ts
```

## Test Coverage Report

```bash
npx hardhat coverage
```

## Deployment

The project uses Hardhat deployment scripts for contract deployment.

### Deploying to a Local Development Network

Start a local node:

```bash
npx hardhat node
```

Deploy contracts in another terminal window:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### Deploying to Other Networks

Modify the network configuration in the `hardhat.config.ts` file as needed.
Deploy contracts:

```bash
npx hardhat run scripts/deploy.ts --network <network_name>
```

### Contract Verification

Modify the Etherscan API configuration in the `hardhat.config.ts` file as needed.
Verify contracts:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Interacting with Contracts

```bash
npx hardhat console --network localhost
```

Example interactions:

```javascript
const llaToken = await ethers.getContract("LLAToken");
await llaToken.mint(addr1.address, ethers.utils.parseEther("1000"));
const llaVault = await ethers.getContract("LLAVaultBase");
await llaVault.connect(addr1).deposit(tokenAddress, depositAmount);
```

### Using Scripts

Modify the script files in the `ignition/` directory as needed.
Run scripts:

```bash
npx hardhat run scripts/interact.ts --network localhost
```

### Development Guidelines

### Adding New Features

1. Modify or add contracts in the `contracts/` directory.
2. Add corresponding tests in the `test/` directory.
3. Run tests to ensure functionality.
4. Update deployment scripts to include new features.

### Contract Upgrades

The project uses the UUPS proxy pattern for contract upgrades:

1. Create a new version of the implementation contract.
2. Upgrade the contract using the `upgrades.upgradeProxy()` function.
3. Verify the state of the upgraded contract.

## Security Considerations

- All critical operations require appropriate role permissions.
- Use a multisig wallet to manage critical operations.
- Reentrancy protection is implemented.
- Contract pausing functionality is available for emergencies.

## Common Issues

### Test Failures

If you encounter test failures, especially errors related to event parameters:

```bash
HH17: The input value cannot be normalized to a BigInt
```

- You can use `chai.match.any` or `ethers.anyValue` to ignore the validation of specific parameters:

```typescript
await expect(someFunction())
  .to.emit(contract, "EventName")
  .withArgs(address, anyValue, amount);
```

### Deployment Errors

If you encounter deployment errors, check the following:

1. Network configuration is correct.
2. The account has sufficient ETH to pay for gas.
3. Constructor arguments are correct.

## License

MIT