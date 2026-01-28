import { Command } from 'commander';
import chalk from 'chalk';
import { listSessions, readSession } from '../session/store.js';

export function registerSessionCommands(program: Command) {
  const sess = program.command('session').description('Manage and inspect Snow-Flow sessions');

  sess
    .command('list')
    .description('List recent sessions')
    .action(() => {
      const rows = listSessions().slice(0, 30);
      if (!rows.length) return console.log('No sessions yet.');
      for (const r of rows) {
        console.log(`${chalk.gray(r.startedAt)}  ${chalk.cyan(r.id)}  ${r.objective}`);
      }
    });

  sess
    .command('show <id>')
    .description('Show session details')
    .action((id) => {
      const rec = readSession(id);
      if (!rec) return console.error(chalk.red('Session not found.'));
      console.log(chalk.cyan(`Session ${rec.id}`));
      console.log(`${chalk.gray(rec.startedAt)} → ${chalk.gray(rec.endedAt ?? '…')}`);
      console.log('Objective:', rec.objective);
      console.log('Provider:', `${rec.provider.id} ${rec.provider.model}`);
      console.log('MCP:', `${rec.mcp.cmd} ${(rec.mcp.args||[]).join(' ')}`);
      console.log('\nMessages:');
      for (const m of rec.messages) {
        console.log(`- ${chalk.yellow(m.role)} ${chalk.gray(m.timestamp)}\n  ${m.content.slice(0, 400)}${m.content.length>400?'…':''}`);
      }
      if (rec.toolEvents?.length) {
        console.log('\nTool events:');
        for (const ev of rec.toolEvents) {
          console.log(`  🔧 ${ev.name} ${chalk.gray(ev.when)} ${ev.argsPreview?('args:'+ev.argsPreview):''} ${ev.resultPreview?('res:'+ev.resultPreview):''}`);
        }
      }
    });
}

