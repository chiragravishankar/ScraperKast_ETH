import chalk from 'chalk';

// ── Timing ────────────────────────────────────────────────────────────────────
const sessionStart = Date.now();

function ts(): string {
  const ms = Date.now() - sessionStart;
  return chalk.gray(`+${ms.toString().padStart(5, ' ')}ms`);
}

// ── Log levels ────────────────────────────────────────────────────────────────
export const log = {
  agent(msg: string) {
    console.log(`${ts()}  ${chalk.cyan.bold('[AGENT]')} ${msg}`);
  },

  info(msg: string) {
    console.log(`${ts()}  ${chalk.blue('[INFO] ')} ${msg}`);
  },

  success(msg: string) {
    console.log(`${ts()}  ${chalk.green.bold('[✅    ]')} ${msg}`);
  },

  error(msg: string) {
    console.log(`${ts()}  ${chalk.red.bold('[❌    ]')} ${msg}`);
  },

  payment(msg: string) {
    console.log(`${ts()}  ${chalk.yellow.bold('[💳    ]')} ${msg}`);
  },

  decision(msg: string) {
    console.log(`${ts()}  ${chalk.magenta.bold('[💭    ]')} ${msg}`);
  },

  chain(msg: string) {
    console.log(`${ts()}  ${chalk.yellow('[⛓️    ]')} ${msg}`);
  },

  token(msg: string) {
    console.log(`${ts()}  ${chalk.green('[🎫    ]')} ${msg}`);
  },

  content(msg: string) {
    console.log(`${ts()}  ${chalk.cyan('[📄    ]')} ${msg}`);
  },

  section(title: string) {
    console.log('');
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  ${chalk.white.bold(title)}`);
    console.log(chalk.gray('─'.repeat(60)));
  },

  detail(key: string, value: string) {
    console.log(`            ${chalk.gray(key.padEnd(22))} ${chalk.white(value)}`);
  },

  divider() {
    console.log(chalk.gray('═'.repeat(60)));
  },

  banner() {
    console.log('');
    log.divider();
    console.log(chalk.cyan.bold('  🤖  ScraperKast Autonomous Payment Agent'));
    console.log(chalk.gray('  Proving end-to-end AI micropayment infrastructure'));
    log.divider();
    console.log('');
  },

  summary(totalMs: number, cost: number, txSig: string) {
    console.log('');
    log.divider();
    console.log(chalk.green.bold('  📊  MISSION COMPLETE'));
    log.divider();
    log.detail('Total time:',   `${totalMs}ms`);
    log.detail('Cost paid:',    `${cost} µUSDC ($${(cost / 1_000_000).toFixed(6)})`);
    log.detail('Settlement:',   'Solana devnet');
    log.detail('Tx signature:', txSig.slice(0, 24) + '…');
    log.detail('Status:',       chalk.green.bold('COMPLETED'));
    log.divider();
    console.log('');
  },
};
