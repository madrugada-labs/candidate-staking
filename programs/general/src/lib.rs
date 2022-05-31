use anchor_lang::prelude::*;

declare_id!("CYSyfydPYcjjf3uXPHK5sPTpucuWy5vP1BYqcjKDZzB3");

const GENERAL_SEED: &'static [u8] = b"general";


#[program]
pub mod general {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, mint_key: String) -> Result<()> {

        let parameters = &mut ctx.accounts.base_account;

        parameters.mint = mint_key;


        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [GENERAL_SEED], bump, space = 4 + 32 + 40 + 8 )]
    pub base_account: Account<'info, GeneralParameter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>                                                 
}

#[account]
pub struct GeneralParameter {
    pub mint: String
}
