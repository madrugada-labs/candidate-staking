use anchor_lang::prelude::*;

declare_id!("BF1jhf5eA5X1Tu8JByv8htnkUaG6WzmYEMLx2kbZ7YiW");

const CANDIDATE_SEED: &'static [u8] = b"candidate";

#[program]
pub mod candidate_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, job_ad_id: String) -> Result<()> {

        let state = &mut ctx.accounts.base_account;

        state.reset(ctx.accounts.authority.key());

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [CANDIDATE_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref(), applicant.key().as_ref() ,authority.key().as_ref()], bump, space = 4 + 32 + 8 )]
    pub base_account: Account<'info, CandidateParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Used only to derive the PDA
    pub applicant: AccountInfo<'info>,
    pub system_program: Program<'info, System> 
}

#[account]
pub struct CandidateParameter {
    pub authority: Pubkey, // 32 bytes
    pub staked_amount: u32, // 4 bytes
}

impl CandidateParameter {
    pub fn reset(&mut self, authority: Pubkey) {
        self.authority = authority;
        self.staked_amount = 0;
    }
}
