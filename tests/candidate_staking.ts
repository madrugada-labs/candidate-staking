import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CandidateStaking } from "../target/types/candidate_staking";

describe("candidate_staking", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.CandidateStaking as Program<CandidateStaking>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
