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
    console.log(`${ts()}  ${chalk.cyan.bold('[AGENT]  ')} ${msg}`);
  },

  info(msg: string) {
    console.log(`${ts()}  ${chalk.blue('[INFO]   ')} ${msg}`);
  },

  success(msg: string) {
    console.log(`${ts()}  ${chalk.green.bold('[✅     ]')} ${msg}`);
  },

  error(msg: string) {
    console.log(`${ts()}  ${chalk.red.bold('[❌     ]')} ${msg}`);
  },

  payment(msg: string) {
    console.log(`${ts()}  ${chalk.yellow.bold('[💳     ]')} ${msg}`);
  },

  decision(msg: string) {
    console.log(`${ts()}  ${chalk.magenta.bold('[💭     ]')} ${msg}`);
  },

  keeper(msg: string) {
    console.log(`${ts()}  ${chalk.blue.bold('[🔧     ]')} ${msg}`);
  },

  chain(msg: string) {
    console.log(`${ts()}  ${chalk.yellow('[⛓️      ]')} ${msg}`);
  },

  token(msg: string) {
    console.log(`${ts()}  ${chalk.green('[🎫     ]')} ${msg}`);
  },

  content(msg: string) {
    console.log(`${ts()}  ${chalk.cyan('[📄     ]')} ${msg}`);
  },

  section(title: string) {
    console.log('');
    console.log(chalk.gray('─'.repeat(62)));
    console.log(`  ${chalk.white.bold(title)}`);
    console.log(chalk.gray('─'.repeat(62)));
  },

  detail(key: string, value: string) {
    console.log(`            ${chalk.gray(key.padEnd(22))} ${chalk.white(value)}`);
  },

  divider() {
    console.log(chalk.gray('═'.repeat(62)));
  },

  banner() {
    console.log('');
    log.divider();
    console.log(chalk.blue.bold('  🤖  ScraperKast × KeeperHub — Autonomous Payment Agent'));
    console.log(chalk.gray('  x402 payment rail · Ethereum Sepolia · ETHGlobal 2026'));
    log.divider();
    console.log('');
  },

  summary(totalMs: number, costUsdc: number, txHash: string, executionId: string) {
    console.log('');
    log.divider();
    console.log(chalk.green.bold('  📊  MISSION COMPLETE'));
    log.divider();
    log.detail('Total time:',     `${totalMs}ms`);
    log.detail('Cost paid:',      `${costUsdc} µUSDC ($${(costUsdc / 1_000_000).toFixed(6)})`);
    log.detail('Network:',        'Ethereum Sepolia');
    log.detail('Execution layer:','KeeperHub');
    log.detail('Tx hash:',        txHash.slice(0, 24) + '…');
    log.detail('Execution ID:',   executionId.slice(0, 24) + '…');
    log.detail('Status:',         chalk.green.bold('COMPLETED'));
    log.divider();
    console.log('');
  },
};
