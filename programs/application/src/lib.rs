use anchor_lang::prelude::*;

declare_id!("Fxe3yzwDaKnK8e2Mj4CqrK2YvTbFaUhqmnuTyH1dJWcX");

#[program]
pub mod application {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
