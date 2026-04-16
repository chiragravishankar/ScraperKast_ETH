//! # ScraperKast Solana Program
//!
//! On-chain enforcement of the ScraperKast 95/5 payment split model.
//!
//! ## Instructions
//!
//! | Instruction             | Who can call  | What it does                                      |
//! |-------------------------|---------------|---------------------------------------------------|
//! | `initialize`            | Admin (once)  | Create `PlatformState` with authority & fee wallet|
//! | `register_website`      | Anyone        | Claim a domain; signer becomes the owner          |
//! | `process_payment`       | AI bot        | Atomic dual SPL transfer + on-chain record        |
//! | `update_platform_wallet`| Authority only| Rotate the fee-collection wallet                  |
//!
//! ## Program ID
//!
//! Replace the placeholder ID below after first `anchor deploy`:
//! ```
//! anchor keys list               # shows the newly generated ID
//! # Update declare_id!() and Anchor.toml [programs.*] section
//! ```

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

// Placeholder program ID — replace after `anchor deploy` and update Anchor.toml.
// To generate a keypair:  solana-keygen new -o target/deploy/scraperkast_solana-keypair.json
declare_id!("SKASTpayQKiLdgrUCWXFuXhHpCeJdDKjKqNRNV1234J");

#[program]
pub mod scraperkast_solana {
    use super::*;

    /// Create the singleton `PlatformState` account.
    ///
    /// Can only succeed once — Anchor's `init` constraint prevents
    /// re-initialisation of an existing PDA.
    ///
    /// # Arguments
    /// * `ctx.accounts.platform_wallet` — fee-collection wallet (5% cut)
    /// * `ctx.accounts.usdc_mint`       — USDC token mint for this network
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }

    /// Register a domain and become its on-chain owner.
    ///
    /// The signer proves custody of the domain through off-chain verification
    /// (DNS TXT record, etc.); on-chain we only enforce the signature.
    ///
    /// # Arguments
    /// * `domain` — e.g. `"example.com"` (1–100 chars)
    pub fn register_website(ctx: Context<RegisterWebsite>, domain: String) -> Result<()> {
        instructions::register_website(ctx, domain)
    }

    /// Execute a USDC payment in one atomic transaction.
    ///
    /// Transfers `base_price` → owner ATA and `platform_fee` → platform ATA,
    /// then writes an immutable `PaymentRecord` and increments all counters.
    ///
    /// # Arguments
    /// * `bot_id`       — bot identifier string (1–50 chars)
    /// * `domain`       — domain being accessed (must be registered)
    /// * `base_price`   — micro-USDC to the website owner (95%)
    /// * `platform_fee` — micro-USDC to the platform (5%)
    pub fn process_payment(
        ctx: Context<ProcessPayment>,
        bot_id: String,
        domain: String,
        base_price: u64,
        platform_fee: u64,
    ) -> Result<()> {
        instructions::process_payment(ctx, bot_id, domain, base_price, platform_fee)
    }

    /// Update the platform fee-collection wallet.
    ///
    /// Only the `authority` stored in `PlatformState` may call this.
    ///
    /// # Arguments
    /// * `new_wallet` — the replacement fee wallet `Pubkey`
    pub fn update_platform_wallet(
        ctx: Context<UpdatePlatformWallet>,
        new_wallet: Pubkey,
    ) -> Result<()> {
        instructions::update_platform_wallet(ctx, new_wallet)
    }
}
