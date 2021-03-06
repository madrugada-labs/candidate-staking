import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CandidateStaking } from "../target/types/candidate_staking";
import { General } from "../target/types/general";
import { Job } from "../target/types/job";
import { Application } from "../target/types/application";
import { v4 as uuidv4 } from "uuid";
const assert = require("assert");
import * as spl from "@solana/spl-token";
import bs58 from "bs58";

describe("candidate_staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log(provider.connection.rpcEndpoint);

  const jobProgram = anchor.workspace.Job as Program<Job>;
  const applicationProgram = anchor.workspace
    .Application as Program<Application>;
  const candidateStakingProgram = anchor.workspace
    .CandidateStaking as Program<CandidateStaking>;
  const generalProgram = anchor.workspace.General as Program<General>;

  let alice: anchor.web3.Keypair;
  let bob: anchor.web3.Keypair;
  let cas: anchor.web3.Keypair;
  let dan: anchor.web3.Keypair;
  let admin: anchor.web3.Keypair;

  let USDCMint: anchor.web3.PublicKey; // token which would be staked
  let casTokenAccount: any; // cas token account

  let initialMintAmount = 100000000;
  const stakeAmount = 4000;
  const maxAmountPerApplication = 10000;

  if (provider.connection.rpcEndpoint == "http://localhost:8899") {
    alice = anchor.web3.Keypair.generate(); // HR
    bob = anchor.web3.Keypair.generate(); // Applicant
    cas = anchor.web3.Keypair.generate(); // Stakeholder
    dan = anchor.web3.Keypair.generate(); // Stakeholder
    admin = anchor.web3.Keypair.generate(); // Admin

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
      const bobUserBalance = await provider.connection.getBalance(
        bob.publicKey
      );
      const casUserBalance = await provider.connection.getBalance(
        cas.publicKey
      );
      const danUserBalance = await provider.connection.getBalance(
        dan.publicKey
      );
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
  } else {
    const alicePrivate =
      "472ZS33Lftn7wdM31QauCkmpgFKFvgBRg6Z6NGtA6JgeRi1NfeZFRNvNi3b3sh5jvrQWrgiTimr8giVs9oq4UM5g";
    const casPrivate =
      "4CpgQ2g3KojCEpLwUDVjzFNWoMbvUqqQodHMPjN6B71mRy7dCuwWxCW8F9zjUrxsYDJyDpu1cbiERc8bkFR41USt";
    const adminPrivate =
      "2HKjYz8yfQxxhRS5f17FRCx9kDp7ATF5R4esLnKA4VaUsMA5zquP5XkQmvv9J5ZUD6wAjD4iBPYXDzQDNZmQ1eki";

    alice = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(alicePrivate))
    );
    cas = anchor.web3.Keypair.generate();
    admin = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(adminPrivate))
    );

    USDCMint = new anchor.web3.PublicKey(
      "CAb5AhUMS4EbKp1rEoNJqXGy94Abha4Tg4FrHz7zZDZ3"
    );

    it("Get the associated token account and mint tokens", async () => {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(cas.publicKey, 100000000),
        "confirmed"
      );

      const TempCasTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        provider.connection,
        cas,
        USDCMint,
        cas.publicKey,
        false
      );

      casTokenAccount = TempCasTokenAccount.address;

      const _casTokenAccountBefore = await spl.getAccount(
        provider.connection,
        casTokenAccount
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

      const _casTokenAccountAfter = await spl.getAccount(
        provider.connection,
        casTokenAccount
      );

      assert.equal(
        initialMintAmount,
        _casTokenAccountAfter.amount - _casTokenAccountBefore.amount
      );
    });
  }

  // application state codes:
  // 2 -> selected
  // 1 -> selected but cannot withdraw yet
  // 0 -> rejected

  // Side rust enum used for the program's RPC API.
  // SOURCE: https://github.com/project-serum/anchor/blob/5d8b4765f2c5a2d0c5a26c639b10719e7b6f2fd1/tests/swap/tests/swap.js#L279
  const JobStatus = {
    Rejected: { rejected: {} },
    SelectedButCannotWithdraw: { selectedButCannotWithdraw: {} },
    Selected: { selected: {} },
    Pending: { pending: {} },
  };

  let jobAdId = uuidv4();
  let applicationId = uuidv4();

  // successfull uids
  // const jobAdId = "cd03097e-63a3-4ad7-b1ae-a9d8748d1e8b"
  // const applicationId = "25df58b2-e5a7-46c7-9803-fdfd2a3895d4" 

  // //unsuccessful uids
  // const jobAdId = "c0f4feb3-a7a6-4d54-97c3-a7c06562a500"
  // const applicationId = "37f9b205-998c-4583-8d58-ebb7db846755" 

  // jobAdId = jobAdId.replaceAll('-','');
  // applicationId = applicationId.replaceAll('-','');

  it("Initializing General Program", async () => {
    const [generalPDA, generalBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("general")],
        generalProgram.programId
      );

    try {
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
    } catch (error) {
      const tx = await generalProgram.methods
        .changeMint(generalBump)
        .accounts({
          baseAccount: generalPDA,
          authority: admin.publicKey,
          tokenMint: USDCMint,
        })
        .signers([admin])
        .rpc();

      const state = await generalProgram.account.generalParameter.fetch(
        generalPDA
      );
      assert.equal(state.mint.toBase58(), USDCMint.toBase58());
      assert.equal(state.authority.toBase58(), admin.publicKey.toBase58());
    }
  });

  it("Initializing Job Program", async () => {
    // Add your test here.

    const [generalPDA, generalBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("general")],
        generalProgram.programId
      );

    const [jobFactoryPDA, jobFactoryBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("jobfactory"),
          Buffer.from(jobAdId.substring(0, 18)),
          Buffer.from(jobAdId.substring(18, 36)),
        ],
        jobProgram.programId
      );

    // creating job by the person who is not the authority which should throw an error
    try {
      const tx = await jobProgram.methods
        .initialize(jobAdId, generalBump, maxAmountPerApplication)
        .accounts({
          baseAccount: jobFactoryPDA,
          authority: alice.publicKey,
          generalAccount: generalPDA,
          generalProgram: generalProgram.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      assert.equal(true, false); // This block should eventually fail and move to catch , but if this is executed, that means job is created by a person who is not authority.
    } catch (error) {
      assert.equal(error.error.errorCode.code, "InvalidAuthority");
    }

    const tx = await jobProgram.methods
      .initialize(jobAdId, generalBump, maxAmountPerApplication)
      .accounts({
        baseAccount: jobFactoryPDA,
        authority: admin.publicKey,
        generalAccount: generalPDA,
        generalProgram: generalProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Checks if the job can be created again. Since the PDA would be the same and it is already initialized, it would throw an error
    try {
      const tx = await jobProgram.methods
        .initialize(jobAdId, generalBump, maxAmountPerApplication)
        .accounts({
          baseAccount: jobFactoryPDA,
          authority: admin.publicKey,
          generalAccount: generalPDA,
          generalProgram: generalProgram.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      assert.equal(true, false); // if this is executed, it means that the job is created again. So this should never be true
    } catch (error) {
      assert.equal(
        error.logs[4],
        "Program 11111111111111111111111111111111 failed: custom program error: 0x0"
      );
    }

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
    const [generalPDA, generalBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("general")],
        generalProgram.programId
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

    // Checks that only the authority can initialize the program
    try {
      let tx = await applicationProgram.methods
        .initialize(
          jobAdId,
          applicationId,
          generalBump,
          maxAmountPerApplication
        )
        .accounts({
          baseAccount: applicationPDA,
          authority: alice.publicKey,
          generalAccount: generalPDA,
          generalProgram: generalProgram.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      assert.equal(true, false);
    } catch (error) {
      assert.equal(error.error.errorCode.code, "InvalidAuthority");
    }

    let tx = await applicationProgram.methods
      .initialize(jobAdId, applicationId, generalBump, maxAmountPerApplication)
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
        generalAccount: generalPDA,
        generalProgram: generalProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // checks that the same application cannot be created again
    try {
      let tx = await applicationProgram.methods
        .initialize(
          jobAdId,
          applicationId,
          generalBump,
          maxAmountPerApplication
        )
        .accounts({
          baseAccount: applicationPDA,
          authority: admin.publicKey,
          generalAccount: generalPDA,
          generalProgram: generalProgram.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      assert.equal(true, false);
    } catch (error) {
      assert.equal(
        error.logs[4],
        "Program 11111111111111111111111111111111 failed: custom program error: 0x0"
      );
    }

    const state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert.equal(state.stakedAmount, 0);
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

    const [walletPDA, walletBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("wallet"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    try {
      const tx = await candidateStakingProgram.methods
        .initialize(jobAdId, applicationId)
        .accounts({
          baseAccount: candidatePDA,
          escrowWalletState: walletPDA,
          tokenMint: USDCMint,
          authority: cas.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([cas])
        .rpc();
    } catch (error) {
      console.log(error);
    }

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
        [
          Buffer.from("wallet"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
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
        walletBump,
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

    const state =
      await candidateStakingProgram.account.candidateParameter.fetch(
        candidatePDA
      );
    // console.log(state.rewardAmount, state.stakedAmount);

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(_casTokenWallet.amount, initialMintAmount - stakeAmount);
  });

  it("Minting some tokens to escrow account to pay for rewards", async () => {
    const [walletPDA, walletBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("wallet"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
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

    const tx = await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, { selected: {} })
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
      .updateStatus(applicationId, applicationBump, { rejected: {} })
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

    const tx2 = await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, {
        selectedButCantWithdraw: {},
      })
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("selectedButCantWithdraw" in state.status);
  });

  it("Not able to stake after changing the status of application", async() => {

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
        [
          Buffer.from("wallet"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    const stakeAmountInBN = new anchor.BN(stakeAmount);

    let _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    try {
      const tx = await candidateStakingProgram.methods
      .stake(
        jobAdId,
        applicationId,
        candidateBump,
        generalBump,
        applicationBump,
        jobBump,
        walletBump,
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
      
    } catch (error) {
      assert.equal(error.error.errorCode.code, "RequireViolated")
    }

  })

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
        [
          Buffer.from("wallet"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          cas.publicKey.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    const candidateState =
      await candidateStakingProgram.account.candidateParameter.fetch(
        candidatePDA
      );
    const reward = candidateState.rewardAmount;

    //changing the application state to selected

    const tx1 = await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, { selected: {} })
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
      .unstake(candidateBump, applicationBump, walletBump, applicationId)
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

    // changing application state to rejected

    await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, { rejected: {} })
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
      .unstake(candidateBump, applicationBump, walletBump, applicationId)
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

    await applicationProgram.methods
      .updateStatus(applicationId, applicationBump, {
        selectedButCantWithdraw: {},
      })
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert(state.status, JobStatus.SelectedButCannotWithdraw);

    // This instruction should fail, cause in this state the user cannot withdraw the rewards and the initialAmount
    try {
      await candidateStakingProgram.methods
        .unstake(candidateBump, applicationBump, walletBump, applicationId)
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

      assert.equal(true, false);
    } catch (error) {
      assert.equal(error.error.errorCode.code, "SelectedButCantTransfer");
    }
  });

  it("Rewards for users in different tiers", async () => {
    const tier1Amount = 2000; // The complete amount is tier 1
    const tier1AndTier2Amount = 5000; // 3333 would be in tier 1 and 1667 would be in tier 2
    const all3TierAmount = 8000; // 3333 would be in tier 1, the next 3333 would be in tier 2 and 1333 would be in tier 3

    const onlyTier2Amount = 3000; // There will already be 3333 staked so this amount lies in tier 2 only
    const tier2AndTier3Amount = 5000; // 3333 already in tier 1, so 3333 in tier 2 and the rest 1333 in tier 3

    const onlyTier3Amount = 3000; // There will be 3333 already in tier 1, 3333 in tier2 so this remaining amount would be in tier 3 entirely

    //TODO: Write the test case for the above
  });
});
