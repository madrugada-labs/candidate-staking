import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CandidateStaking } from "../target/types/candidate_staking";
import {General} from '../target/types/general';
import {Job} from '../target/types/job';
import {Application} from '../target/types/application';
import {v4 as uuidv4} from "uuid";
const assert = require("assert");
import * as spl from '@solana/spl-token'

describe("candidate_staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const jobProgram = anchor.workspace.Job as Program<Job>;
  const applicationProgram = anchor.workspace.Application as Program<Application>;
  const candidateStakingProgram = anchor.workspace.CandidateStaking as Program<CandidateStaking>;
  const generalProgram = anchor.workspace.General as Program<General>;

  let alice = anchor.web3.Keypair.generate(); // HR 
  let bob = anchor.web3.Keypair.generate(); // Applicant
  let cas = anchor.web3.Keypair.generate(); // Stakeholder
  let dan = anchor.web3.Keypair.generate(); // Stakeholder
  const admin = anchor.web3.Keypair.generate(); // Admin

  let USDCMint: anchor.web3.PublicKey; // token which would be staked
  let casTokenAccount: anchor.web3.PublicKey; // cas token account

  let initialMintAmount = 100000000;

  it("Funds all users", async() => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        alice.publicKey,
        10000000000
      ),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        bob.publicKey,
        10000000000
      ),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        cas.publicKey,
        10000000000
      ),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        dan.publicKey,
        10000000000
      ),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        admin.publicKey,
        10000000000
      ),
      "confirmed"
    );

    const aliceUserBalance = await provider.connection.getBalance(alice.publicKey);
    const bobUserBalance = await provider.connection.getBalance(bob.publicKey);
    const casUserBalance = await provider.connection.getBalance(cas.publicKey);
    const danUserBalance = await provider.connection.getBalance(dan.publicKey);
    const adminUserBalance = await provider.connection.getBalance(admin.publicKey);


    assert.strictEqual(10000000000, aliceUserBalance);
    assert.strictEqual(10000000000, bobUserBalance);
    assert.strictEqual(10000000000, casUserBalance);
    assert.strictEqual(10000000000, danUserBalance);
    assert.strictEqual(10000000000, adminUserBalance);


  })

  it("create USDC mint and mint some tokens to stakeholders", async() => {


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
    )

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

  })

  const jobAdId = uuidv4();

  it("Initializing General Program", async() => {
    const [generalPDA, generalBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("general")],
      generalProgram.programId
    );

    const tx = await generalProgram.methods.initialize().accounts({
      baseAccount: generalPDA,
      authority: admin.publicKey,
      tokenMint: USDCMint,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([admin]).rpc();
  })

  it("Initializing Job Program", async () => {
    // Add your test here.

    const maxAmountPerApplication = 100000;

    const [jobFactoryPDA, jobFactoryBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("jobfactory"), Buffer.from(jobAdId.substring(0, 18)), Buffer.from(jobAdId.substring(18, 36))],
      jobProgram.programId
    );

    const [generalPDA, generalBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("general")],
      generalProgram.programId
    );

    const tx = await jobProgram.methods.initialize(jobAdId, maxAmountPerApplication).accounts({
      baseAccount: jobFactoryPDA,
      authority: alice.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([alice]).rpc();

    const tx1 = await jobProgram.methods.checkData(jobAdId, jobFactoryBump, generalBump).accounts({
      baseAccount: jobFactoryPDA,
      generalAccount: generalPDA,
      otherProgram: generalProgram.programId
    }).rpc();

    const state = await generalProgram.account.generalParameter.fetch(generalPDA);


    // console.log("Your transaction signature", tx);



    // const jobFactoryState = await jobProgram.account.jobStakingParameter.fetch(jobFactoryPDA);

    // assert.strictEqual(jobAdId, jobFactoryState.jobAdId);
    // assert.strictEqual(alice.publicKey.toBase58(), jobFactoryState.authority.toBase58());
    // assert.strictEqual(maxAmountPerApplication, jobFactoryState.maxAmountPerApplication);

  });

  it("Initializing Application Program", async() => {

    const [applicationPDA, applicationBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("application"), Buffer.from(jobAdId.substring(0, 18)), Buffer.from(jobAdId.substring(18, 36)), bob.publicKey.toBuffer()],
      applicationProgram.programId
    )

    let tx = await applicationProgram.methods.initialize(jobAdId).accounts({
      baseAccount: applicationPDA,
      authority: bob.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([bob]).rpc();

    const state = await applicationProgram.account.applicationParameter.fetch(applicationPDA);


    assert.equal(state.stakeAmount, 0)
    assert.equal(state.authority.toBase58(), bob.publicKey.toBase58())
    assert("pending" in state.status)

  })

  it("intialize candidate_staking program", async() => {

      const [candidatePDA, candidateBump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("candidate"), Buffer.from(jobAdId.substring(0, 18)), Buffer.from(jobAdId.substring(18, 36)), bob.publicKey.toBuffer(), cas.publicKey.toBuffer()],
        candidateStakingProgram.programId
      )

      const tx = await candidateStakingProgram.methods.initialize(jobAdId).accounts({
        baseAccount: candidatePDA,
        authority: cas.publicKey,
        applicant: bob.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([cas]).rpc();

      const state = await candidateStakingProgram.account.candidateParameter.fetch(candidatePDA);

      assert.equal(state.authority.toBase58(), cas.publicKey.toBase58());
      assert.equal(state.stakedAmount, 0);
  })


  it("Stakes token", async() => {

    const [candidatePDA, candidateBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("candidate"), Buffer.from(jobAdId.substring(0, 18)), Buffer.from(jobAdId.substring(18, 36)), bob.publicKey.toBuffer(), cas.publicKey.toBuffer()],
      candidateStakingProgram.programId
    )

    const [applicationPDA, applicationBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("application"), Buffer.from(jobAdId.substring(0, 18)), Buffer.from(jobAdId.substring(18, 36)), bob.publicKey.toBuffer()],
      applicationProgram.programId
    )

    const [jobPDA, jobBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("jobfactory"), Buffer.from(jobAdId.substring(0, 18)), Buffer.from(jobAdId.substring(18, 36))],
      jobProgram.programId
    );

    const [generalPDA, generalBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("general")],
      generalProgram.programId
    );

    const [walletPDA, walletBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("wallet")],
      candidateStakingProgram.programId
    )

    const stakeAmount = 1000;
    const stakeAmountInBN = new anchor.BN(stakeAmount);

    let _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );    

    const tx = await candidateStakingProgram.methods.stake(jobAdId, candidateBump, generalBump, applicationBump, jobBump,stakeAmountInBN).accounts({
      baseAccount: candidatePDA,
      authority: cas.publicKey,
      tokenMint: USDCMint,
      generalAccount: generalPDA,
      // jobAccount: jobPDA,
      applicationAccount: applicationPDA,
      applicant: bob.publicKey,
      generalProgram: generalProgram.programId,
      applicationProgram: applicationProgram.programId,
      jobProgram: jobProgram.programId,
      escrowWalletState: walletPDA,
      walletToWithdrawFrom: casTokenAccount,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: spl.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).signers([cas]).rpc();

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(_casTokenWallet.amount, initialMintAmount - stakeAmount)

  })

});
