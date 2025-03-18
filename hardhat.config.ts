import { HardhatUserConfig } from "hardhat/config";
require("@chainlink/env-enc").config();
import "@nomicfoundation/hardhat-toolbox";
// import "@nomicfoundation/hardhat-foundry";
import "@openzeppelin/hardhat-upgrades";

import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
console.log("OWNER_ADDR:", process.env.OWNER_ADDR);
console.log("PAUSER_ADDR:", process.env.PAUSER_ADDR);
console.log("MINTER_ADDR:", process.env.MINTER_ADDR);
console.log("UPGRADER_ADDR:", process.env.UPGRADER_ADDR);
console.log("TOKENMANAGER_ADDR:", process.env.TOKENMANAGER_ADDR);
console.log("MULTISIG_ADDR:", process.env.MULTISIG_ADDR);

const {
  OWNER_ADDR,
  PAUSER_ADDR,
  MINTER_ADDR,
  UPGRADER_ADDR,
  TOKENMANAGER_ADDR,
  MULTISIG_ADDR,
  TESTADDR_1,
  TESTADDR_2,
  SEPOLIA_URL,
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
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: SEPOLIA_URL + "/v3/" + "574138be66974922bc4c949d5b1282ae",
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
  },
};

export default config;
