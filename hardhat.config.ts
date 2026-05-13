import { HardhatUserConfig } from "hardhat/config";
require("@chainlink/env-enc").config();
import "@nomicfoundation/hardhat-toolbox";
// import "@nomicfoundation/hardhat-foundry";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const SEPOLIA_URL = "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161";
const DUMMY_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
const {
  OWNER_ADDR = DUMMY_KEY,
  PAUSER_ADDR = DUMMY_KEY,
  MINTER_ADDR = DUMMY_KEY,
  UPGRADER_ADDR = DUMMY_KEY,
  TOKENMANAGER_ADDR = DUMMY_KEY,
  MULTISIG_ADDR = DUMMY_KEY,
  TESTADDR_1 = DUMMY_KEY,
  TESTADDR_2 = DUMMY_KEY,
} = process.env as {
  OWNER_ADDR: string;
  PAUSER_ADDR: string;
  MINTER_ADDR: string;
  UPGRADER_ADDR: string;
  TOKENMANAGER_ADDR: string;
  MULTISIG_ADDR: string;
  TESTADDR_1: string;
  TESTADDR_2: string;
  SEPOLIA_URL: string;
};
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, // 降低runs值以减小合约大小
      },
      // 启用viaIR以获得更好的优化
      viaIR: true,
      // 添加输出选择以减小大小
      outputSelection: {
        "*": {
          "*": ["evm.bytecode", "evm.deployedBytecode", "abi"]
        }
      }
    },
  },

  networks: {
    sepolia: {
      url: SEPOLIA_URL,
      accounts: [
        OWNER_ADDR,
        PAUSER_ADDR,
        MINTER_ADDR,
        UPGRADER_ADDR,
        TOKENMANAGER_ADDR,
        MULTISIG_ADDR,
        TESTADDR_1,
        TESTADDR_2,
      ],
      chainId: 11155111,
    },
    bsctest: {
      url: "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
      accounts: [
        OWNER_ADDR,
        OWNER_ADDR,
        OWNER_ADDR,
        OWNER_ADDR,
        OWNER_ADDR,
        OWNER_ADDR,
        OWNER_ADDR,
        TESTADDR_2,
      ],
      chainId: 97,
    },
    erbie: {
      url: "http://192.168.1.235:8560",
      accounts: [
        OWNER_ADDR,
        PAUSER_ADDR,
        MINTER_ADDR,
        UPGRADER_ADDR,
        TOKENMANAGER_ADDR,
        MULTISIG_ADDR,
        TESTADDR_1,
        TESTADDR_2,
      ],
      chainId: 11155111,
      gasPrice: "auto", // 自动获取gas价格
      timeout: 120000, // 2分钟超时
    },
  },
  ignition: {}, // Remove 'moduleDirectory' as it is no longer supported
};

export default config;
