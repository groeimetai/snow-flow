#!/usr/bin/env node
/**
 * Dynamic MCP Configuration Generator
 * Generates .mcp.json from template with absolute paths and actual environment variables
 * This ensures compatibility with Claude Code while keeping the project portable
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const projectRoot = process.cwd();
const templatePath = path.join(projectRoot, '.mcp.json.template');
const mcpFilePath = path.join(projectRoot, '.mcp.json');

// Check if template exists
if (!fs.existsSync(templatePath)) {
  console.error('❌ Error: .mcp.json.template not found!');
  console.error('   This file should be in the project root.');
  process.exit(1);
}

// Check if required environment variables are set
const requiredEnvVars = ['SNOW_INSTANCE', 'SNOW_CLIENT_ID', 'SNOW_CLIENT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  Warning: Missing environment variables:', missingVars.join(', '));
  console.warn('   MCP servers may not work without proper ServiceNow credentials.');
  console.warn('   Copy .env.example to .env and configure your ServiceNow credentials.');
}

// Read template
const template = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
const replacements = {
  '{{PROJECT_ROOT}}': projectRoot,
  '{{SNOW_INSTANCE}}': process.env.SNOW_INSTANCE || 'your-instance.service-now.com',
  '{{SNOW_CLIENT_ID}}': process.env.SNOW_CLIENT_ID || 'your-oauth-client-id',
  '{{SNOW_CLIENT_SECRET}}': process.env.SNOW_CLIENT_SECRET || 'your-oauth-client-secret',
  '{{NEO4J_URI}}': process.env.NEO4J_URI || 'bolt://localhost:7687',
  '{{NEO4J_USER}}': process.env.NEO4J_USER || 'neo4j',
  '{{NEO4J_PASSWORD}}': process.env.NEO4J_PASSWORD || 'password'
};

let mcpConfig = template;
for (const [placeholder, value] of Object.entries(replacements)) {
  mcpConfig = mcpConfig.replace(new RegExp(placeholder, 'g'), value);
}

// Write the configuration file
fs.writeFileSync(mcpFilePath, mcpConfig);

// Make all MCP server files executable
const mcpServerFiles = [
  'servicenow-deployment-mcp.js',
  'servicenow-flow-composer-mcp.js',
  'servicenow-update-set-mcp.js',
  'servicenow-intelligent-mcp.js',
  'servicenow-graph-memory-mcp.js'
];

mcpServerFiles.forEach(file => {
  const filePath = path.join(projectRoot, 'dist/mcp', file);
  if (fs.existsSync(filePath)) {
    fs.chmodSync(filePath, '755');
  }
});

console.log('✅ Generated .mcp.json with dynamic configuration');
console.log('📁 Project root:', projectRoot);
console.log('🔧 Environment variables:', requiredEnvVars.filter(v => process.env[v]).length + '/' + requiredEnvVars.length + ' configured');
console.log('🔐 Made MCP server files executable');
console.log('📝 Using node + args format for Claude Code compatibility');

if (missingVars.length === 0) {
  console.log('🎉 All ServiceNow environment variables are configured!');
  console.log('💡 MCP servers should now work properly in Claude Code');
} else {
  console.log('⚠️  Configure missing environment variables in .env file');
  console.log('📖 See .env.example for setup instructions');
}