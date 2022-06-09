mod reward_calculator;
pub use reward_calculator::RewardCalculator;

use anchor_lang::prelude::*;

declare_id!("Fxe3yzwDaKnK8e2Mj4CqrK2YvTbFaUhqmnuTyH1dJWcX");

const APPLICATION_SEED: &'static [u8] = b"application";

#[program]
pub mod application {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        _job_ad_id: String,
        _application_id: String,
        max_allowed_stake: u32
    ) -> Result<()> {
        let parameter = &mut ctx.accounts.base_account;

        parameter.reset(ctx.accounts.authority.key(), max_allowed_stake);

        Ok(())
    }

    pub fn update_status(
        ctx: Context<UpdateStatus>,
        _application_id: String,
        _application_bump: u8,
        status: bool,
    ) -> Result<()> {
        if status {
            ctx.accounts.base_account.status = JobStatus::Selected;
        } else {
            ctx.accounts.base_account.status = JobStatus::Rejected;
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, application_id: String)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()],
        bump, 
        space = 8 + 32 + 1 + 4 + 4
    )]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(application_id: String, application_bump: u8)]
pub struct UpdateStatus<'info> {
    #[account(mut, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump = application_bump, has_one = authority)]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum JobStatus {
    Selected,
    Rejected,
    Pending,
}

#[account]
pub struct ApplicationParameter {
    pub authority: Pubkey,       // 32 bytes
    pub status: JobStatus,       // 1 byte
    pub staked_amount: u32,      // 4 bytes
    pub max_allowed_staked: u32, // 4 bytes
}

impl ApplicationParameter {
    pub fn reset(&mut self, authority: Pubkey, max_allowed_staked: u32) {
        self.authority = authority;
        self.status = JobStatus::Pending;
        self.staked_amount = 0;
        self.max_allowed_staked = max_allowed_staked;
    }
}
