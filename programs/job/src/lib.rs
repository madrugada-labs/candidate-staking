use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as tx_instructions;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use general::program::General;
use general::{self, GeneralParameter};

declare_id!("2hfgvbWKSzzFYRSeMSBHhA5qBYSFYPojVsf81hXVFbMk");

const JOB_FACTORY_SEED: &'static [u8] = b"jobfactory";
const GENERAL_SEED: &'static [u8] = b"general";

const CANDIDATE_STAKING_PROGRAM_ID: &'static str = "GCPpQABMRJ7bhRCqaYtBo7G1b5popATvcXDs2c1bK4hW";
const APPLICATION_PROGRAM_ID: &'static str = "7NBejsPH8cgtSkmqgSKyUffx8fYnrGCDp9fxePdjRXe7";

#[program]
pub mod job {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        job_ad_id: String,
        _general_bump: u8,
        max_amount_per_application: u64,
    ) -> Result<()> {
        let parameters = &mut ctx.accounts.base_account;

        parameters.authority = ctx.accounts.authority.key();
        parameters.job_ad_id = job_ad_id;
        parameters.max_amount_per_application = max_amount_per_application;
        parameters.total_reward_to_be_given = 0;
        parameters.mint = ctx.accounts.general_account.mint;

        Ok(())
    }

    pub fn update_rewards(
        ctx: Context<UpdateRewards>,
        _job_ad_id: String,
        _job_bump: u8,
        reward_amount: u64,
    ) -> Result<()> {
        let ixns = ctx.accounts.instructions.to_account_info();
        let current_index = tx_instructions::load_current_index_checked(&ixns)? as usize;
        let current_ixn = tx_instructions::load_instruction_at_checked(current_index, &ixns)?;

        msg!(
            "Current program ID: {} job program ID: {}",
            current_ixn.program_id,
            *ctx.program_id
        );

        // let candidate_parameters = &mut ctx.accounts.candidate_account;

        if APPLICATION_PROGRAM_ID != current_ixn.program_id.to_string() {
            return Err(error!(ErrorCode::InvalidCall));
        } else {
            let parameters = &mut ctx.accounts.job_account;

            parameters.total_reward_to_be_given = parameters
                .total_reward_to_be_given
                .checked_add(reward_amount)
                .ok_or_else(|| ErrorCode::TotalRewardAmountOverflow)?;
        }

        Ok(())
    }

    pub fn unstake(
        ctx: Context<UnstakeToken>,
        job_ad_id: String,
        job_bump: u8,
        _wallet_bump: u8,
        amount: u64,
    ) -> Result<()> {
        msg!("CPI call happening successfully");

        let ixns = ctx.accounts.instructions.to_account_info();
        let current_index = tx_instructions::load_current_index_checked(&ixns)? as usize;
        let current_ixn = tx_instructions::load_instruction_at_checked(current_index, &ixns)?;

        msg!(
            "Current program ID: {} job program ID: {}",
            current_ixn.program_id,
            *ctx.program_id
        );

        if CANDIDATE_STAKING_PROGRAM_ID != current_ixn.program_id.to_string() {
            return Err(error!(ErrorCode::InvalidCall));
        } else {
            let bump_vector = job_bump.to_le_bytes();
            let inner = vec![
                JOB_FACTORY_SEED,
                job_ad_id.as_bytes()[..18].as_ref(),
                job_ad_id.as_bytes()[18..].as_ref(),
                bump_vector.as_ref(),
            ];
            let outer = vec![inner.as_slice()];

            // Below is the actual instruction that we are going to send to the Token program.
            let transfer_instruction = Transfer {
                from: ctx.accounts.escrow_wallet_state.to_account_info(),
                to: ctx.accounts.wallet_to_deposit_to.to_account_info(),
                authority: ctx.accounts.job_account.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                outer.as_slice(), //signer PDA
            );

            let amount_in_64 = amount as u64;

            anchor_spl::token::transfer(cpi_ctx, amount_in_64)?;

            msg!("transfer happened");
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, general_bump: u8)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump, constraint = authority.key() == general_account.authority @ ErrorCode::InvalidAuthority, space = 8 + 32 + 32 + 40 + 8 + 8 )]
    pub base_account: Account<'info, JobStakingParameter>,
    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = general_program.key())]
    pub general_account: Account<'info, GeneralParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub general_program: Program<'info, General>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, job_bump: u8, wallet_bump: u8)]
pub struct UnstakeToken<'info> {
    #[account(mut, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump)]
    pub job_account: Box<Account<'info, JobStakingParameter>>,
    #[account(constraint = token_mint.key() == job_account.mint @ ErrorCode::InvalidTokenMint)]
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub escrow_wallet_state: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint=wallet_to_deposit_to.owner == authority.key(),
        constraint=wallet_to_deposit_to.mint == token_mint.key()
    )]
    pub wallet_to_deposit_to: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = tx_instructions::ID)]
    ///CHECK:
    pub instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, job_bump: u8)]
pub struct UpdateRewards<'info> {
    #[account(mut, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump)]
    pub job_account: Account<'info, JobStakingParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(address  = tx_instructions::ID)]
    ///CHECK:
    pub instructions: AccountInfo<'info>,
}

#[account]
pub struct JobStakingParameter {
    pub authority: Pubkey,               // 32 bytes
    pub mint: Pubkey,                    // 32 bytes
    pub job_ad_id: String,               // 40 bytes
    pub max_amount_per_application: u64, // 8 bytes
    pub total_reward_to_be_given: u64,   // 8 bytes
}

#[account]
pub struct CandidateParameter {
    pub authority: Pubkey,  // 32 bytes
    pub staked_amount: u64, // 8 bytes
    pub reward_amount: u64, // 8 bytes
}

#[error_code]
pub enum ErrorCode {
    #[msg("You dont have the authority to create the job")]
    InvalidAuthority,
    #[msg("You dont have the permission to call this")]
    InvalidCall,
    #[msg("Total reward amount overflow")]
    TotalRewardAmountOverflow,
    #[msg("The token mint should should match to the one which was deposited")]
    InvalidTokenMint,
}
