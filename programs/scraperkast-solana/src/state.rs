use anchor_lang::prelude::*;

// ── Space constants ───────────────────────────────────────────────────────────
// Anchor discriminator = 8 bytes; String = 4 (len prefix) + N (content bytes).

/// Singleton PDA that stores global platform configuration and lifetime stats.
///
/// Seeds: `["platform"]`
#[account]
pub struct PlatformState {
    /// The admin authority that can update platform settings.
    pub authority: Pubkey,
    /// Wallet that collects the 5% ScraperKast platform fee.
    pub platform_wallet: Pubkey,
    /// The USDC SPL token mint address (devnet or mainnet) set at init time.
    /// All `process_payment` calls verify against this address.
    pub usdc_mint: Pubkey,
    /// Lifetime count of processed payments.
    pub total_payments_processed: u64,
    /// Lifetime sum of platform fees collected (micro-USDC).
    pub total_platform_fees_collected: u64,
    /// PDA bump seed stored for cheaper re-derivation.
    pub bump: u8,
}

impl PlatformState {
    /// Byte size of the account body (excluding 8-byte discriminator).
    ///
    /// Layout: 32 + 32 + 32 + 8 + 8 + 1 = 113
    pub const SPACE: usize = 32 + 32 + 32 + 8 + 8 + 1;
}

// ─────────────────────────────────────────────────────────────────────────────

/// One account per registered domain. Tracks earnings and request counts.
///
/// Seeds: `["website", domain.as_bytes()]`
#[account]
pub struct WebsiteAccount {
    /// Domain string stored on-chain (e.g. "example.com").
    pub domain: String,
    /// The wallet that registered this domain and receives the 95% owner cut.
    pub owner: Pubkey,
    /// Cumulative micro-USDC earned by this website.
    pub total_earned: u64,
    /// Cumulative number of paid requests served.
    pub total_requests_served: u64,
    /// Unix timestamp of registration.
    pub created_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl WebsiteAccount {
    /// Domain field: 4 (len) + 100 (max chars) = 104
    pub const MAX_DOMAIN_LEN: usize = 100;

    /// Body size: 104 + 32 + 8 + 8 + 8 + 1 = 161
    pub const SPACE: usize = (4 + Self::MAX_DOMAIN_LEN) + 32 + 8 + 8 + 8 + 1;
}

// ─────────────────────────────────────────────────────────────────────────────

/// Immutable record of a single payment. Created atomically with the transfer.
///
/// Seeds: `["payment", bot_pubkey, total_payments_processed_le_bytes]`
/// (The counter is read from PlatformState *before* incrementing, guaranteeing
/// each payment gets a unique PDA.)
#[account]
pub struct PaymentRecord {
    /// Caller-supplied bot identifier (e.g. "gptbot-123").
    pub bot_id: String,
    /// Domain that was accessed.
    pub domain: String,
    /// Micro-USDC transferred to the website owner (95% portion).
    pub base_price: u64,
    /// Micro-USDC transferred to the platform (5% portion).
    pub platform_fee: u64,
    /// base_price + platform_fee.
    pub total_price: u64,
    /// Unix timestamp of the payment.
    pub timestamp: i64,
    /// Base58-encoded transaction signature.
    /// Set to "" on creation (a transaction cannot reference its own sig);
    /// off-chain indexers derive it via `getSignaturesForAddress(payment_record)`.
    pub tx_signature: String,
    /// PDA bump seed.
    pub bump: u8,
}

impl PaymentRecord {
    pub const MAX_BOT_ID_LEN:  usize = 50;
    pub const MAX_DOMAIN_LEN:  usize = 100;
    pub const MAX_SIG_LEN:     usize = 88;

    /// Body size:
    ///   (4+50) + (4+100) + 8 + 8 + 8 + 8 + (4+88) + 1
    ///   = 54 + 104 + 8 + 8 + 8 + 8 + 92 + 1 = 283
    pub const SPACE: usize =
        (4 + Self::MAX_BOT_ID_LEN)
        + (4 + Self::MAX_DOMAIN_LEN)
        + 8   // base_price
        + 8   // platform_fee
        + 8   // total_price
        + 8   // timestamp
        + (4 + Self::MAX_SIG_LEN)
        + 1;  // bump
}
