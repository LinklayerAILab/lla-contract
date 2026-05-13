import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load env from .env.local (if present), then .env
(() => {
  const envLocal = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal });
  }
  dotenv.config();
})();

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`Network: ${net.name} (chainId: ${net.chainId})`);

  const proxyAddress = process.env.BSCTEST_PROXY_ADDRESS || process.env.PROXY_ADDRESS;
  if (!proxyAddress || !ethers.isAddress(proxyAddress)) {
    throw new Error("Missing or invalid PROXY_ADDRESS/BSCTEST_PROXY_ADDRESS env var");
  }

  console.log("Proxy:", proxyAddress);
  const [signer] = await ethers.getSigners();
  console.log("Signer:", await signer.getAddress());

  const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription", signer);
  console.log("Force importing proxy into OpenZeppelin manifest...");
  await upgrades.forceImport(proxyAddress, ProductSubscriptionFactory, { kind: "uups" });
  console.log("Force import done");
}

main().catch((err) => {
  console.error("Force import failed:", err);
  process.exit(1);
});

