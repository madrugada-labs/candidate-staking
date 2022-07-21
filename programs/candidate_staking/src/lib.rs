use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use application::program::Application;
use application::cpi::accounts::UpdateStakeAmount;
use job::cpi::accounts::UnstakeToken;
use application::{self, ApplicationParameter, JobStatus, RewardCalculator};
use general::program::General;
use general::{self, GeneralParameter};
use job::program::Job;
use job::{self, JobStakingParameter};

declare_id!("BF1jhf5eA5X1Tu8JByv8htnkUaG6WzmYEMLx2kbZ7YiW");

const CANDIDATE_SEED: &'static [u8] = b"candidate";
const JOB_SEED: &'static [u8] = b"jobfactory";
const APPLICATION_SEED: &'static [u8] = b"application";
const GENERAL_SEED: &'static [u8] = b"general";
const WALLET_SEED: &'static [u8] = b"wallet";

#[program]
pub mod candidate_staking {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        _job_ad_id: String,
        _application_id: String,
        _job_bump: u8
    ) -> Result<()> {
        let state = &mut ctx.accounts.base_account;

        state.reset(ctx.accounts.authority.key());

        Ok(())
    }

    pub fn stake(
        ctx: Context<Stake>,
        _job_ad_id: String,
        application_id: String,
        base_bump: u8,
        _general_bump: u8,
        application_bump: u8,
        _job_bump: u8,
        _wallet_bump: u8,
        amount: u32,
    ) -> Result<()> {
        let general_parameter = &mut ctx.accounts.general_account;
        let application_parameter = &mut ctx.accounts.application_account;

        if general_parameter.mint == ctx.accounts.token_mint.key() {
            msg!("Mint is matching");

            let already_staked_amount = application_parameter.staked_amount;
            let max_amount = application_parameter.max_allowed_staked;

            if already_staked_amount + amount < max_amount {
                msg!("You can transfer");
                msg!("Transfer is initiated");

                let reward_calculator = RewardCalculator::new(application_parameter.as_ref());

                ctx.accounts.base_account.staked_amount += amount;
                ctx.accounts.base_account.reward_amount +=
                    reward_calculator.calculate_reward(amount)?;

                // making cpi call to application program to update the staked amount

                // let application_bump_vector = application_bump.to_le_bytes();
                // let inner = vec![
                //     APPLICATION_SEED,
                //     application_id.as_bytes()[..18].as_ref(),
                //     application_id.as_bytes()[18..].as_ref(),
                //     application_bump_vector.as_ref(),
                // ];
                // let outer = vec![inner.as_slice()];
                let authority_key = ctx.accounts.authority.key();

                let bump_vector = base_bump.to_le_bytes();
                let inner = vec![
                    CANDIDATE_SEED,
                    application_id.as_bytes()[..18].as_ref(),
                    application_id.as_bytes()[18..].as_ref(),
                    authority_key.as_ref(),
                    bump_vector.as_ref(),
                ];
                let outer = vec![inner.as_slice()];

                let cpi_accounts = UpdateStakeAmount {
                    base_account: ctx.accounts.application_account.to_account_info(),
                };
                let cpi_program = ctx.accounts.application_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, outer.as_slice());
                application::cpi::update_stake_amount(cpi_ctx, application_id.clone(), application_bump, amount)?;

                // Below is the actual instruction that we are going to send to the Token program.
                let transfer_instruction = Transfer {
                    from: ctx.accounts.wallet_to_withdraw_from.to_account_info(),
                    to: ctx.accounts.escrow_wallet_state.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                };
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    outer.as_slice(), //signer PDA
                );

                let amount_in_32 = amount as u64;

                // The `?` at the end will cause the function to return early in case of an error.
                // This pattern is common in Rust.
                anchor_spl::token::transfer(cpi_ctx, amount_in_32)?;

                msg!("token is deposited");
            } else {
                return Err(error!(ErrorCode::MaxAmountExceeded));
            }
        } else {
            return Err(error!(ErrorCode::InvalidToken));
        }

        Ok(())
    }

    pub fn unstake(
        ctx: Context<Unstake>,
        base_bump: u8,
        _application_bump: u8,
        wallet_bump: u8,
        application_id: String,
        job_ad_id: String,
        job_bump: u8,
    ) -> Result<()> {
        let application = &mut ctx.accounts.application_account;

        match application.status {
            JobStatus::Pending => {
                msg!("It is locked, u wont get anything now");
                return Err(error!(ErrorCode::StatusPending));
            }
            JobStatus::SelectedButCantWithdraw => {
                msg!("You are selected but u need to wait before we can transfer");
                return Err(error!(ErrorCode::SelectedButCantTransfer));
            }
            JobStatus::Selected => {
                msg!("you are selected");
                let authority_key = ctx.accounts.authority.key();

                let bump_vector = base_bump.to_le_bytes();
                let inner = vec![
                    CANDIDATE_SEED,
                    application_id.as_bytes()[..18].as_ref(),
                    application_id.as_bytes()[18..].as_ref(),
                    authority_key.as_ref(),
                    bump_vector.as_ref(),
                ];
                let outer = vec![inner.as_slice()];

                let cpi_accounts = UnstakeToken {
                    job_account: ctx.accounts.job_account.to_account_info(),
                    token_mint: ctx.accounts.token_mint.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                    escrow_wallet_state: ctx.accounts.escrow_wallet_state.to_account_info(),
                    wallet_to_deposit_to: ctx.accounts.wallet_to_deposit_to.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    rent : ctx.accounts.rent.to_account_info(),
                    instructions: ctx.accounts.instruction.to_account_info(),
                };
                let cpi_program = ctx.accounts.job_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, outer.as_slice());
                job::cpi::unstake(cpi_ctx, job_ad_id, job_bump, wallet_bump, ctx.accounts.base_account.reward_amount)?;

            }
            JobStatus::Rejected => {
                msg!("you are rejected");
                let authority_key = ctx.accounts.authority.key();

                let bump_vector = base_bump.to_le_bytes();
                let inner = vec![
                    CANDIDATE_SEED,
                    application_id.as_bytes()[..18].as_ref(),
                    application_id.as_bytes()[18..].as_ref(),
                    authority_key.as_ref(),
                    bump_vector.as_ref(),
                ];
                let outer = vec![inner.as_slice()];

                let cpi_accounts = UnstakeToken {
                    job_account: ctx.accounts.job_account.to_account_info(),
                    token_mint: ctx.accounts.token_mint.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                    escrow_wallet_state: ctx.accounts.escrow_wallet_state.to_account_info(),
                    wallet_to_deposit_to: ctx.accounts.wallet_to_deposit_to.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    rent : ctx.accounts.rent.to_account_info(),
                    instructions: ctx.accounts.instruction.to_account_info(),
                };
                let cpi_program = ctx.accounts.job_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, outer.as_slice());
                job::cpi::unstake(cpi_ctx, job_ad_id, job_bump, wallet_bump, ctx.accounts.base_account.staked_amount)?;
            } // JobStatus::HEAD => todo!(),
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, application_id: String, job_bump: u8)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [CANDIDATE_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref(), authority.key().as_ref()], bump, space = 4 + 4 + 32 + 8 )]
    pub base_account: Account<'info, CandidateParameter>,
    #[account(mut, seeds = [JOB_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump, seeds::program = job_program.key())]
    pub job_account: Box<Account<'info, JobStakingParameter>>,
    #[account(
        init_if_needed, payer = authority,
        seeds = [WALLET_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = job_account,
    )]
    pub escrow_wallet_state: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub job_program: Program<'info, Job>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, application_id: String, base_bump: u8, general_bump: u8, application_bump: u8, job_bump: u8, wallet_bump: u8)]
pub struct Stake<'info> {
    #[account(mut, seeds = [CANDIDATE_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref() ,authority.key().as_ref()],bump = base_bump)]
    pub base_account: Account<'info, CandidateParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = general_program.key())]
    pub general_account: Account<'info, GeneralParameter>,
    #[account(mut, seeds = [JOB_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump, seeds::program = job_program.key())]
    pub job_account: Box<Account<'info, JobStakingParameter>>,
    #[account(mut, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump = application_bump, seeds::program = application_program.key())]
    pub application_account: Account<'info, ApplicationParameter>,

    pub general_program: Program<'info, General>,
    pub application_program: Program<'info, Application>,
    pub job_program: Program<'info, Job>,

    #[account(
        mut,
        seeds = [WALLET_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()],
        bump = wallet_bump,
        token::mint = token_mint,
        token::authority = job_account,
    )]
    pub escrow_wallet_state: Account<'info, TokenAccount>,
    #[account(
        mut,
        // constraint=wallet_to_withdraw_from.owner == authority.key(),
        // constraint=wallet_to_withdraw_from.mint == token_mint.key()
    )]
    pub wallet_to_withdraw_from: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    
}

#[derive(Accounts)]
#[instruction(base_bump: u8, application_bump: u8, wallet_bump: u8, application_id: String, job_ad_id: String, job_bump: u8)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [CANDIDATE_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref() ,authority.key().as_ref()],bump = base_bump)]
    pub base_account: Account<'info, CandidateParameter>,
    #[account(mut, seeds = [JOB_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = job_bump, seeds::program = job_program.key())]
    pub job_account: Box<Account<'info, JobStakingParameter>>,
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump = application_bump, seeds::program = application_program.key())]
    pub application_account: Account<'info, ApplicationParameter>,

    pub application_program: Program<'info, Application>,
    #[account(
        mut,
        seeds = [WALLET_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()],
        bump = wallet_bump,
        token::mint = token_mint,
        token::authority = job_account,
    )]
    pub escrow_wallet_state: Account<'info, TokenAccount>,
    #[account(
        mut,
        // constraint=wallet_to_withdraw_from.owner == authority.key(),
        // constraint=wallet_to_withdraw_from.mint == token_mint.key()
    )]
    pub wallet_to_deposit_to: Account<'info, TokenAccount>,
    pub job_program: Program<'info, Job>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    ///CHECK:
    pub instruction: AccountInfo<'info>
}

#[account]
pub struct CandidateParameter {
    pub authority: Pubkey,  // 32 bytes
    pub staked_amount: u32, // 4 bytes
    pub reward_amount: u32, // 4 bytes
}

impl CandidateParameter {
    pub fn reset(&mut self, authority: Pubkey) {
        self.authority = authority;
        self.staked_amount = 0;
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("You can deposit only USDC token. ")]
    InvalidToken,
    #[msg("The stake amount is exceeded. ")]
    MaxAmountExceeded,
    #[msg("The application status is still under consideration")]
    StatusPending,
    #[msg("The staked application is selected but u would have to wait before u can withdraw")]
    SelectedButCantTransfer,
}
