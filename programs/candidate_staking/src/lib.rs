use anchor_lang::prelude::*;

declare_id!("BF1jhf5eA5X1Tu8JByv8htnkUaG6WzmYEMLx2kbZ7YiW");

#[program]
pub mod candidate_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
