use anchor_lang::prelude::*;

/// Emitted once when the PlatformState account is created.
#[event]
pub struct PlatformInitialized {
    pub authority:       Pubkey,
    pub platform_wallet: Pubkey,
    pub usdc_mint:       Pubkey,
    pub timestamp:       i64,
}

/// Emitted each time a new domain is registered.
#[event]
pub struct WebsiteRegistered {
    pub domain:    String,
    pub owner:     Pubkey,
    pub timestamp: i64,
}

/// Emitted for every successful payment — the primary event for off-chain indexing.
#[event]
pub struct PaymentProcessed {
    pub bot_id:          String,
    pub domain:          String,
    /// Micro-USDC sent to the website owner.
    pub base_price:      u64,
    /// Micro-USDC sent to the platform.
    pub platform_fee:    u64,
    /// base_price + platform_fee.
    pub total_price:     u64,
    pub owner:           Pubkey,
    pub platform_wallet: Pubkey,
    pub timestamp:       i64,
}

/// Emitted when the platform fee wallet is changed.
#[event]
pub struct PlatformWalletUpdated {
    pub old_wallet: Pubkey,
    pub new_wallet: Pubkey,
    pub timestamp:  i64,
}
