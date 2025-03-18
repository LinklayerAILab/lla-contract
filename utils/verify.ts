import { run } from "hardhat";

export async function verify(contractAddress: string, args: any[]) {
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("The contract has been verified.");
    } else {
      console.error(e);
    }
  }
}
