use anchor_lang::prelude::*;
use general::program::General;
use general::{self, GeneralParameters};

declare_id!("69dteSt8rK7HLvku1kqXhw4UsmanCGa8sDcqxgeeYUS8");

const JOB_FACTORY_SEED: &'static [u8] = b"jobfactory";
const GENERAL_SEED: &'static [u8] = b"general";

#[program]
pub mod job {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        job_ad_id: String,
        max_amount_per_application: u32,
    ) -> Result<()> {
        assert_eq!(job_ad_id.len(), 36, "does not have a uuid length");
        let parameters = &mut ctx.accounts.base_account;

        parameters.authority = ctx.accounts.authority.key();
        parameters.job_ad_id = job_ad_id;
        parameters.max_amount_per_application = max_amount_per_application;

        Ok(())
    }

    /// debug instruction that outputs the mint key as a string
    pub fn check_data(
        ctx: Context<CheckData>,
        job_ad_id: String,
        base_bump: u8,
        general_bump: u8,
    ) -> Result<()> {
        let parameter = &mut ctx.accounts.general_account;
        let x = parameter.mint.clone();

        msg!(&x);

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()],
        bump,
        space = 4 + 32 + 40 + 8
    )]
    pub base_account: Account<'info, JobStakingParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, base_bump: u8, general_bump: u8)]
pub struct CheckData<'info> {
    #[account(mut, seeds = [JOB_FACTORY_SEED, job_ad_id.as_bytes()[..18].as_ref(), job_ad_id.as_bytes()[18..].as_ref()], bump = base_bump)]
    pub base_account: Account<'info, JobStakingParameter>,
    #[account(mut, seeds = [GENERAL_SEED], bump = general_bump, seeds::program = other_program.key())]
    pub general_account: Account<'info, GeneralParameters>,
    pub other_program: Program<'info, General>,
}

#[account]
pub struct JobStakingParameter {
    pub authority: Pubkey,               // 32 bytes
    pub job_ad_id: String,               // 40 bytes
    pub max_amount_per_application: u32, // 4 bytes
}
