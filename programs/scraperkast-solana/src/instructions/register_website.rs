use anchor_lang::prelude::*;
use crate::state::WebsiteAccount;
use crate::errors::ScraperKastError;
use crate::events::WebsiteRegistered;

/// Account context for the `register_website` instruction.
///
/// Anyone can register a domain — the signer becomes the `owner` and
/// receives 95% of all future payments for that domain.
#[derive(Accounts)]
#[instruction(domain: String)]
pub struct RegisterWebsite<'info> {
    /// Per-domain website account.
    /// PDA seeds: `["website", domain.as_bytes()]`
    #[account(
        init,
        payer = owner,
        space = 8 + WebsiteAccount::SPACE,
        seeds = [b"website", domain.as_bytes()],
        bump
    )]
    pub website_account: Account<'info, WebsiteAccount>,

    /// The signer becomes the website owner.
    /// They must hold the domain they are registering (enforced socially /
    /// by the platform off-chain; on-chain the constraint is merely a signature).
    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn register_website(ctx: Context<RegisterWebsite>, domain: String) -> Result<()> {
    require!(
        !domain.is_empty() && domain.len() <= WebsiteAccount::MAX_DOMAIN_LEN,
        ScraperKastError::InvalidDomain
    );

    let clock = Clock::get()?;
    let website = &mut ctx.accounts.website_account;

    website.domain                 = domain.clone();
    website.owner                  = ctx.accounts.owner.key();
    website.total_earned           = 0;
    website.total_requests_served  = 0;
    website.created_at             = clock.unix_timestamp;
    website.bump                   = ctx.bumps.website_account;

    emit!(WebsiteRegistered {
        domain:    domain.clone(),
        owner:     website.owner,
        timestamp: clock.unix_timestamp,
    });

    msg!("Website registered: {} owned by {}", domain, website.owner);

    Ok(())
}
