mod reward_calculator;
pub use reward_calculator::RewardCalculator;
use general::program::General;
use general::{self, GeneralParameter};
use job::program::Job;
use job::cpi::accounts::UpdateRewards;
use job::{self, JobStakingParameter};
use anchor_lang::solana_program::sysvar::instructions as tx_instructions;

use anchor_lang::prelude::*;

declare_id!("Fxe3yzwDaKnK8e2Mj4CqrK2YvTbFaUhqmnuTyH1dJWcX");

const APPLICATION_SEED: &'static [u8] = b"application";
const GENERAL_SEED: &'static [u8] = b"general";
const JOB_SEED: &'static [u8] = b"jobfactory";

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
        application_id: String,
        application_bump: u8,
        job_id: String, 
        job_bump: u8,
        status: JobStatus,
    ) -> Result<()> {
        ctx.accounts.base_account.status = status;
        if ctx.accounts.base_account.status == JobStatus::Selected || ctx.accounts.base_account.status == JobStatus::SelectedButCantWithdraw {
                let bump_vector = application_bump.to_le_bytes();
                let inner = vec![
                    APPLICATION_SEED,
                    application_id.as_bytes()[..18].as_ref(),
                    application_id.as_bytes()[18..].as_ref(),
                    bump_vector.as_ref(),
                ];
                let outer = vec![inner.as_slice()];

                let cpi_accounts = UpdateRewards {
                    job_account: ctx.accounts.job_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                    instructions: ctx.accounts.instruction.to_account_info(),
                };
                let cpi_program = ctx.accounts.job_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, outer.as_slice());
                job::cpi::update_rewards(cpi_ctx, job_id.clone(),job_bump, ctx.accounts.base_account.total_reward_amount)?;
        }
        Ok(())
    }

    pub fn update_stake_amount(ctx: Context<UpdateStakeAmount>, _application_id: String, _application_bump: u8, stake_amount: u32, reward_amount: u32) -> Result<()> {
        msg!("cpi call is made yippee");
        let candidate_staking_program_id: &str = "BF1jhf5eA5X1Tu8JByv8htnkUaG6WzmYEMLx2kbZ7YiW";

        let ixns = ctx.accounts.instruction.to_account_info();
        let current_index = tx_instructions::load_current_index_checked(&ixns)? as usize;
        let current_ixn = tx_instructions::load_instruction_at_checked(current_index, &ixns)?;

        msg!("Current program ID: {} application program ID: {}", current_ixn.program_id, *ctx.program_id);
        if current_ixn.program_id.to_string() != candidate_staking_program_id {
            return Err(error!(ErrorCode::InvalidCall));
        }
        else {
           let parameters = &mut ctx.accounts.base_account;
           msg!("{}", parameters.staked_amount);
           parameters.staked_amount += stake_amount; 
           parameters.total_reward_amount += reward_amount;
        }
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
        space = 8 + 32 + 1 + 4 + 4 + 4
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
#[instruction(application_id: String, application_bump: u8, job_id: String, job_bump: u8)]
pub struct UpdateStatus<'info> {
    #[account(mut, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump = application_bump, has_one = authority)]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [JOB_SEED, job_id.as_bytes()[..18].as_ref(), job_id.as_bytes()[18..].as_ref()], bump = job_bump, seeds::program = job_program.key())]
    pub job_account: Account<'info, JobStakingParameter>,
    pub job_program: Program<'info, Job>,
    ///CHECK:
    pub instruction: AccountInfo<'info>
    
}

#[derive(Accounts)]
#[instruction(application_id: String, application_bump: u8)]
pub struct UpdateStakeAmount<'info> {
    #[account(mut, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump = application_bump)]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(address = tx_instructions::ID)]
    ///CHECK:
    pub instruction: AccountInfo<'info>
}



#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum JobStatus {
    Rejected,
    SelectedButCantWithdraw,
    Selected,
    Pending,
}

#[account]
pub struct ApplicationParameter {
    pub authority: Pubkey,       // 32 bytes
    pub status: JobStatus,       // 1 byte
    pub staked_amount: u32,      // 4 bytes
    pub max_allowed_staked: u32, // 4 bytes
    pub total_reward_amount: u32 // 4 bytes
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
    #[msg("Program Is not called By CPI")]
    InvalidCall,
}
