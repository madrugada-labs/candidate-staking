use anchor_lang::prelude::*;
use anchor_spl::token::Mint;    


declare_id!("CYSyfydPYcjjf3uXPHK5sPTpucuWy5vP1BYqcjKDZzB3");

const GENERAL_SEED: &'static [u8] = b"general";


#[program]
pub mod general {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {

        let parameters = &mut ctx.accounts.base_account;

        parameters.mint = ctx.accounts.token_mint.key();
        parameters.authority = ctx.accounts.authority.key();


        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [GENERAL_SEED], bump, space = 32 + 32 + 8 )]
    pub base_account: Account<'info, GeneralParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>                                                 
}

#[account]
pub struct GeneralParameter {
    pub mint: Pubkey, // 32 bytes
    pub authority: Pubkey // 32 bytes
}
