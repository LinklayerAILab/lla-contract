import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// import "@nomicfoundation/hardhat-foundry";
import "@openzeppelin/hardhat-upgrades";

import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
const config: HardhatUserConfig = {
  solidity: "0.8.28",
};

export default config;
