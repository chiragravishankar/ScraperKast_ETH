use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::state::PlatformState;
use crate::events::PlatformInitialized;

/// Account context for the `initialize` instruction.
///
/// This instruction can be called exactly once: Anchor's `init` constraint
/// will reject any attempt to re-initialise an existing `PlatformState` PDA.
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The singleton platform state account.
    /// PDA seeds: `["platform"]`
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformState::SPACE,
        seeds = [b"platform"],
        bump
    )]
    pub platform_state: Account<'info, PlatformState>,

    /// The admin wallet that pays for account creation and becomes the authority.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The wallet that will receive 5% platform fees.
    /// Validated only as a valid account — no on-chain constraint on ownership.
    /// CHECK: platform_wallet is stored as an opaque Pubkey; authority is
    /// responsible for supplying the correct fee-collection address.
    pub platform_wallet: UncheckedAccount<'info>,

    /// The USDC token mint for this deployment (devnet or mainnet).
    /// Stored in PlatformState and verified on every `process_payment` call.
    pub usdc_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let clock = Clock::get()?;
    let state = &mut ctx.accounts.platform_state;

    state.authority                    = ctx.accounts.authority.key();
    state.platform_wallet              = ctx.accounts.platform_wallet.key();
    state.usdc_mint                    = ctx.accounts.usdc_mint.key();
    state.total_payments_processed     = 0;
    state.total_platform_fees_collected = 0;
    state.bump                         = ctx.bumps.platform_state;

    emit!(PlatformInitialized {
        authority:       state.authority,
        platform_wallet: state.platform_wallet,
        usdc_mint:       state.usdc_mint,
        timestamp:       clock.unix_timestamp,
    });

    msg!(
        "ScraperKast platform initialized. Authority: {}, Platform wallet: {}, USDC mint: {}",
        state.authority,
        state.platform_wallet,
        state.usdc_mint,
    );

    Ok(())
}
