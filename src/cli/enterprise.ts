/**
 * Enterprise portal commands for Snow-Flow
 */

import { Command } from 'commander';
import chalk from 'chalk';

const PORTAL_URL = 'https://portal.snow-flow.dev';

/**
 * Open portal in browser
 */
async function portalCommand(): Promise<void> {
  console.log(chalk.blue('🌐 Opening Snow-Flow Enterprise Portal...'));

  try {
    // Dynamic import for ESM compatibility
    const { default: open } = await import('open');
    await open(PORTAL_URL);
    console.log(chalk.green('✅ Portal opened in your default browser'));
    console.log('');
    console.log(chalk.gray('Portal URL:'), chalk.blue(PORTAL_URL));
  } catch (err: any) {
    console.error(chalk.red('❌ Failed to open browser:'), err.message);
    console.log('');
    console.log(chalk.gray('Please open this URL manually:'), chalk.blue(PORTAL_URL));
  }
}

/**
 * Register enterprise commands with Commander
 */
export function registerEnterpriseCommands(program: Command): void {
  // Portal command - open Snow-Flow Enterprise portal in browser
  program
    .command('portal')
    .description('Open Snow-Flow Enterprise Portal (portal.snow-flow.dev)')
    .action(async () => {
      await portalCommand();
    });
}
