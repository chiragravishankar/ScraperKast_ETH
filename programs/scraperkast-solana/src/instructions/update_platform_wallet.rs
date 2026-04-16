use anchor_lang::prelude::*;
use crate::state::PlatformState;
use crate::errors::ScraperKastError;
use crate::events::PlatformWalletUpdated;

/// Account context for the `update_platform_wallet` instruction.
///
/// Only the `authority` stored in `PlatformState` can call this.
#[derive(Accounts)]
pub struct UpdatePlatformWallet<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform_state.bump,
        has_one = authority @ ScraperKastError::Unauthorized
    )]
    pub platform_state: Account<'info, PlatformState>,

    /// Must match `platform_state.authority`.
    pub authority: Signer<'info>,
}

pub fn update_platform_wallet(
    ctx: Context<UpdatePlatformWallet>,
    new_wallet: Pubkey,
) -> Result<()> {
    let clock     = Clock::get()?;
    let state     = &mut ctx.accounts.platform_state;
    let old_wallet = state.platform_wallet;

    state.platform_wallet = new_wallet;

    emit!(PlatformWalletUpdated {
        old_wallet,
        new_wallet,
        timestamp: clock.unix_timestamp,
    });

    msg!("Platform wallet updated: {} → {}", old_wallet, new_wallet);

    Ok(())
}
