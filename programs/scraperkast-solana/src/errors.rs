use anchor_lang::prelude::*;

#[error_code]
pub enum ScraperKastError {
    // ── Input validation ──────────────────────────────────────────────────────
    #[msg("Domain must be between 1 and 100 characters")]
    InvalidDomain,

    #[msg("Bot ID must be between 1 and 50 characters")]
    InvalidBotId,

    #[msg("Transaction signature must be at most 88 characters")]
    SignatureTooLong,

    // ── Payment validation ────────────────────────────────────────────────────
    #[msg("Payment amounts must be greater than zero in total")]
    InvalidAmount,

    #[msg("Bot token account has insufficient USDC balance")]
    InsufficientBalance,

    #[msg("USDC mint does not match the expected mint for this network")]
    InvalidUsdcMint,

    // ── Arithmetic ────────────────────────────────────────────────────────────
    #[msg("Arithmetic overflow — amount too large")]
    ArithmeticOverflow,

    // ── Access control ────────────────────────────────────────────────────────
    #[msg("Only the platform authority can perform this action")]
    Unauthorized,
}
