use anchor_lang::prelude::*;

declare_id!("CYSyfydPYcjjf3uXPHK5sPTpucuWy5vP1BYqcjKDZzB3");

#[program]
pub mod general {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
