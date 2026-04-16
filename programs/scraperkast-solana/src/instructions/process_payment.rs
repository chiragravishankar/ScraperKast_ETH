use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{PaymentRecord, PlatformState, WebsiteAccount};
use crate::errors::ScraperKastError;
use crate::events::PaymentProcessed;

/// Account context for the `process_payment` instruction.
///
/// Atomically:
///   1. Transfers `base_price` micro-USDC from bot → website owner ATA.
///   2. Transfers `platform_fee` micro-USDC from bot → platform ATA.
///   3. Updates on-chain stats.
///   4. Creates an immutable `PaymentRecord`.
///
/// PDA seeds for PaymentRecord:
///   `["payment", bot.key, platform_state.total_payments_processed (LE bytes)]`
/// The counter is read *before* incrementing, so each payment gets a unique PDA.
#[derive(Accounts)]
#[instruction(bot_id: String, domain: String, base_price: u64, platform_fee: u64)]
pub struct ProcessPayment<'info> {
    // ── Platform state ────────────────────────────────────────────────────────

    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform_state.bump
    )]
    pub platform_state: Account<'info, PlatformState>,

    // ── Website state ─────────────────────────────────────────────────────────

    #[account(
        mut,
        seeds = [b"website", domain.as_bytes()],
        bump = website_account.bump,
        constraint = website_account.domain == domain @ ScraperKastError::InvalidDomain
    )]
    pub website_account: Account<'info, WebsiteAccount>,

    // ── Payment record (created atomically) ───────────────────────────────────

    #[account(
        init,
        payer = bot,
        space = 8 + PaymentRecord::SPACE,
        seeds = [
            b"payment",
            bot.key().as_ref(),
            &platform_state.total_payments_processed.to_le_bytes(),
        ],
        bump
    )]
    pub payment_record: Account<'info, PaymentRecord>,

    // ── Token accounts ────────────────────────────────────────────────────────

    /// Bot's USDC associated token account (source of both transfers).
    #[account(
        mut,
        associated_token::mint      = usdc_mint,
        associated_token::authority = bot,
    )]
    pub bot_token_account: Account<'info, TokenAccount>,

    /// Website owner's USDC associated token account (receives base_price).
    #[account(
        mut,
        associated_token::mint      = usdc_mint,
        associated_token::authority = website_account.owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    /// Platform's USDC associated token account (receives platform_fee).
    #[account(
        mut,
        associated_token::mint      = usdc_mint,
        associated_token::authority = platform_state.platform_wallet,
    )]
    pub platform_token_account: Account<'info, TokenAccount>,

    // ── Signers and programs ──────────────────────────────────────────────────

    /// The AI bot paying for content access. Must sign and own bot_token_account.
    #[account(mut)]
    pub bot: Signer<'info>,

    /// Must match `platform_state.usdc_mint` — prevents using counterfeit tokens.
    #[account(
        constraint = usdc_mint.key() == platform_state.usdc_mint
            @ ScraperKastError::InvalidUsdcMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program:            Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:           Program<'info, System>,
}

pub fn process_payment(
    ctx: Context<ProcessPayment>,
    bot_id: String,
    domain: String,
    base_price: u64,
    platform_fee: u64,
) -> Result<()> {
    // ── Input validation ──────────────────────────────────────────────────────

    require!(
        !bot_id.is_empty() && bot_id.len() <= PaymentRecord::MAX_BOT_ID_LEN,
        ScraperKastError::InvalidBotId
    );
    require!(
        !domain.is_empty() && domain.len() <= PaymentRecord::MAX_DOMAIN_LEN,
        ScraperKastError::InvalidDomain
    );

    let total_price = base_price
        .checked_add(platform_fee)
        .ok_or(ScraperKastError::ArithmeticOverflow)?;
    require!(total_price > 0, ScraperKastError::InvalidAmount);

    // ── Sufficient balance check ──────────────────────────────────────────────

    require!(
        ctx.accounts.bot_token_account.amount >= total_price,
        ScraperKastError::InsufficientBalance
    );

    // ── Capture values needed after mutable borrows ───────────────────────────

    let owner           = ctx.accounts.website_account.owner;
    let platform_wallet = ctx.accounts.platform_state.platform_wallet;
    let payment_bump    = ctx.bumps.payment_record;
    let clock           = Clock::get()?;
    let timestamp       = clock.unix_timestamp;

    // ── SPL token transfers ───────────────────────────────────────────────────

    // Transfer 1: base_price → website owner (95% portion)
    if base_price > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.bot_token_account.to_account_info(),
                    to:        ctx.accounts.owner_token_account.to_account_info(),
                    authority: ctx.accounts.bot.to_account_info(),
                },
            ),
            base_price,
        )?;
    }

    // Transfer 2: platform_fee → platform wallet (5% portion)
    if platform_fee > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.bot_token_account.to_account_info(),
                    to:        ctx.accounts.platform_token_account.to_account_info(),
                    authority: ctx.accounts.bot.to_account_info(),
                },
            ),
            platform_fee,
        )?;
    }

    // ── Update website account ────────────────────────────────────────────────

    let website = &mut ctx.accounts.website_account;
    website.total_earned = website
        .total_earned
        .checked_add(base_price)
        .ok_or(ScraperKastError::ArithmeticOverflow)?;
    website.total_requests_served = website
        .total_requests_served
        .checked_add(1)
        .ok_or(ScraperKastError::ArithmeticOverflow)?;

    // ── Update platform state ─────────────────────────────────────────────────

    let platform = &mut ctx.accounts.platform_state;
    platform.total_platform_fees_collected = platform
        .total_platform_fees_collected
        .checked_add(platform_fee)
        .ok_or(ScraperKastError::ArithmeticOverflow)?;
    platform.total_payments_processed = platform
        .total_payments_processed
        .checked_add(1)
        .ok_or(ScraperKastError::ArithmeticOverflow)?;

    // ── Write payment record ──────────────────────────────────────────────────

    let payment = &mut ctx.accounts.payment_record;
    payment.bot_id        = bot_id.clone();
    payment.domain        = domain.clone();
    payment.base_price    = base_price;
    payment.platform_fee  = platform_fee;
    payment.total_price   = total_price;
    payment.timestamp     = timestamp;
    // tx_signature cannot be self-referential; off-chain indexers derive it
    // via getSignaturesForAddress(payment_record_pubkey).
    payment.tx_signature  = String::new();
    payment.bump          = payment_bump;

    // ── Emit event ────────────────────────────────────────────────────────────

    emit!(PaymentProcessed {
        bot_id,
        domain,
        base_price,
        platform_fee,
        total_price,
        owner,
        platform_wallet,
        timestamp,
    });

    msg!(
        "Payment processed: {} µUSDC (owner {}) + {} µUSDC (platform {}) = {} µUSDC total",
        base_price,
        owner,
        platform_fee,
        platform_wallet,
        total_price,
    );

    Ok(())
}
