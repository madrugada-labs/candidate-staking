use anchor_lang::prelude::*;

declare_id!("Fxe3yzwDaKnK8e2Mj4CqrK2YvTbFaUhqmnuTyH1dJWcX");

const APPLICATION_SEED: &'static [u8] = b"application";

#[program]
pub mod application {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, _job_ad_id: String, _application_id: String) -> Result<()> {

        let parameter = &mut ctx.accounts.base_account;

        parameter.reset(ctx.accounts.authority.key());

        Ok(())
    }

    pub fn update_status(ctx: Context<UpdateStatus>, _application_id: String , _application_bump: u8, status: bool,) -> Result<()> {

        if status {
            ctx.accounts.base_account.status = JobStatus::Selected;
        }
        else {
            ctx.accounts.base_account.status = JobStatus::Rejected;
        }


        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_ad_id: String, application_id: String)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump , space = 4 + 32 + 1 + 8 )]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>    
}

#[derive(Accounts)]
#[instruction(application_id: String, application_bump: u8)]
pub struct UpdateStatus<'info> {
    #[account(mut, seeds = [APPLICATION_SEED, application_id.as_bytes()[..18].as_ref(), application_id.as_bytes()[18..].as_ref()], bump = application_bump, has_one = authority)]
    pub base_account: Account<'info, ApplicationParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub enum JobStatus {
    Selected,
    Rejected,
    Pending
}

#[account]
pub struct ApplicationParameter {
    pub authority: Pubkey, // 32 bytes
    pub status: JobStatus, // 1 byte
    pub stake_amount: u32, // 4 bytes
}

impl ApplicationParameter {
    pub fn reset(&mut self, authority: Pubkey) {
        self.authority = authority;
        self.status = JobStatus::Pending;
        self.stake_amount = 0;
    }
}
