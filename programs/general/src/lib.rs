use anchor_lang::prelude::*;

declare_id!("CYSyfydPYcjjf3uXPHK5sPTpucuWy5vP1BYqcjKDZzB3");

const GENERAL_SEED: &'static [u8] = b"general";

#[program]
pub mod general {
    use super::*;

    /// initializes the general parameters and the mint key
    /// in a PDA with seed [GENERAL_SEED]
    pub fn initialize(ctx: Context<Initialize>, mint_key: String) -> Result<()> {
        let parameters = &mut ctx.accounts.base_account;
        parameters.mint = mint_key;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [GENERAL_SEED], bump, space = 32 + 8 )]
    pub base_account: Account<'info, GeneralParameters>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GeneralParameters {
    // QUESTION: Why is this a String and not a Pubkey?
    // Is it because we're going to later use it as a seed on a PDA?
    pub mint: String, // 32 bytes
}
