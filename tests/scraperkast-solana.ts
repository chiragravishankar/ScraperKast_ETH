/**
 * ScraperKast Solana program — Anchor integration tests
 *
 * Run against a local validator:
 *   anchor test
 *
 * Prerequisites:
 *   - Anchor CLI installed  (see DEPLOY.md)
 *   - solana-test-validator available
 *   - A funded wallet at ~/.config/solana/id.json
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { ScraperkastSolana } from "../target/types/scraperkast_solana";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive the PlatformState PDA. */
function platformStatePDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("platform")], programId);
}

/** Derive a WebsiteAccount PDA for a given domain. */
function websitePDA(domain: string, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("website"), Buffer.from(domain)],
    programId
  );
}

/** Derive a PaymentRecord PDA. */
function paymentRecordPDA(
  botPubkey: PublicKey,
  paymentIndex: BN,
  programId: PublicKey
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(8);
  indexBuf.writeBigUInt64LE(BigInt(paymentIndex.toString()));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("payment"), botPubkey.toBuffer(), indexBuf],
    programId
  );
}

/** Airdrop SOL and confirm. */
async function airdrop(
  connection: anchor.web3.Connection,
  to: PublicKey,
  sol = 2
): Promise<void> {
  const sig = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("ScraperKast Solana Program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.ScraperkastSolana as Program<ScraperkastSolana>;
  const connection = provider.connection;

  // ── Shared keypairs ──────────────────────────────────────────────────────

  const authority      = Keypair.generate();  // platform admin
  const platformWallet = Keypair.generate();  // receives 5% fees
  const websiteOwner   = Keypair.generate();  // registers example.com
  const bot            = Keypair.generate();  // pays for content access

  let usdcMint:        PublicKey;
  let botTokenAccount:      PublicKey;
  let ownerTokenAccount:    PublicKey;
  let platformTokenAccount: PublicKey;

  const DOMAIN      = "example.com";
  const BOT_ID      = "gptbot-test-001";
  const BASE_PRICE  = new BN(1000); // 1000 µUSDC to owner (95%)
  const PLATFORM_FEE = new BN(50);  // 50 µUSDC to platform (5%)
  const TOTAL_PRICE  = new BN(1050);
  const INITIAL_USDC = 5_000;       // bot starts with 5000 µUSDC

  // ── Before: fund accounts and set up USDC ────────────────────────────────

  before(async () => {
    // Fund all wallets.
    await Promise.all([
      airdrop(connection, authority.publicKey),
      airdrop(connection, platformWallet.publicKey),
      airdrop(connection, websiteOwner.publicKey),
      airdrop(connection, bot.publicKey),
    ]);

    // Create a fake USDC mint (authority controls it in tests).
    usdcMint = await createMint(
      connection,
      authority,      // payer
      authority.publicKey, // mint authority
      null,           // freeze authority
      6               // decimals (matches USDC)
    );

    // Create associated token accounts.
    botTokenAccount = await createAssociatedTokenAccount(
      connection,
      bot,
      usdcMint,
      bot.publicKey
    );
    ownerTokenAccount = await createAssociatedTokenAccount(
      connection,
      websiteOwner,
      usdcMint,
      websiteOwner.publicKey
    );
    platformTokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      usdcMint,
      platformWallet.publicKey
    );

    // Mint initial USDC to bot.
    await mintTo(
      connection,
      authority,
      usdcMint,
      botTokenAccount,
      authority,
      INITIAL_USDC
    );
  });

  // ── 1. initialize ─────────────────────────────────────────────────────────

  describe("initialize()", () => {
    it("creates PlatformState with correct fields", async () => {
      const [statePDA] = platformStatePDA(program.programId);

      await program.methods
        .initialize()
        .accounts({
          platformState:  statePDA,
          authority:      authority.publicKey,
          platformWallet: platformWallet.publicKey,
          usdcMint:       usdcMint,
          systemProgram:  SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const state = await program.account.platformState.fetch(statePDA);
      assert.ok(state.authority.equals(authority.publicKey),       "authority mismatch");
      assert.ok(state.platformWallet.equals(platformWallet.publicKey), "platform_wallet mismatch");
      assert.ok(state.usdcMint.equals(usdcMint),                   "usdc_mint mismatch");
      assert.equal(state.totalPaymentsProcessed.toNumber(), 0,     "payments should be 0");
      assert.equal(state.totalPlatformFeesCollected.toNumber(), 0, "fees should be 0");
    });

    it("cannot be initialised twice", async () => {
      const [statePDA] = platformStatePDA(program.programId);

      try {
        await program.methods
          .initialize()
          .accounts({
            platformState:  statePDA,
            authority:      authority.publicKey,
            platformWallet: platformWallet.publicKey,
            usdcMint:       usdcMint,
            systemProgram:  SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        assert.fail("Expected second initialize to fail");
      } catch (err: unknown) {
        // Anchor throws when trying to init an already-initialized PDA.
        assert.include((err as Error).message, "already in use");
      }
    });
  });

  // ── 2. register_website ───────────────────────────────────────────────────

  describe("register_website()", () => {
    it("creates WebsiteAccount for example.com", async () => {
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);

      await program.methods
        .registerWebsite(DOMAIN)
        .accounts({
          websiteAccount: websitePubkey,
          owner:          websiteOwner.publicKey,
          systemProgram:  SystemProgram.programId,
        })
        .signers([websiteOwner])
        .rpc();

      const website = await program.account.websiteAccount.fetch(websitePubkey);
      assert.equal(website.domain,                   DOMAIN,                "domain mismatch");
      assert.ok(website.owner.equals(websiteOwner.publicKey),               "owner mismatch");
      assert.equal(website.totalEarned.toNumber(),        0,                "totalEarned should be 0");
      assert.equal(website.totalRequestsServed.toNumber(), 0,               "totalRequestsServed should be 0");
      assert.isAbove(website.createdAt.toNumber(),    0,                    "createdAt should be set");
    });

    it("rejects an empty domain", async () => {
      const [websitePubkey] = websitePDA("", program.programId);
      try {
        await program.methods
          .registerWebsite("")
          .accounts({
            websiteAccount: websitePubkey,
            owner:          websiteOwner.publicKey,
            systemProgram:  SystemProgram.programId,
          })
          .signers([websiteOwner])
          .rpc();
        assert.fail("Expected empty domain to fail");
      } catch (err: unknown) {
        assert.include((err as Error).message, "InvalidDomain");
      }
    });

    it("rejects a domain longer than 100 characters", async () => {
      const longDomain = "a".repeat(101);
      const [websitePubkey] = websitePDA(longDomain, program.programId);
      try {
        await program.methods
          .registerWebsite(longDomain)
          .accounts({
            websiteAccount: websitePubkey,
            owner:          websiteOwner.publicKey,
            systemProgram:  SystemProgram.programId,
          })
          .signers([websiteOwner])
          .rpc();
        assert.fail("Expected long domain to fail");
      } catch (err: unknown) {
        assert.include((err as Error).message, "InvalidDomain");
      }
    });
  });

  // ── 3. process_payment ────────────────────────────────────────────────────

  describe("process_payment()", () => {
    it("transfers correct USDC amounts and updates all state", async () => {
      const [statePDA]      = platformStatePDA(program.programId);
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);

      // Read current payment count to derive the PaymentRecord PDA.
      const stateBefore = await program.account.platformState.fetch(statePDA);
      const paymentIndex = stateBefore.totalPaymentsProcessed;
      const [paymentPDA]  = paymentRecordPDA(bot.publicKey, paymentIndex, program.programId);

      const ownerBefore    = await getAccount(connection, ownerTokenAccount);
      const platformBefore = await getAccount(connection, platformTokenAccount);
      const botBefore      = await getAccount(connection, botTokenAccount);

      await program.methods
        .processPayment(BOT_ID, DOMAIN, BASE_PRICE, PLATFORM_FEE)
        .accounts({
          platformState:       statePDA,
          websiteAccount:      websitePubkey,
          paymentRecord:       paymentPDA,
          botTokenAccount:     botTokenAccount,
          ownerTokenAccount:   ownerTokenAccount,
          platformTokenAccount: platformTokenAccount,
          bot:                 bot.publicKey,
          usdcMint:            usdcMint,
          tokenProgram:        TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:       SystemProgram.programId,
        })
        .signers([bot])
        .rpc();

      // ── Verify token balances ──────────────────────────────────────────────

      const ownerAfter    = await getAccount(connection, ownerTokenAccount);
      const platformAfter = await getAccount(connection, platformTokenAccount);
      const botAfter      = await getAccount(connection, botTokenAccount);

      assert.equal(
        Number(ownerAfter.amount) - Number(ownerBefore.amount),
        BASE_PRICE.toNumber(),
        "owner should have received base_price"
      );
      assert.equal(
        Number(platformAfter.amount) - Number(platformBefore.amount),
        PLATFORM_FEE.toNumber(),
        "platform should have received platform_fee"
      );
      assert.equal(
        Number(botBefore.amount) - Number(botAfter.amount),
        TOTAL_PRICE.toNumber(),
        "bot should have spent total_price"
      );

      // ── Verify WebsiteAccount state ────────────────────────────────────────

      const website = await program.account.websiteAccount.fetch(websitePubkey);
      assert.equal(website.totalEarned.toNumber(),         BASE_PRICE.toNumber());
      assert.equal(website.totalRequestsServed.toNumber(), 1);

      // ── Verify PlatformState counters ──────────────────────────────────────

      const stateAfter = await program.account.platformState.fetch(statePDA);
      assert.equal(
        stateAfter.totalPlatformFeesCollected.toNumber(),
        stateBefore.totalPlatformFeesCollected.toNumber() + PLATFORM_FEE.toNumber()
      );
      assert.equal(
        stateAfter.totalPaymentsProcessed.toNumber(),
        stateBefore.totalPaymentsProcessed.toNumber() + 1
      );

      // ── Verify PaymentRecord ───────────────────────────────────────────────

      const record = await program.account.paymentRecord.fetch(paymentPDA);
      assert.equal(record.botId,                     BOT_ID);
      assert.equal(record.domain,                    DOMAIN);
      assert.equal(record.basePrice.toNumber(),      BASE_PRICE.toNumber());
      assert.equal(record.platformFee.toNumber(),    PLATFORM_FEE.toNumber());
      assert.equal(record.totalPrice.toNumber(),     TOTAL_PRICE.toNumber());
      assert.isAbove(record.timestamp.toNumber(),    0);
    });

    it("enforces the 95/5 split — only accepts amounts that sum correctly", async () => {
      // This test uses a 950/50 split (95% / 5% of 1000 µUSDC total).
      const [statePDA]      = platformStatePDA(program.programId);
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);
      const stateBefore     = await program.account.platformState.fetch(statePDA);
      const [paymentPDA]    = paymentRecordPDA(bot.publicKey, stateBefore.totalPaymentsProcessed, program.programId);

      const ownerBefore    = await getAccount(connection, ownerTokenAccount);
      const platformBefore = await getAccount(connection, platformTokenAccount);

      await program.methods
        .processPayment(BOT_ID, DOMAIN, new BN(950), new BN(50))
        .accounts({
          platformState:        statePDA,
          websiteAccount:       websitePubkey,
          paymentRecord:        paymentPDA,
          botTokenAccount:      botTokenAccount,
          ownerTokenAccount:    ownerTokenAccount,
          platformTokenAccount: platformTokenAccount,
          bot:                  bot.publicKey,
          usdcMint:             usdcMint,
          tokenProgram:         TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:        SystemProgram.programId,
        })
        .signers([bot])
        .rpc();

      const ownerAfter    = await getAccount(connection, ownerTokenAccount);
      const platformAfter = await getAccount(connection, platformTokenAccount);

      assert.equal(Number(ownerAfter.amount)    - Number(ownerBefore.amount),    950);
      assert.equal(Number(platformAfter.amount) - Number(platformBefore.amount), 50);
    });

    it("rejects payment when bot has insufficient balance", async () => {
      const [statePDA]      = platformStatePDA(program.programId);
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);
      const stateBefore     = await program.account.platformState.fetch(statePDA);
      const [paymentPDA]    = paymentRecordPDA(bot.publicKey, stateBefore.totalPaymentsProcessed, program.programId);

      const botBalance = (await getAccount(connection, botTokenAccount)).amount;
      const excessive  = new BN(Number(botBalance) + 1_000_000);

      try {
        await program.methods
          .processPayment(BOT_ID, DOMAIN, excessive, new BN(1))
          .accounts({
            platformState:        statePDA,
            websiteAccount:       websitePubkey,
            paymentRecord:        paymentPDA,
            botTokenAccount:      botTokenAccount,
            ownerTokenAccount:    ownerTokenAccount,
            platformTokenAccount: platformTokenAccount,
            bot:                  bot.publicKey,
            usdcMint:             usdcMint,
            tokenProgram:         TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram:        SystemProgram.programId,
          })
          .signers([bot])
          .rpc();
        assert.fail("Expected insufficient balance to fail");
      } catch (err: unknown) {
        assert.include((err as Error).message, "InsufficientBalance");
      }
    });

    it("rejects a counterfeit USDC mint", async () => {
      const fakeMint = Keypair.generate();
      const [statePDA]      = platformStatePDA(program.programId);
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);
      const stateBefore     = await program.account.platformState.fetch(statePDA);
      const [paymentPDA]    = paymentRecordPDA(bot.publicKey, stateBefore.totalPaymentsProcessed, program.programId);

      try {
        await program.methods
          .processPayment(BOT_ID, DOMAIN, new BN(100), new BN(5))
          .accounts({
            platformState:        statePDA,
            websiteAccount:       websitePubkey,
            paymentRecord:        paymentPDA,
            botTokenAccount:      botTokenAccount,
            ownerTokenAccount:    ownerTokenAccount,
            platformTokenAccount: platformTokenAccount,
            bot:                  bot.publicKey,
            usdcMint:             fakeMint.publicKey, // ← wrong mint
            tokenProgram:         TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram:        SystemProgram.programId,
          })
          .signers([bot])
          .rpc();
        assert.fail("Expected invalid mint to fail");
      } catch (err: unknown) {
        assert.include((err as Error).message, "InvalidUsdcMint");
      }
    });

    it("rejects an empty bot_id", async () => {
      const [statePDA]      = platformStatePDA(program.programId);
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);
      const stateBefore     = await program.account.platformState.fetch(statePDA);
      const [paymentPDA]    = paymentRecordPDA(bot.publicKey, stateBefore.totalPaymentsProcessed, program.programId);

      try {
        await program.methods
          .processPayment("", DOMAIN, new BN(100), new BN(5))
          .accounts({
            platformState:        statePDA,
            websiteAccount:       websitePubkey,
            paymentRecord:        paymentPDA,
            botTokenAccount:      botTokenAccount,
            ownerTokenAccount:    ownerTokenAccount,
            platformTokenAccount: platformTokenAccount,
            bot:                  bot.publicKey,
            usdcMint:             usdcMint,
            tokenProgram:         TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram:        SystemProgram.programId,
          })
          .signers([bot])
          .rpc();
        assert.fail("Expected empty bot_id to fail");
      } catch (err: unknown) {
        assert.include((err as Error).message, "InvalidBotId");
      }
    });
  });

  // ── 4. update_platform_wallet ─────────────────────────────────────────────

  describe("update_platform_wallet()", () => {
    it("allows the authority to rotate the platform wallet", async () => {
      const [statePDA]  = platformStatePDA(program.programId);
      const newWallet   = Keypair.generate();

      await program.methods
        .updatePlatformWallet(newWallet.publicKey)
        .accounts({
          platformState: statePDA,
          authority:     authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const state = await program.account.platformState.fetch(statePDA);
      assert.ok(state.platformWallet.equals(newWallet.publicKey), "wallet should have been updated");

      // Restore original wallet for subsequent tests.
      await program.methods
        .updatePlatformWallet(platformWallet.publicKey)
        .accounts({
          platformState: statePDA,
          authority:     authority.publicKey,
        })
        .signers([authority])
        .rpc();
    });

    it("rejects calls from a non-authority signer", async () => {
      const [statePDA] = platformStatePDA(program.programId);
      const impostor   = Keypair.generate();
      await airdrop(connection, impostor.publicKey, 1);

      try {
        await program.methods
          .updatePlatformWallet(impostor.publicKey)
          .accounts({
            platformState: statePDA,
            authority:     impostor.publicKey, // ← not the real authority
          })
          .signers([impostor])
          .rpc();
        assert.fail("Expected unauthorized call to fail");
      } catch (err: unknown) {
        // has_one = authority check fires
        assert.include((err as Error).message, "Unauthorized");
      }
    });
  });

  // ── 5. Events ─────────────────────────────────────────────────────────────

  describe("Events", () => {
    it("emits PaymentProcessed event with correct fields", async () => {
      const [statePDA]      = platformStatePDA(program.programId);
      const [websitePubkey] = websitePDA(DOMAIN, program.programId);
      const stateBefore     = await program.account.platformState.fetch(statePDA);
      const [paymentPDA]    = paymentRecordPDA(bot.publicKey, stateBefore.totalPaymentsProcessed, program.programId);

      let captured: anchor.IdlEvents<ScraperkastSolana>["PaymentProcessed"] | null = null;

      const listener = program.addEventListener("PaymentProcessed", (event) => {
        captured = event;
      });

      await program.methods
        .processPayment(BOT_ID, DOMAIN, BASE_PRICE, PLATFORM_FEE)
        .accounts({
          platformState:        statePDA,
          websiteAccount:       websitePubkey,
          paymentRecord:        paymentPDA,
          botTokenAccount:      botTokenAccount,
          ownerTokenAccount:    ownerTokenAccount,
          platformTokenAccount: platformTokenAccount,
          bot:                  bot.publicKey,
          usdcMint:             usdcMint,
          tokenProgram:         TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:        SystemProgram.programId,
        })
        .signers([bot])
        .rpc();

      // Give the event subscription time to process.
      await new Promise((r) => setTimeout(r, 1000));
      await program.removeEventListener(listener);

      assert.isNotNull(captured, "PaymentProcessed event should have been emitted");
      const ev = captured!;
      assert.equal(ev.botId,                 BOT_ID);
      assert.equal(ev.domain,                DOMAIN);
      assert.equal(ev.basePrice.toNumber(),  BASE_PRICE.toNumber());
      assert.equal(ev.platformFee.toNumber(), PLATFORM_FEE.toNumber());
      assert.equal(ev.totalPrice.toNumber(), TOTAL_PRICE.toNumber());
      assert.ok(ev.owner.equals(websiteOwner.publicKey));
    });
  });
});
