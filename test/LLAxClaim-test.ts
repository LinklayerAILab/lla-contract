import { expect } from "chai";
import { LLAxClaim, LLAx } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

describe("LLAxClaim", function () {
  let llaxClaim: LLAxClaim;
  let llax: LLAx;
  let admin: HardhatEthersSigner;
  let ops: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const MAX_CLAIM_PER_USER = ethers.parseEther("10000000");
  const MAX_GLOBAL_CLAIM = ethers.parseEther("1000000000");

  before(async function () {
    [admin, ops, user1, user2, user3, attacker] = await ethers.getSigners();
  });

  beforeEach(async function () {
    // 部署一个有 mint 功能的 mock token
    const MockFactory = await ethers.getContractFactory("MockMintableToken");
    const mockToken = await MockFactory.deploy();
    await mockToken.waitForDeployment();

    const ClaimFactory = await ethers.getContractFactory("LLAxClaim");
    llaxClaim = await upgrades.deployProxy(
      ClaimFactory,
      [await mockToken.getAddress(), admin.address],
      { kind: "uups", initializer: "initialize" }
    ) as unknown as LLAxClaim;
    await llaxClaim.waitForDeployment();

    // 给 claim 合约授权 minter 角色
    await mockToken.grantMinter(await llaxClaim.getAddress());
  });

  // ===== 辅助函数 =====
  async function signClaim(
    signer: HardhatEthersSigner,
    user: string,
    amount: bigint,
    nonce: string,
    deadline: bigint
  ) {
    const contractAddr = await llaxClaim.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "bytes32", "uint256", "uint256", "address"],
        [user, amount, nonce, deadline, chainId, contractAddr]
      )
    );
    const sig = await signer.signMessage(ethers.getBytes(hash));
    return sig;
  }

  async function makeDeadline() {
    return BigInt((await ethers.provider.getBlock("latest")!).timestamp + 3600);
  }

  // ===== 部署测试 =====
  describe("部署", function () {
    it("正确设置初始状态", async function () {
      expect(await llaxClaim.ops()).to.equal(admin.address);
      expect(await llaxClaim.owner()).to.equal(admin.address);
      expect(await llaxClaim.globalTotalClaimed()).to.equal(0);
    });

    it("零地址 token 回滚", async function () {
      const ClaimFactory = await ethers.getContractFactory("LLAxClaim");
      await expect(
        upgrades.deployProxy(
          ClaimFactory,
          [ethers.ZeroAddress, admin.address],
          { kind: "uups", initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(ClaimFactory, "ZeroAddress");
    });

    it("零地址 ops 回滚", async function () {
      const MockFactory = await ethers.getContractFactory("MockMintableToken");
      const mockToken = await MockFactory.deploy();
      await mockToken.waitForDeployment();

      const ClaimFactory = await ethers.getContractFactory("LLAxClaim");
      await expect(
        upgrades.deployProxy(
          ClaimFactory,
          [await mockToken.getAddress(), ethers.ZeroAddress],
          { kind: "uups", initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(ClaimFactory, "ZeroAddress");
    });
  });

  // ===== claim 测试 =====
  describe("claim", function () {
    it("有效签名可以成功领取", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = ethers.id("nonce1");
      const deadline = await makeDeadline();

      // 先设置 ops 为专门的签名地址
      await llaxClaim.connect(admin).setOps(ops.address);

      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
      await expect(llaxClaim.connect(user1).claim(amount, nonce, deadline, sig))
        .to.emit(llaxClaim, "Claimed")
        .withArgs(user1.address, amount, nonce, 1);

      expect(await llaxClaim.totalClaimed(user1.address)).to.equal(amount);
      expect(await llaxClaim.claimCount(user1.address)).to.equal(1);
      expect(await llaxClaim.globalTotalClaimed()).to.equal(amount);
    });

    it("过期签名回滚", async function () {
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce2");
      const pastDeadline = BigInt((await ethers.provider.getBlock("latest")!).timestamp - 1);

      await llaxClaim.connect(admin).setOps(ops.address);
      const sig = await signClaim(ops, user1.address, amount, nonce, pastDeadline);
      await expect(llaxClaim.connect(user1).claim(amount, nonce, pastDeadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "Expired");
    });

    it("重复 nonce 回滚", async function () {
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce3");
      const deadline = await makeDeadline();

      await llaxClaim.connect(admin).setOps(ops.address);
      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
      await llaxClaim.connect(user1).claim(amount, nonce, deadline, sig);

      await expect(llaxClaim.connect(user1).claim(amount, nonce, deadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "NonceUsed");
    });

    it("零金额回滚", async function () {
      const nonce = ethers.id("nonce4");
      const deadline = await makeDeadline();

      await llaxClaim.connect(admin).setOps(ops.address);
      const sig = await signClaim(ops, user1.address, 0n, nonce, deadline);
      await expect(llaxClaim.connect(user1).claim(0, nonce, deadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "ZeroAmount");
    });

    it("错误签名回滚", async function () {
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce5");
      const deadline = await makeDeadline();

      await llaxClaim.connect(admin).setOps(ops.address);
      // 用攻击者的私钥签名
      const sig = await signClaim(attacker, user1.address, amount, nonce, deadline);
      await expect(llaxClaim.connect(user1).claim(amount, nonce, deadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "InvalidSignature");
    });

    it("签名不能跨地址使用", async function () {
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce6");
      const deadline = await makeDeadline();

      await llaxClaim.connect(admin).setOps(ops.address);
      // 给 user1 签名
      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
      // user2 尝试使用
      await expect(llaxClaim.connect(user2).claim(amount, nonce, deadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "InvalidSignature");
    });

    it("超过单用户上限回滚", async function () {
      const overMax = MAX_CLAIM_PER_USER + 1n;
      const nonce = ethers.id("nonce7");
      const deadline = await makeDeadline();

      await llaxClaim.connect(admin).setOps(ops.address);
      const sig = await signClaim(ops, user1.address, overMax, nonce, deadline);
      await expect(llaxClaim.connect(user1).claim(overMax, nonce, deadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "ExceedsUserCap");
    });

    it("超过全局上限回滚", async function () {
      const amount = ethers.parseEther("10000000"); // 单笔上限
      const deadline = await makeDeadline();
      await llaxClaim.connect(admin).setOps(ops.address);

      // 100 笔 * 10M = 1B，刚好打满全局上限
      for (let i = 0; i < 100; i++) {
        const nonce = ethers.id(`global_${i}`);
        const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
        await llaxClaim.connect(user1).claim(amount, nonce, deadline, sig);
      }

      // 第 101 笔应该超过全局上限
      const nonceOver = ethers.id("global_over");
      const sigOver = await signClaim(ops, user1.address, ethers.parseEther("1"), nonceOver, deadline);
      await expect(llaxClaim.connect(user1).claim(ethers.parseEther("1"), nonceOver, deadline, sigOver))
        .to.be.revertedWithCustomError(llaxClaim, "ExceedsGlobalCap");
    });

    it("多次领取正确累计", async function () {
      await llaxClaim.connect(admin).setOps(ops.address);
      const deadline = await makeDeadline();

      const nonce1 = ethers.id("nonce_m1");
      const amt1 = ethers.parseEther("100");
      const sig1 = await signClaim(ops, user1.address, amt1, nonce1, deadline);
      await llaxClaim.connect(user1).claim(amt1, nonce1, deadline, sig1);

      const nonce2 = ethers.id("nonce_m2");
      const amt2 = ethers.parseEther("200");
      const sig2 = await signClaim(ops, user1.address, amt2, nonce2, deadline);
      await llaxClaim.connect(user1).claim(amt2, nonce2, deadline, sig2);

      expect(await llaxClaim.totalClaimed(user1.address)).to.equal(ethers.parseEther("300"));
      expect(await llaxClaim.claimCount(user1.address)).to.equal(2);
      expect(await llaxClaim.globalTotalClaimed()).to.equal(ethers.parseEther("300"));
    });
  });

  // ===== 暂停测试 =====
  describe("暂停", function () {
    it("owner 可以暂停", async function () {
      await expect(llaxClaim.connect(admin).pause())
        .to.emit(llaxClaim, "Paused");
      expect(await llaxClaim.paused()).to.be.true;
    });

    it("暂停后不能 claim", async function () {
      await llaxClaim.connect(admin).pause();
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce_pause");
      const deadline = await makeDeadline();
      await llaxClaim.connect(admin).setOps(ops.address);
      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
      await expect(llaxClaim.connect(user1).claim(amount, nonce, deadline, sig))
        .to.be.revertedWithCustomError(llaxClaim, "EnforcedPause");
    });

    it("恢复后可以 claim", async function () {
      await llaxClaim.connect(admin).setOps(ops.address);
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce_unpause");
      const deadline = await makeDeadline();
      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);

      await llaxClaim.connect(admin).pause();
      await llaxClaim.connect(admin).unpause();

      await expect(llaxClaim.connect(user1).claim(amount, nonce, deadline, sig))
        .to.emit(llaxClaim, "Claimed");
    });

    it("非 owner 不能暂停", async function () {
      await expect(llaxClaim.connect(attacker).pause())
        .to.be.revertedWithCustomError(llaxClaim, "OwnableUnauthorizedAccount");
    });
  });

  // ===== setOps 测试 =====
  describe("setOps", function () {
    it("owner 可以更换 ops", async function () {
      await expect(llaxClaim.connect(admin).setOps(ops.address))
        .to.emit(llaxClaim, "OpsUpdated")
        .withArgs(admin.address, ops.address);
      expect(await llaxClaim.ops()).to.equal(ops.address);
    });

    it("零地址回滚", async function () {
      await expect(llaxClaim.connect(admin).setOps(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(llaxClaim, "ZeroAddress");
    });

    it("非 owner 不能调用", async function () {
      await expect(llaxClaim.connect(attacker).setOps(ops.address))
        .to.be.revertedWithCustomError(llaxClaim, "OwnableUnauthorizedAccount");
    });
  });

  // ===== 查询测试 =====
  describe("查询", function () {
    it("claim record 正确存储", async function () {
      const amount = ethers.parseEther("500");
      const nonce = ethers.id("nonce_query");
      const deadline = await makeDeadline();

      await llaxClaim.connect(admin).setOps(ops.address);
      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
      await llaxClaim.connect(user1).claim(amount, nonce, deadline, sig);

      const record = await llaxClaim.claims(nonce);
      expect(record.user).to.equal(user1.address);
      expect(record.amount).to.equal(amount);
      expect(record.timestamp).to.be.gt(0);
    });
  });

  // ===== 可升级性测试 =====
  describe("可升级性", function () {
    it("owner 可以升级合约", async function () {
      const ClaimFactory = await ethers.getContractFactory("LLAxClaim");
      const upgraded = await upgrades.upgradeProxy(
        await llaxClaim.getAddress(),
        ClaimFactory,
        { kind: "uups" }
      );
      expect(await upgraded.getAddress()).to.equal(await llaxClaim.getAddress());
    });

    it("非 owner 不能升级合约", async function () {
      const ClaimFactory = await ethers.getContractFactory("LLAxClaim", attacker);
      await expect(
        upgrades.upgradeProxy(
          await llaxClaim.getAddress(),
          ClaimFactory,
          { kind: "uups" }
        )
      ).to.be.reverted;
    });

    it("升级后保留所有状态数据", async function () {
      // 先创建一些数据
      await llaxClaim.connect(admin).setOps(ops.address);
      const amount = ethers.parseEther("100");
      const nonce = ethers.id("nonce_upgrade");
      const deadline = await makeDeadline();
      const sig = await signClaim(ops, user1.address, amount, nonce, deadline);
      await llaxClaim.connect(user1).claim(amount, nonce, deadline, sig);

      // 执行升级
      const ClaimFactory = await ethers.getContractFactory("LLAxClaim");
      const upgraded = await upgrades.upgradeProxy(
        await llaxClaim.getAddress(),
        ClaimFactory,
        { kind: "uups" }
      ) as unknown as LLAxClaim;

      // 验证数据保留
      expect(await upgraded.ops()).to.equal(ops.address);
      expect(await upgraded.totalClaimed(user1.address)).to.equal(amount);
      expect(await upgraded.globalTotalClaimed()).to.equal(amount);
      expect(await upgraded.owner()).to.equal(admin.address);
    });
  });
});
