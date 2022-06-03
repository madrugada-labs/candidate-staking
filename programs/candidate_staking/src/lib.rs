use anchor_lang::prelude::*;
use general::program::General;
use general::{self, GeneralParameter};
use job::program::Job;
use job::{self, JobStakingParameter};
use application::program::Application;
use application::{self, ApplicationParameter};
use anchor_spl::{associated_token::AssociatedToken, token::{CloseAccount, Mint, Token, TokenAccount, Transfer}};    

declare_id!("BF1jhf5eA5X1Tu8JByv8htnkUaG6WzmYEMLx2kbZ7YiW");

const CANDIDATE_SEED: &'static [u8] = b"candidate";
const JOB_SEED: &'static [u8] = b"jobfactory";
const APPLICATION_SEED: &'static [u8] = b"application";
const GENERAL_SEED: &'static [u8] = b"general";

#[program]
pub mod candidate_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, job_ad_id: String) -> Result<()> {

        let state = &mut ctx.accounts.base_account;

        state.reset(ctx.accounts.authority.key());

        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, job_ad_id: String, base_bump: u8, general_bump: u8, application_bump: u8, job_bump: u8, amount: u32) -> Result<()> {

        let general_parameter = &mut ctx.accounts.general_account;
        let job_parameter = &mut ctx.accounts.job_account;
        let application_parameter= &mut ctx.accounts.application_account;

        if general_parameter.mint == ctx.accounts.token_mint.key() {
            msg!("Mint is matching");

            let already_staked_amount = application_parameter.stake_amount;
            let max_amount = job_parameter.max_amount_per_application;
            if already_staked_amount + amount < max_amount {
                msg!("You can transfer");
            }
            else{
                msg!("You cannot transfer");
            }
        }
        else{
            msg!("Mint is not matching");
        }

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
#[derive(Accounts)]
#[instruction(job_ad_id: String, base_bump: u8, general_bump: u8, application_bump: u8, job_bump: u8)]
pub struct Stake<'info> {
    #[account(mut, seeds = [CANDIDATE_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref(), applicant.key().as_ref() ,authority.key().as_ref()],bump = base_bump)]
    pub base_account: Account<'info, CandidateParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = general_program.key())]
    pub general_account: Account<'info, GeneralParameter>,
    #[account(mut, seeds = [JOB_SEED,job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump, seeds::program = job_program.key())]
    pub job_account: Account<'info, JobStakingParameter>,
    #[account(mut, seeds = [APPLICATION_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref(), applicant.key().as_ref()], bump = application_bump, seeds::program = application_program.key())]
    pub application_account: Account<'info, ApplicationParameter>,

    /// CHECK: Used only to derive the PDA
    pub applicant: AccountInfo<'info>,

    pub general_program: Program<'info, General>,
    pub application_program: Program<'info, Application>,
    pub job_program: Program<'info, Job>
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
