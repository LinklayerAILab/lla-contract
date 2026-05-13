import { expect } from "chai";
import { LLAx } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLAx Token - Fixed Supply Regression", function () {
  let LLAxFactory: ContractFactory;
  let llax: LLAx;
  let defaultAdmin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let initialHolder: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseEther("100000000000");

  before(async function () {
    [defaultAdmin, pauser, initialHolder, user1] = await ethers.getSigners();
  });

  beforeEach(async function () {
    LLAxFactory = await ethers.getContractFactory("LLAx");
    llax = (await LLAxFactory.deploy(
      defaultAdmin.address,
      pauser.address,
      initialHolder.address
    )) as LLAx;
    await llax.waitForDeployment();
  });

  it("deploys with all tokens minted to the initial holder", async function () {
    expect(await llax.totalSupply()).to.equal(MAX_SUPPLY);
    expect(await llax.balanceOf(initialHolder.address)).to.equal(MAX_SUPPLY);
  });

  it("does not expose MINTER_ROLE", function () {
    expect(llax.interface.getFunction("MINTER_ROLE")).to.equal(null);
  });

  it("does not expose a public mint function", function () {
    expect(llax.interface.getFunction("mint")).to.equal(null);
  });

  it("cannot re-mint burned tokens because no mint entrypoint exists", async function () {
    const burnAmount = ethers.parseEther("5000000");

    await llax.connect(initialHolder).burn(burnAmount);

    expect(await llax.totalSupply()).to.equal(MAX_SUPPLY - burnAmount);
    expect(() => llax.interface.encodeFunctionData("mint", [user1.address, burnAmount])).to.throw();
  });

  it("admin cannot create a minter role through the removed role getter", function () {
    expect(() => llax.interface.encodeFunctionData("MINTER_ROLE", [])).to.throw();
  });
});
