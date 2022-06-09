use anchor_lang::prelude::*;
use general::program::General;
use general::{self, GeneralParameter};

declare_id!("69dteSt8rK7HLvku1kqXhw4UsmanCGa8sDcqxgeeYUS8");

const JOB_FACTORY_SEED: &'static [u8] = b"jobfactory";
const GENERAL_SEED: &'static [u8] = b"general";


#[program]
pub mod job {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, job_ad_id: String, general_bump: u8, max_amount_per_application: u32) -> Result<()> {

        let general_parameters = &mut ctx.accounts.general_account;
        if general_parameters.authority != ctx.accounts.authority.key() {
            return Err(error!(ErrorCode::InvalidAuthority));
        }

        let parameters = &mut ctx.accounts.base_account;

        parameters.authority = ctx.accounts.authority.key();
        parameters.job_ad_id = job_ad_id;
        parameters.max_amount_per_application = max_amount_per_application;

        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(job_ad_id: String, general_bump: u8)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump, space = 4 + 32 + 40 + 8 )]
    pub base_account: Account<'info, JobStakingParameter>,
    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = general_program.key())]
    pub general_account: Account<'info, GeneralParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub general_program: Program<'info, General>,
    pub system_program: Program<'info, System>                                                 
}

#[account]
pub struct JobStakingParameter {
    pub authority: Pubkey, // 32 bytes
    pub job_ad_id: String, // 40 bytes
    pub max_amount_per_application: u32 // 4 bytes
}

#[error_code]
pub enum ErrorCode {
    #[msg("You dont have the authority to create the job")]
    InvalidAuthority,
}