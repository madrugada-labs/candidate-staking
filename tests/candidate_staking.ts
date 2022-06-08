import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CandidateStaking } from "../target/types/candidate_staking";
import { General } from "../target/types/general";
import { Job } from "../target/types/job";
import { Application } from "../target/types/application";
import { v4 as uuidv4 } from "uuid";
const assert = require("assert");
import * as spl from "@solana/spl-token";

describe("candidate_staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const jobProgram = anchor.workspace.Job as Program<Job>;
  const applicationProgram = anchor.workspace
    .Application as Program<Application>;
  const candidateStakingProgram = anchor.workspace
    .CandidateStaking as Program<CandidateStaking>;
  const generalProgram = anchor.workspace.General as Program<General>;

  let alice = anchor.web3.Keypair.generate(); // HR
  let bob = anchor.web3.Keypair.generate(); // Applicant
  let cas = anchor.web3.Keypair.generate(); // Stakeholder
  let dan = anchor.web3.Keypair.generate(); // Stakeholder
  const admin = anchor.web3.Keypair.generate(); // Admin

  let USDCMint: anchor.web3.PublicKey; // token which would be staked
  let casTokenAccount: anchor.web3.PublicKey; // cas token account

  let initialMintAmount = 100000000;
  const stakeAmount = 1000;

  it("Funds all users", async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(alice.publicKey, 10000000000),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(bob.publicKey, 10000000000),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(cas.publicKey, 10000000000),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(dan.publicKey, 10000000000),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(admin.publicKey, 10000000000),
      "confirmed"
    );

    const aliceUserBalance = await provider.connection.getBalance(
      alice.publicKey
    );
    const bobUserBalance = await provider.connection.getBalance(bob.publicKey);
    const casUserBalance = await provider.connection.getBalance(cas.publicKey);
    const danUserBalance = await provider.connection.getBalance(dan.publicKey);
    const adminUserBalance = await provider.connection.getBalance(
      admin.publicKey
    );

    assert.strictEqual(10000000000, aliceUserBalance);
    assert.strictEqual(10000000000, bobUserBalance);
    assert.strictEqual(10000000000, casUserBalance);
    assert.strictEqual(10000000000, danUserBalance);
    assert.strictEqual(10000000000, adminUserBalance);
  });

  it("create USDC mint and mint some tokens to stakeholders", async () => {
    USDCMint = await spl.createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    );

    casTokenAccount = await spl.createAccount(
      provider.connection,
      cas,
      USDCMint,
      cas.publicKey
    );

    await spl.mintTo(
      provider.connection,
      cas,
      USDCMint,
      casTokenAccount,
      admin.publicKey,
      initialMintAmount,
      [admin]
    );

    let _casTokenAccount = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(initialMintAmount, _casTokenAccount.amount);
  });

  const jobAdId = uuidv4();
  const applicationId = uuidv4();

  it("Initializing General Program", async () => {
    const [generalPDA, generalBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("general")],
        generalProgram.programId
      );

    const tx = await generalProgram.methods
      .initialize()
      .accounts({
        baseAccount: generalPDA,
        authority: admin.publicKey,
        tokenMint: USDCMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  });

  it("Initializing Job Program", async () => {
    // Add your test here.

    const maxAmountPerApplication = 100000;

    const [jobFactoryPDA, jobFactoryBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("jobfactory"),
          Buffer.from(jobAdId.substring(0, 18)),
          Buffer.from(jobAdId.substring(18, 36)),
        ],
        jobProgram.programId
      );

    const tx = await jobProgram.methods
      .initialize(jobAdId, maxAmountPerApplication)
      .accounts({
        baseAccount: jobFactoryPDA,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const jobFactoryState = await jobProgram.account.jobStakingParameter.fetch(
      jobFactoryPDA
    );

    assert.strictEqual(jobAdId, jobFactoryState.jobAdId);
    assert.strictEqual(
      admin.publicKey.toBase58(),
      jobFactoryState.authority.toBase58()
    );
    assert.strictEqual(
      maxAmountPerApplication,
      jobFactoryState.maxAmountPerApplication
    );
  });

  it("Initializing Application Program", async () => {
    const [applicationPDA, applicationBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("application"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
        ],
        applicationProgram.programId
      );

    let tx = await applicationProgram.methods
      .initialize(jobAdId, applicationId)
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert.equal(state.stakeAmount, 0);
    assert.equal(state.authority.toBase58(), admin.publicKey.toBase58());
    assert("pending" in state.status);
  });

  it("intialize candidate_staking program", async () => {
    const [candidatePDA, candidateBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("candidate"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    const tx = await candidateStakingProgram.methods
      .initialize(jobAdId, applicationId)
      .accounts({
        baseAccount: candidatePDA,
        authority: cas.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([cas])
      .rpc();

    const state =
      await candidateStakingProgram.account.candidateParameter.fetch(
        candidatePDA
      );

    assert.equal(state.authority.toBase58(), cas.publicKey.toBase58());
    assert.equal(state.stakedAmount, 0);
  });

  it("Stakes token", async () => {
    const [candidatePDA, candidateBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("candidate"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    const [applicationPDA, applicationBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("application"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
        ],
        applicationProgram.programId
      );

    const [jobPDA, jobBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("jobfactory"),
        Buffer.from(jobAdId.substring(0, 18)),
        Buffer.from(jobAdId.substring(18, 36)),
      ],
      jobProgram.programId
    );

    const [generalPDA, generalBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("general")],
        generalProgram.programId
      );

    const [walletPDA, walletBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("wallet")],
        candidateStakingProgram.programId
      );

    const stakeAmountInBN = new anchor.BN(stakeAmount);

    let _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    const tx = await candidateStakingProgram.methods
      .stake(
        jobAdId,
        applicationId,
        candidateBump,
        generalBump,
        applicationBump,
        jobBump,
        stakeAmount
      )
      .accounts({
        baseAccount: candidatePDA,
        authority: cas.publicKey,
        tokenMint: USDCMint,
        generalAccount: generalPDA,
        // jobAccount: jobPDA,
        applicationAccount: applicationPDA,
        generalProgram: generalProgram.programId,
        applicationProgram: applicationProgram.programId,
        jobProgram: jobProgram.programId,
        escrowWalletState: walletPDA,
        walletToWithdrawFrom: casTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([cas])
      .rpc();

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(_casTokenWallet.amount, initialMintAmount - stakeAmount);
  });

  it("Minting some tokens to escrow account to pay for rewards", async () => {
    const [walletPDA, walletBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("wallet")],
        candidateStakingProgram.programId
      );

    await spl.mintTo(
      provider.connection,
      admin,
      USDCMint,
      walletPDA,
      admin,
      initialMintAmount
    );
  });

  it("updates application status", async () => {
    const [applicationPDA, applicationBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("application"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
        ],
        applicationProgram.programId
      );

    // changing the application state to selected

    // application state codes:
    // true -> selected
    // false -> rejected

    const tx = await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, true)
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    let state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("selected" in state.status);

    const tx1 = await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, false)
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("rejected" in state.status);
  });

  it("gets reward if selected or initial if not", async () => {
    const [candidatePDA, candidateBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("candidate"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    const [applicationPDA, applicationBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("application"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
        ],
        applicationProgram.programId
      );

    const [walletPDA, walletBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("wallet")],
        candidateStakingProgram.programId
      );

    const reward = stakeAmount * 2;

    //changing the application state to selected

    const tx1 = await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, true)
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    let state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("selected" in state.status);

    let _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    const tx = await candidateStakingProgram.methods
      .unstake(
        candidateBump,
        applicationBump,
        walletBump,
        applicationId,
        new anchor.BN(reward)
      )
      .accounts({
        baseAccount: candidatePDA,
        authority: cas.publicKey,
        tokenMint: USDCMint,
        applicationAccount: applicationPDA,
        applicationProgram: applicationProgram.programId,
        escrowWalletState: walletPDA,
        walletToDepositTo: casTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([cas])
      .rpc();

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(
      _casTokenWallet.amount,
      initialMintAmount - stakeAmount + reward
    );

    await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, false)
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("rejected" in state.status);

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    await candidateStakingProgram.methods
      .unstake(
        candidateBump,
        applicationBump,
        walletBump,
        applicationId,
        new anchor.BN(reward)
      )
      .accounts({
        baseAccount: candidatePDA,
        authority: cas.publicKey,
        tokenMint: USDCMint,
        applicationAccount: applicationPDA,
        applicationProgram: applicationProgram.programId,
        escrowWalletState: walletPDA,
        walletToDepositTo: casTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([cas])
      .rpc();


    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(
      _casTokenWallet.amount,
      initialMintAmount - stakeAmount + reward + stakeAmount
    );

  });
});
