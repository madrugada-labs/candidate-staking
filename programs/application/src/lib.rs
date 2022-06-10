mod reward_calculator;
pub use reward_calculator::RewardCalculator;
use general::program::General;
use general::{self, GeneralParameter};

use anchor_lang::prelude::*;

declare_id!("Fxe3yzwDaKnK8e2Mj4CqrK2YvTbFaUhqmnuTyH1dJWcX");

const APPLICATION_SEED: &'static [u8] = b"application";
const GENERAL_SEED: &'static [u8] = b"general";


#[program]
pub mod application {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        _job_ad_id: String,
        _application_id: String,
        _general_bump: u8,
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
        status: JobStatus,
    ) -> Result<()> {

        ctx.accounts.base_account.status = status;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, application_id: String, general_bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()],
        bump, 
        constraint = authority.key() == general_account.authority @ ErrorCode::InvalidAuthority,
        space = 8 + 32 + 1 + 4 + 4
    )]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = general_program.key())]
    pub general_account: Account<'info, GeneralParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub general_program: Program<'info, General>,
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
    Pending,
    Rejected,
    SelectedButCantWithdraw,
    Selected,
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

#[error_code]
pub enum ErrorCode {
    #[msg("You dont have the authority to create the application")]
    InvalidAuthority,
    #[msg("Invalid status value")]
    InvalidStatus,
}
