#!/usr/bin/env node
/**
 * Test script for Codespace detection
 * Run this in both local and Codespaces environments
 */

console.log('🔍 Codespace Detection Test\n');

const relevantEnvVars = [
  'CODESPACES',
  'CODESPACE_NAME',
  'GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN',
  'GITHUB_CODESPACE_TOKEN',
  'CODESPACE_VSCODE_FOLDER',
  'GITHUB_USER',
  'REMOTE_CONTAINERS',
  'VSCODE_REMOTE_CONTAINERS_SESSION'
];

console.log('Environment Variables:');
console.log('='.repeat(60));
relevantEnvVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${varName.padEnd(40)} = ${value || '(not set)'}`);
});

console.log('\n' + '='.repeat(60));

// Current detection logic
const hasCodespacesEnv = process.env.CODESPACES === 'true';
const hasCodespaceName = !!process.env.CODESPACE_NAME;
const hasForwardingDomain = !!process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

console.log('\nDetection Results:');
console.log(`  CODESPACES === 'true'           : ${hasCodespacesEnv}`);
console.log(`  CODESPACE_NAME present          : ${hasCodespaceName}`);
console.log(`  PORT_FORWARDING_DOMAIN present  : ${hasForwardingDomain}`);

const isCodespace = hasCodespacesEnv || (hasCodespaceName && hasForwardingDomain);

console.log('\n🎯 Final Detection Result:');
console.log(`  Is Codespace? ${isCodespace ? '✅ YES' : '❌ NO'}`);

if (isCodespace && hasForwardingDomain) {
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  const name = process.env.CODESPACE_NAME;
  console.log(`\n📡 Forwarded URL would be:`);
  console.log(`  https://${name}-3005.${domain}/callback`);
}

console.log('\n');
