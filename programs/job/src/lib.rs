use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use general::program::General;
// use candidate_staking::program::CandidateStaking;
use general::{self, GeneralParameter};
// use candidate_staking::{self, CandidateStakingParameter};

declare_id!("69dteSt8rK7HLvku1kqXhw4UsmanCGa8sDcqxgeeYUS8");

const JOB_FACTORY_SEED: &'static [u8] = b"jobfactory";
const GENERAL_SEED: &'static [u8] = b"general";
const WALLET_SEED: &'static [u8] = b"wallet";
const CANDIDATE_SEED: &'static [u8] = b"candidate";

#[program]
pub mod job {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        job_ad_id: String,
        _general_bump: u8,
        max_amount_per_application: u32,
    ) -> Result<()> {
        let parameters = &mut ctx.accounts.base_account;

        parameters.authority = ctx.accounts.authority.key();
        parameters.job_ad_id = job_ad_id;
        parameters.max_amount_per_application = max_amount_per_application;

        Ok(())
    }

    pub fn unstake_with_rewards(
        ctx: Context<UnstakeToken>,
        job_ad_id: String,
        job_bump: u8,
        wallet_bump: u8,
        amount: u32
    ) -> Result<()> {
        msg!("CPI call happening successfully");

        // let candidate_parameters = &mut ctx.accounts.candidate_account;

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

        // The `?` at the end will cause the function to return early in case of an error.
        // This pattern is common in Rust.
        anchor_spl::token::transfer(cpi_ctx, amount_in_64)?;

        msg!("transfer happened");

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, general_bump: u8)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump, constraint = authority.key() == general_account.authority @ ErrorCode::InvalidAuthority, space = 4 + 32 + 40 + 8 )]
    pub base_account: Account<'info, JobStakingParameter>,
    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = general_program.key())]
    pub general_account: Account<'info, GeneralParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub general_program: Program<'info, General>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, job_bump: u8, wallet_bump: u8, application_id)]
pub struct UnstakeToken<'info> {
    #[account(init, payer = authority, seeds = [CANDIDATE_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref(), authority.key().as_ref()], bump, seeds::program = candidate_program.key())]
    pub candidate_account: Account<'info, CandidateParameter>,
    #[account(mut, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump)]
    pub job_account: Box<Account<'info, JobStakingParameter>>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub escrow_wallet_state: Account<'info, TokenAccount>,
    #[account(
        mut,
        // constraint=wallet_to_withdraw_from.owner == authority.key(),
        // constraint=wallet_to_withdraw_from.mint == token_mint.key()
    )]
    pub wallet_to_deposit_to: Account<'info, TokenAccount>,
    // pub candidate_program: Program<'info, CandidateStaking>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct JobStakingParameter {
    pub authority: Pubkey,               // 32 bytes
    pub job_ad_id: String,               // 40 bytes
    pub max_amount_per_application: u32, // 4 bytes
}

#[error_code]
pub enum ErrorCode {
    #[msg("You dont have the authority to create the job")]
    InvalidAuthority,
}
