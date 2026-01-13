#!/usr/bin/env node

/**
 * Reset MCP Servers Script
 * Kills all running MCP processes and optionally restarts them
 */

const { exec, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}

// Get platform-specific commands
function getKillCommand() {
  const platform = os.platform();
  if (platform === 'win32') {
    return {
      list: 'wmic process where "commandline like \'%servicenow-%mcp%\'" get processid,commandline',
      kill: (pid) => `taskkill /F /PID ${pid}`
    };
  } else {
    return {
      list: "ps aux | grep -E 'servicenow-.*-mcp' | grep -v grep",
      kill: (pid) => `kill -9 ${pid}`
    };
  }
}

// Kill all MCP processes
async function killMCPProcesses() {
  return new Promise((resolve) => {
    logStep('1/4', 'Finding running MCP processes...');
    
    const commands = getKillCommand();
    
    exec(commands.list, (error, stdout, stderr) => {
      if (error && !stderr) {
        log('No MCP processes found running.', 'green');
        resolve(0);
        return;
      }
      
      const lines = stdout.split('\n').filter(line => line.trim());
      let killed = 0;
      
      if (os.platform() === 'win32') {
        // Windows: Extract PIDs from wmic output
        lines.forEach(line => {
          const match = line.match(/(\d+)\s*$/);
          if (match) {
            const pid = match[1];
            exec(commands.kill(pid), (err) => {
              if (!err) {
                log(`  ✓ Killed process ${pid}`, 'yellow');
                killed++;
              }
            });
          }
        });
      } else {
        // Unix-like: Extract PIDs from ps output
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            const pid = parts[1];
            exec(commands.kill(pid), (err) => {
              if (!err) {
                log(`  ✓ Killed process ${pid}`, 'yellow');
                killed++;
              }
            });
          }
        });
      }
      
      setTimeout(() => {
        if (killed > 0) {
          log(`Killed ${killed} MCP processes.`, 'green');
        }
        resolve(killed);
      }, 1000);
    });
  });
}

// Clear temporary files and cache
async function clearCache() {
  logStep('2/4', 'Clearing MCP cache and temporary files...');
  
  const cacheLocations = [
    path.join(os.homedir(), '.snow-flow', 'mcp-cache'),
    path.join(os.homedir(), '.snow-flow', 'memory', '*.lock'),
    path.join(process.cwd(), '.mcp-temp'),
    path.join(process.cwd(), 'dist', 'mcp', '*.lock')
  ];
  
  let cleared = 0;
  
  cacheLocations.forEach(location => {
    try {
      if (location.includes('*')) {
        // Handle glob patterns
        const dir = path.dirname(location);
        const pattern = path.basename(location);
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          // SECURITY: Escape regex metacharacters before converting glob to regex
          const escapeRegex = (str) => str.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
          const regexPattern = new RegExp('^' + escapeRegex(pattern).replace(/\*/g, '.*') + '$');
          files.forEach(file => {
            if (regexPattern.test(file)) {
              fs.unlinkSync(path.join(dir, file));
              cleared++;
            }
          });
        }
      } else if (fs.existsSync(location)) {
        // Handle directories
        fs.rmSync(location, { recursive: true, force: true });
        cleared++;
      }
    } catch (error) {
      // Ignore errors for non-existent files
    }
  });
  
  if (cleared > 0) {
    log(`  ✓ Cleared ${cleared} cache locations`, 'green');
  } else {
    log('  ✓ No cache files found to clear', 'green');
  }
}

// Verify no processes are running
async function verifyClean() {
  return new Promise((resolve) => {
    logStep('3/4', 'Verifying all MCP processes are stopped...');
    
    const commands = getKillCommand();
    
    exec(commands.list, (error, stdout) => {
      if (error || !stdout.trim()) {
        log('  ✓ All MCP processes successfully stopped', 'green');
        resolve(true);
      } else {
        log('  ⚠ Some MCP processes may still be running', 'yellow');
        resolve(false);
      }
    });
  });
}

// Restart MCP servers if requested
async function restartServers() {
  logStep('4/4', 'Restarting MCP servers using proper MCPServerManager...');
  
  const properStarterPath = path.join(__dirname, 'start-mcp-proper.js');
  
  if (!fs.existsSync(properStarterPath)) {
    log('  ⚠ Proper MCP starter not found. Run "npm run build" first.', 'yellow');
    return;
  }
  
  log('  Starting MCP servers with singleton protection...', 'cyan');
  
  try {
    // Use the proper MCPServerManager approach
    const child = spawn('node', [properStarterPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Log startup messages
    child.stdout?.on('data', (data) => {
      log(`  ${data.toString().trim()}`, 'green');
    });
    
    child.stderr?.on('data', (data) => {
      log(`  Error: ${data.toString().trim()}`, 'red');
    });
    
    child.unref();
    
    // Give it time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log('  ✅ MCP servers started with proper management!', 'green');
    log('  💡 No more duplicate servers or memory issues!', 'cyan');
    
  } catch (error) {
    log(`  ❌ Failed to start MCP servers: ${error.message}`, 'red');
    log('  🔧 Try: npm run cleanup-mcp', 'yellow');
  }
  log('\n  To view logs, check ~/.snow-flow/logs/', 'cyan');
}

// Main execution
async function main() {
  console.log('\n' + colors.magenta + '🔄 Snow-Flow MCP Server Reset' + colors.reset + '\n');
  
  const args = process.argv.slice(2);
  const shouldRestart = args.includes('--restart') || args.includes('-r');
  
  try {
    // Kill processes
    await killMCPProcesses();
    
    // Clear cache
    await clearCache();
    
    // Verify clean
    await verifyClean();
    
    // Restart if requested
    if (shouldRestart) {
      await restartServers();
    } else {
      log('\n✅ MCP servers reset complete!', 'green');
      log('To restart servers, run: npm run reset-mcp -- --restart', 'cyan');
    }
    
  } catch (error) {
    log(`\n❌ Error resetting MCP servers: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
${colors.cyan}Snow-Flow MCP Server Reset${colors.reset}

Usage: node reset-mcp-servers.js [options]

Options:
  -r, --restart    Restart MCP servers after reset
  -h, --help       Show this help message

Examples:
  node reset-mcp-servers.js              # Reset only
  node reset-mcp-servers.js --restart    # Reset and restart
`);
  process.exit(0);
}

// Run the script
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});