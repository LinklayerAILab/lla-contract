import { expect } from "chai";
import { LLAx } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";

describe("LLAx Token - Mint Permission", function () {
  let LLAxFactory: ContractFactory;
  let llax: LLAx;
  let defaultAdmin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseEther("100000000000");
  const MINTER_ROLE = ethers.id("MINTER_ROLE");

  before(async function () {
    [defaultAdmin, pauser, minter, user1] = await ethers.getSigners();
  });

  beforeEach(async function () {
    LLAxFactory = await ethers.getContractFactory("LLAx");
    llax = (await LLAxFactory.deploy(
      defaultAdmin.address,
      pauser.address
    )) as LLAx;
    await llax.waitForDeployment();
  });

  it("deploys with zero total supply", async function () {
    expect(await llax.totalSupply()).to.equal(0);
  });

  it("exposes MINTER_ROLE", async function () {
    expect(llax.interface.getFunction("MINTER_ROLE")).to.not.equal(null);
  });

  it("exposes a public mint function", async function () {
    expect(llax.interface.getFunction("mint")).to.not.equal(null);
  });

  it("admin can grant MINTER_ROLE and mint tokens", async function () {
    await llax.connect(defaultAdmin).grantRole(MINTER_ROLE, minter.address);

    const mintAmount = ethers.parseEther("1000000");
    await expect(llax.connect(minter).mint(user1.address, mintAmount))
      .to.emit(llax, "Transfer")
      .withArgs(ethers.ZeroAddress, user1.address, mintAmount);

    expect(await llax.totalSupply()).to.equal(mintAmount);
    expect(await llax.balanceOf(user1.address)).to.equal(mintAmount);
  });

  it("mint reverts when exceeding MAX_SUPPLY", async function () {
    await llax.connect(defaultAdmin).grantRole(MINTER_ROLE, minter.address);

    await expect(llax.connect(minter).mint(user1.address, MAX_SUPPLY + 1n))
      .to.be.revertedWith("LLAx: exceeds max supply");
  });

  it("non-minter cannot mint", async function () {
    await expect(
      llax.connect(user1).mint(user1.address, ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(llax, "AccessControlUnauthorizedAccount");
  });

  it("mint up to MAX_SUPPLY succeeds", async function () {
    await llax.connect(defaultAdmin).grantRole(MINTER_ROLE, minter.address);
    await expect(llax.connect(minter).mint(user1.address, MAX_SUPPLY))
      .to.emit(llax, "Transfer");
    expect(await llax.totalSupply()).to.equal(MAX_SUPPLY);
  });

  it("burned tokens free up supply for re-minting", async function () {
    await llax.connect(defaultAdmin).grantRole(MINTER_ROLE, minter.address);
    await llax.connect(minter).mint(minter.address, MAX_SUPPLY);

    const burnAmount = ethers.parseEther("5000000");
    await llax.connect(minter).burn(burnAmount);

    expect(await llax.totalSupply()).to.equal(MAX_SUPPLY - burnAmount);

    // Can re-mint the burned amount
    await expect(llax.connect(minter).mint(user1.address, burnAmount))
      .to.emit(llax, "Transfer");
    expect(await llax.totalSupply()).to.equal(MAX_SUPPLY);
  });
});
