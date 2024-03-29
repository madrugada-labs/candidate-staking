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

  // TODO: Add docs of what each of whese keys represent.
  let alice: anchor.web3.Keypair; // Just another Keypair
  let bob: anchor.web3.Keypair; // Just another Keypair
  let cas: anchor.web3.Keypair; // stakeholder who would stake on the application
  let dan: anchor.web3.Keypair; // Just another keypair
  let admin: anchor.web3.Keypair; // This is the authority which is responsible for creating job, application and changing state of application

  let USDCMint: anchor.web3.PublicKey; // token which would be staked
  let casTokenAccount: any; // cas token account
  let aliceTokenAccount: any; // alice Token account

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

      aliceTokenAccount = await spl.createAccount(
        provider.connection,
        alice,
        USDCMint,
        alice.publicKey
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

      await spl.mintTo(
        provider.connection,
        alice,
        USDCMint,
        aliceTokenAccount,
        admin.publicKey,
        initialMintAmount,
        [admin]
      );

      let casTokenAccountUpdated = await spl.getAccount(
        provider.connection,
        casTokenAccount
      );
      let aliceTokenAccountUpdated = await spl.getAccount(
        provider.connection,
        aliceTokenAccount
      );

      assert.equal(initialMintAmount, casTokenAccountUpdated.amount);
      assert.equal(initialMintAmount, aliceTokenAccountUpdated.amount);
    });
  } else {
    // These are the private keys of accounts which i have created and have deposited some SOL in it.
    // Since we cannot airdrop much SOL on devnet (fails most of the time), i have previously airdropped some SOL so that these accounts
    // can be used for testing on devnet.
    // We can have them in another file and import them. But these are only for testing and has 0 balance on mainnet.
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
  console.log(jobAdId, applicationId);

  // // Below are the helper function to get PDAs and Bumps
  const getGeneralPDA = async () => {
    const [generalPDA, generalBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("general")],
        generalProgram.programId
      );

    return { generalPDA, generalBump };
  };
  const getJobPDA = async (jobAdId: String) => {
    const [jobFactoryPDA, jobFactoryBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("jobfactory"),
          Buffer.from(jobAdId.substring(0, 18)),
          Buffer.from(jobAdId.substring(18, 36)),
        ],
        jobProgram.programId
      );
    return { jobFactoryPDA, jobFactoryBump };
  };
  const getApplicationPDA = async (applicationId: String) => {
    const [applicationPDA, applicationBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("application"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
        ],
        applicationProgram.programId
      );

    return { applicationPDA, applicationBump };
  };
  const getCandidatePDA = async (
    applicationId: String,
    userAccount: anchor.web3.PublicKey
  ) => {
    const [candidatePDA, candidateBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("candidate"),
          Buffer.from(applicationId.substring(0, 18)),
          Buffer.from(applicationId.substring(18, 36)),
          userAccount.toBuffer(),
        ],
        candidateStakingProgram.programId
      );

    return { candidatePDA, candidateBump };
  };
  const getWalletPDA = async (jobAdId: String) => {
    const [walletPDA, walletBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("wallet"),
          Buffer.from(jobAdId.substring(0, 18)),
          Buffer.from(jobAdId.substring(18, 36)),
        ],
        candidateStakingProgram.programId
      );

    return { walletPDA, walletBump };
  };

  const changeApplicationStatus = async (
    jobAdId: string,
    applicationId: string,
    status: any
  ) => {
    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    const tx = await applicationProgram.methods
      .updateStatus(
        applicationId,
        applicationBump,
        jobAdId,
        jobFactoryBump,
        status
      )
      .accounts({
        baseAccount: applicationPDA,
        authority: admin.publicKey,
        jobAccount: jobFactoryPDA,
        jobProgram: jobProgram.programId,
        instruction: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([admin])
      .rpc();
  };

  const allProgramInitialize = async (
    jobAdId: string,
    applicationId: string,
    user: anchor.web3.Keypair
  ) => {
    const { candidatePDA, candidateBump } = await getCandidatePDA(
      applicationId,
      user.publicKey
    );

    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    const { generalPDA, generalBump } = await getGeneralPDA();

    const { walletPDA, walletBump } = await getWalletPDA(jobAdId);
    try {
      await jobProgram.methods
        .initialize(
          jobAdId,
          generalBump,
          new anchor.BN(maxAmountPerApplication)
        )
        .accounts({
          baseAccount: jobFactoryPDA,
          authority: admin.publicKey,
          generalAccount: generalPDA,
          generalProgram: generalProgram.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    } catch (error) {}
    try {
      await applicationProgram.methods
        .initialize(
          jobAdId,
          applicationId,
          generalBump,
          new anchor.BN(maxAmountPerApplication)
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
    } catch (error) {}

    await candidateStakingProgram.methods
      .initialize(jobAdId, applicationId, jobFactoryBump)
      .accounts({
        baseAccount: candidatePDA,
        jobAccount: jobFactoryPDA,
        escrowWalletState: walletPDA,
        tokenMint: USDCMint,
        authority: user.publicKey,
        jobProgram: jobProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();
  };

  const stakeAmountFunction = async (
    jobAdId: string,
    applicationId: string,
    amountToBeStaked: number,
    user: anchor.web3.Keypair,
    userTokenAccount: anchor.web3.PublicKey
  ) => {
    const { candidatePDA, candidateBump } = await getCandidatePDA(
      applicationId,
      user.publicKey
    );

    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    const { generalPDA, generalBump } = await getGeneralPDA();

    const { walletPDA, walletBump } = await getWalletPDA(jobAdId);

    const tx = await candidateStakingProgram.methods
      .stake(
        jobAdId,
        applicationId,
        candidateBump,
        generalBump,
        applicationBump,
        jobFactoryBump,
        walletBump,
        new anchor.BN(amountToBeStaked)
      )
      .accounts({
        baseAccount: candidatePDA,
        authority: user.publicKey,
        tokenMint: USDCMint,
        generalAccount: generalPDA,
        jobAccount: jobFactoryPDA,
        applicationAccount: applicationPDA,
        generalProgram: generalProgram.programId,
        applicationProgram: applicationProgram.programId,
        jobProgram: jobProgram.programId,
        escrowWalletState: walletPDA,
        walletToWithdrawFrom: userTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        instruction: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([user])
      .rpc();
  };

  const fundPoolWallet = async (jobAdId) => {
    const { walletPDA, walletBump } = await getWalletPDA(jobAdId);

    await spl.mintTo(
      provider.connection,
      admin,
      USDCMint,
      walletPDA,
      admin,
      initialMintAmount
    );
  };

  const unstakeFunction = async (
    jobAdId,
    applicationId,
    user: anchor.web3.Keypair,
    userTokenAccount: anchor.web3.PublicKey
  ) => {
    const { candidatePDA, candidateBump } = await getCandidatePDA(
      applicationId,
      user.publicKey
    );

    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    const { walletPDA, walletBump } = await getWalletPDA(jobAdId);

    await candidateStakingProgram.methods
      .unstake(
        candidateBump,
        applicationBump,
        walletBump,
        applicationId,
        jobAdId,
        jobFactoryBump
      )
      .accounts({
        baseAccount: candidatePDA,
        jobAccount: jobFactoryPDA,
        authority: user.publicKey,
        tokenMint: USDCMint,
        applicationAccount: applicationPDA,
        applicationProgram: applicationProgram.programId,
        escrowWalletState: walletPDA,
        walletToDepositTo: userTokenAccount,
        jobProgram: jobProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        instruction: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([user])
      .rpc();
  };

  const changeStatusAndUnstake = async (
    jobAdId,
    applicationId,
    user: anchor.web3.Keypair,
    userTokenAccount: anchor.web3.PublicKey
  ) => {
    await changeApplicationStatus(jobAdId, applicationId, { selected: {} });
    await unstakeFunction(jobAdId, applicationId, user, userTokenAccount);
  };

  it("Initializing General Program", async () => {
    const { generalPDA, generalBump } = await getGeneralPDA();

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
    const { generalPDA, generalBump } = await getGeneralPDA();

    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    // creating job by the person who is not the authority which should throw an error
    try {
      const tx = await jobProgram.methods
        .initialize(
          jobAdId,
          generalBump,
          new anchor.BN(maxAmountPerApplication)
        )
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
      .initialize(jobAdId, generalBump, new anchor.BN(maxAmountPerApplication))
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
        .initialize(
          jobAdId,
          generalBump,
          new anchor.BN(maxAmountPerApplication)
        )
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

    assert.equal(
      maxAmountPerApplication,
      jobFactoryState.maxAmountPerApplication.toNumber()
    );
  });

  it("Initializing Application Program", async () => {
    const { generalPDA, generalBump } = await getGeneralPDA();

    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    // Checks that only the authority can initialize the program
    try {
      let tx = await applicationProgram.methods
        .initialize(
          jobAdId,
          applicationId,
          generalBump,
          new anchor.BN(maxAmountPerApplication)
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
      .initialize(
        jobAdId,
        applicationId,
        generalBump,
        new anchor.BN(maxAmountPerApplication)
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

    // checks that the same application cannot be created again
    try {
      let tx = await applicationProgram.methods
        .initialize(
          jobAdId,
          applicationId,
          generalBump,
          new anchor.BN(maxAmountPerApplication)
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
        // The above error refers to address already in use which means that we are trying to initialize the program again which is forbidden.
      );
    }

    const state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert.equal(state.stakedAmount, 0);
    assert.equal(state.authority.toBase58(), admin.publicKey.toBase58());
    assert("pending" in state.status); //question: why "pending" and not "Pending"?
  });

  it("intialize candidate_staking program", async () => {
    const { candidatePDA, candidateBump } = await getCandidatePDA(
      applicationId,
      cas.publicKey
    );

    const { walletPDA, walletBump } = await getWalletPDA(jobAdId);

    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    try {
      const tx = await candidateStakingProgram.methods
        .initialize(jobAdId, applicationId, jobFactoryBump)
        .accounts({
          baseAccount: candidatePDA,
          jobAccount: jobFactoryPDA,
          escrowWalletState: walletPDA,
          tokenMint: USDCMint,
          authority: cas.publicKey,
          jobProgram: jobProgram.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([cas])
        .rpc();
    } catch (error) {
      console.log(error);
      throw "this should not happen";
    }

    const state =
      await candidateStakingProgram.account.candidateParameter.fetch(
        candidatePDA
      );

    assert.equal(state.authority.toBase58(), cas.publicKey.toBase58());
    assert.equal(state.stakedAmount, 0);
  });

  it("Stakes token", async () => {
    const { candidatePDA, candidateBump } = await getCandidatePDA(
      applicationId,
      cas.publicKey
    );

    let _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    try {
      await stakeAmountFunction(
        jobAdId,
        applicationId,
        stakeAmount,
        cas,
        casTokenAccount
      );
    } catch (error) {
      console.log(error);
    }

    const state =
      await candidateStakingProgram.account.candidateParameter.fetch(
        candidatePDA
      );

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(_casTokenWallet.amount, initialMintAmount - stakeAmount);
  });

  it("Staking on application and job which does not exist, should fail", async () => {
    const testApplicationId = uuidv4();
    const testJobId = uuidv4();

    // job doesnt exist

    try {
      await stakeAmountFunction(
        testJobId,
        applicationId,
        stakeAmount,
        cas,
        casTokenAccount
      );
    } catch (error) {
      assert.equal(error.error.errorCode.code, "AccountNotInitialized");
    }

    // job exists but application doesnt

    try {
      await stakeAmountFunction(
        jobAdId,
        testApplicationId,
        stakeAmount,
        cas,
        casTokenAccount
      );
    } catch (error) {
      assert.equal(error.error.errorCode.code, "AccountNotInitialized");
    }
  });

  it("Signer and token account owner should be the same else it should fail", async () => {
    try {
      await stakeAmountFunction(
        jobAdId,
        applicationId,
        stakeAmount,
        cas,
        aliceTokenAccount
      );
    } catch (error) {
      assert.equal(error.error.errorCode.code, "ConstraintRaw");
    }
  });

  it("Minting some tokens to escrow account to pay for rewards", async () => {
    await fundPoolWallet(jobAdId);
  });

  it("updates application status", async () => {
    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    await changeApplicationStatus(jobAdId, applicationId, { selected: {} });

    let state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("selected" in state.status);

    await changeApplicationStatus(jobAdId, applicationId, { rejected: {} });

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("rejected" in state.status);

    await changeApplicationStatus(jobAdId, applicationId, {
      selectedButCantWithdraw: {},
    });

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("selectedButCantWithdraw" in state.status);
  });

  it("Not able to stake after changing the status of application", async () => {
    try {
      await stakeAmountFunction(
        jobAdId,
        applicationId,
        stakeAmount,
        cas,
        casTokenAccount
      );
    } catch (error) {
      assert.equal(error.error.errorCode.code, "StatusNotPending");
    }
  });

  it("gets reward if selected or initial if not", async () => {
    const { candidatePDA, candidateBump } = await getCandidatePDA(
      applicationId,
      cas.publicKey
    );

    const { jobFactoryPDA, jobFactoryBump } = await getJobPDA(jobAdId);

    const { applicationPDA, applicationBump } = await getApplicationPDA(
      applicationId
    );

    const { walletPDA, walletBump } = await getWalletPDA(jobAdId);

    const candidateState =
      await candidateStakingProgram.account.candidateParameter.fetch(
        candidatePDA
      );
    const reward = candidateState.rewardAmount.toNumber();

    await changeApplicationStatus(jobAdId, applicationId, {
      selectedButCantWithdraw: {},
    });

    let state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert(state.status, JobStatus.SelectedButCannotWithdraw);

    // This instruction should fail, cause in this state the user cannot withdraw the rewards and the initialAmount
    try {
      await unstakeFunction(jobAdId, applicationId, cas, casTokenAccount);

      throw "This should not happen";
    } catch (error) {
      assert.equal(error.error.errorCode.code, "SelectedButCantTransfer");
    }

    //changing the application state to selected

    await changeApplicationStatus(jobAdId, applicationId, { selected: {} });

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("selected" in state.status);

    let _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    try {
      await unstakeFunction(jobAdId, applicationId, cas, casTokenAccount);
    } catch (error) {
      console.log(error);
    }

    _casTokenWallet = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(
      _casTokenWallet.amount,
      initialMintAmount - stakeAmount + reward
    );

    try {
      const tx1 = await jobProgram.methods
        .unstake(jobAdId, jobFactoryBump, walletBump, new anchor.BN(10))
        .accounts({
          jobAccount: jobFactoryPDA,
          tokenMint: USDCMint,
          authority: cas.publicKey,
          escrowWalletState: walletPDA,
          walletToDepositTo: casTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([cas])
        .rpc();
    } catch (error) {
      assert.equal(error.error.errorCode.code, "InvalidCall");
    }

    // changing application state to rejected

    // since we cannot unstake now even after changing the state of application cause the unstake has already happened and can happen only once
    // so we will change the application status to pending, stake , change status to rejection and check if the deposit amount is unstaked

    await changeApplicationStatus(jobAdId, applicationId, { pending: {} });

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("pending" in state.status);

    const casTokenAccountBefore = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    await stakeAmountFunction(
      jobAdId,
      applicationId,
      stakeAmount,
      cas,
      casTokenAccount
    );

    const casTokenAccountAfter = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(
      casTokenAccountBefore.amount - casTokenAccountAfter.amount,
      stakeAmount
    );

    await changeApplicationStatus(jobAdId, applicationId, { rejected: {} });

    state = await applicationProgram.account.applicationParameter.fetch(
      applicationPDA
    );

    assert("rejected" in state.status);

    const _casTokenWalletBefore = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    await unstakeFunction(jobAdId, applicationId, cas, casTokenAccount);

    const _casTokenWalletAfter = await spl.getAccount(
      provider.connection,
      casTokenAccount
    );

    assert.equal(
      _casTokenWalletAfter.amount - _casTokenWalletBefore.amount,
      stakeAmount
    );
  });

  it("Cannot unstake again", async () => {
    try {
      await unstakeFunction(jobAdId, applicationId, cas, casTokenAccount);
    } catch (error) {
      assert.equal(error.error.errorCode.code, "AlreadyUnstaked");
    }
  });

  it("Rewards for users in different tiers", async () => {
    const tier1Amount = 2000; // The complete amount is tier 1
    const tier1Reward = 6000; // The reward for tier1 only

    const tier1AndTier2Amount = 5000; // 3333 would be in tier 1 and 1667 would be in tier 2
    const tier1AndTier2Reward = 13333; // the reward for tier1 and tier 2

    const all3TierAmount = 8000; // 3333 would be in tier 1, the next 3333 would be in tier 2 and 1334 would be in tier 3
    const all3TierReward = 18666; // The reward in all 3 tiers

    const onlyTier2Amount = 3000; // There will already be 3333 staked so this amount lies in tier 2 only
    const onlyTier2Reward = 6000; // the reward in tier 2 only

    const tier2AndTier3Amount = 5000; // 3333 already in tier 1, so 3333 in tier 2 and the rest 1334 in tier 3
    const tier2AndTier3Reward = 9166; // the reward in tier2 and tier 3

    const onlyTier3Amount = 3000; // There will be 3333 already in tier 1, 3333 in tier2 so this remaining amount would be in tier 3 entirely
    const onlyTier3Reward = 4500; // the reward

    const tier1 = 3333;
    const tier2 = 3333;

    // Reward in tier 1

    const jobAdIdTier1 = uuidv4();
    const applicationIdTier1 = uuidv4();

    await allProgramInitialize(jobAdIdTier1, applicationIdTier1, alice);

    let aliceTokenAccountBeforeStake = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    await stakeAmountFunction(
      jobAdIdTier1,
      applicationIdTier1,
      tier1Amount,
      alice,
      aliceTokenAccount
    );

    let aliceTokenAccountBefore = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    assert.equal(
      aliceTokenAccountBeforeStake.amount - aliceTokenAccountBefore.amount,
      tier1Amount
    );

    await fundPoolWallet(jobAdIdTier1);
    await changeStatusAndUnstake(
      jobAdIdTier1,
      applicationIdTier1,
      alice,
      aliceTokenAccount
    );

    let aliceTokenAccountAfter = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );
    assert.equal(
      aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount,
      tier1Reward
    );

    // Reward in tier 1 and 2

    const jobAdIdTier1And2 = uuidv4();
    const applicationIdTier1And2 = uuidv4();

    await allProgramInitialize(jobAdIdTier1And2, applicationIdTier1And2, alice);

    aliceTokenAccountBeforeStake = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    await stakeAmountFunction(
      jobAdIdTier1And2,
      applicationIdTier1And2,
      tier1AndTier2Amount,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountBefore = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    assert.equal(
      aliceTokenAccountBeforeStake.amount - aliceTokenAccountBefore.amount,
      tier1AndTier2Amount
    );

    await fundPoolWallet(jobAdIdTier1And2);
    await changeStatusAndUnstake(
      jobAdIdTier1And2,
      applicationIdTier1And2,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountAfter = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );
    assert.equal(
      aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount,
      tier1AndTier2Reward
    );

    // Reward in all 3 tiers

    const jobAdIdAll3Tiers = uuidv4();
    const applicationIdAll3Tiers = uuidv4();

    await allProgramInitialize(jobAdIdAll3Tiers, applicationIdAll3Tiers, alice);

    aliceTokenAccountBeforeStake = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    await stakeAmountFunction(
      jobAdIdAll3Tiers,
      applicationIdAll3Tiers,
      all3TierAmount,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountBefore = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    assert.equal(
      aliceTokenAccountBeforeStake.amount - aliceTokenAccountBefore.amount,
      all3TierAmount
    );

    await fundPoolWallet(jobAdIdAll3Tiers);
    await changeStatusAndUnstake(
      jobAdIdAll3Tiers,
      applicationIdAll3Tiers,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountAfter = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );
    assert.equal(
      aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount,
      all3TierReward
    );

    // reward in tier2 only

    const jobAdIdTier2 = uuidv4();
    const applicationIdTier2 = uuidv4();

    await allProgramInitialize(jobAdIdTier2, applicationIdTier2, alice);
    await allProgramInitialize(jobAdIdTier2, applicationIdTier2, cas); // Initializing with cas so the tier 1 deposit is done

    aliceTokenAccountBeforeStake = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    await stakeAmountFunction(
      jobAdIdTier2,
      applicationIdTier2,
      tier1,
      cas,
      casTokenAccount
    ); // now 3333 is already deposited, which means that any more deposits would go to tier2
    await stakeAmountFunction(
      jobAdIdTier2,
      applicationIdTier2,
      onlyTier2Amount,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountBefore = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    assert.equal(
      aliceTokenAccountBeforeStake.amount - aliceTokenAccountBefore.amount,
      onlyTier2Amount
    );

    await fundPoolWallet(jobAdIdTier2);
    await changeStatusAndUnstake(
      jobAdIdTier2,
      applicationIdTier2,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountAfter = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );
    assert.equal(
      aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount,
      onlyTier2Reward
    );

    // reward in tier 2 and tier 3
    const jobAdIdTier2And3 = uuidv4();
    const applicationIdTier2And3 = uuidv4();

    await allProgramInitialize(jobAdIdTier2And3, applicationIdTier2And3, alice);
    await allProgramInitialize(jobAdIdTier2And3, applicationIdTier2And3, cas); // Initializing with cas so the tier 1 deposit is done

    aliceTokenAccountBeforeStake = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    await stakeAmountFunction(
      jobAdIdTier2And3,
      applicationIdTier2And3,
      tier1,
      cas,
      casTokenAccount
    ); // now 3333 is already deposited, which means that any more deposits would go to tier2
    await stakeAmountFunction(
      jobAdIdTier2And3,
      applicationIdTier2And3,
      tier2AndTier3Amount,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountBefore = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    assert.equal(
      aliceTokenAccountBeforeStake.amount - aliceTokenAccountBefore.amount,
      tier2AndTier3Amount
    );

    await fundPoolWallet(jobAdIdTier2And3);
    await changeStatusAndUnstake(
      jobAdIdTier2And3,
      applicationIdTier2And3,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountAfter = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );
    assert.equal(
      aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount,
      tier2AndTier3Reward
    );

    // reward in tier 3
    const jobAdIdTier3 = uuidv4();
    const applicationIdTier3 = uuidv4();

    await allProgramInitialize(jobAdIdTier3, applicationIdTier3, alice);
    await allProgramInitialize(jobAdIdTier3, applicationIdTier3, cas); // Initializing with cas so the tier 1 deposit is done

    aliceTokenAccountBeforeStake = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    await stakeAmountFunction(
      jobAdIdTier3,
      applicationIdTier3,
      tier1 + tier2,
      cas,
      casTokenAccount
    ); // now 3333 + 3333 is already deposited, which means that any more deposits would go to tier3
    await stakeAmountFunction(
      jobAdIdTier3,
      applicationIdTier3,
      onlyTier3Amount,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountBefore = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );

    assert.equal(
      aliceTokenAccountBeforeStake.amount - aliceTokenAccountBefore.amount,
     onlyTier3Amount
    );

    await fundPoolWallet(jobAdIdTier3);
    await changeStatusAndUnstake(
      jobAdIdTier3,
      applicationIdTier3,
      alice,
      aliceTokenAccount
    );

    aliceTokenAccountAfter = await spl.getAccount(
      provider.connection,
      aliceTokenAccount
    );
    assert.equal(
      aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount,
      onlyTier3Reward
    );

    // console.log(aliceTokenAccountAfter.amount - aliceTokenAccountBefore.amount);

  });
});
