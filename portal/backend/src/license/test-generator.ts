/**
 * Test License Key Generator
 * Quick script to test license key generation and validation
 */

import { generateLicenseKey, createExpiryDateFromNow, generateLegacyLicenseKey } from './generator.js';
import { parseLicenseKey } from './parser.js';

console.log('=== License Key Generator Test ===\n');

// Test 1: Generate seat-based license
console.log('Test 1: Seat-based License (10 dev, 5 stakeholder)');
const license1 = generateLicenseKey({
  tier: 'ENT',
  organization: 'Acme Corporation',
  developerSeats: 10,
  stakeholderSeats: 5,
  expiresAt: createExpiryDateFromNow(1)
});
console.log('Generated:', license1);

try {
  const parsed1 = parseLicenseKey(license1);
  console.log('✅ Valid! Parsed:', {
    tier: parsed1.tier,
    organization: parsed1.organization,
    developerSeats: parsed1.developerSeats,
    stakeholderSeats: parsed1.stakeholderSeats,
    expiresAt: parsed1.expiresAt.toISOString().split('T')[0]
  });
} catch (error: any) {
  console.log('❌ Validation failed:', error.message);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 2: Generate unlimited license
console.log('Test 2: Unlimited License (-1 seats)');
const license2 = generateLicenseKey({
  tier: 'ENT',
  organization: 'BigTech Inc',
  developerSeats: -1,
  stakeholderSeats: -1,
  expiresAt: createExpiryDateFromNow(1)
});
console.log('Generated:', license2);

try {
  const parsed2 = parseLicenseKey(license2);
  console.log('✅ Valid! Parsed:', {
    tier: parsed2.tier,
    organization: parsed2.organization,
    developerSeats: parsed2.developerSeats === -1 ? 'Unlimited' : parsed2.developerSeats,
    stakeholderSeats: parsed2.stakeholderSeats === -1 ? 'Unlimited' : parsed2.stakeholderSeats,
    expiresAt: parsed2.expiresAt.toISOString().split('T')[0]
  });
} catch (error: any) {
  console.log('❌ Validation failed:', error.message);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 3: Generate legacy license
console.log('Test 3: Legacy License (backward compatibility)');
const license3 = generateLegacyLicenseKey(
  'ENT',
  'Legacy Systems Ltd',
  createExpiryDateFromNow(2)
);
console.log('Generated:', license3);

try {
  const parsed3 = parseLicenseKey(license3);
  console.log('✅ Valid! Parsed:', {
    tier: parsed3.tier,
    organization: parsed3.organization,
    developerSeats: 'Unlimited (legacy)',
    stakeholderSeats: 'Unlimited (legacy)',
    expiresAt: parsed3.expiresAt.toISOString().split('T')[0],
    isLegacyFormat: parsed3.isLegacyFormat
  });
} catch (error: any) {
  console.log('❌ Validation failed:', error.message);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 4: Test checksum validation (tampered license)
console.log('Test 4: Tampered License (invalid checksum)');
const tamperedLicense = license1.substring(0, license1.lastIndexOf('-')) + '-INVALID00';
console.log('Tampered:', tamperedLicense);

try {
  parseLicenseKey(tamperedLicense);
  console.log('❌ Should have failed validation!');
} catch (error: any) {
  console.log('✅ Correctly rejected:', error.message);
}

console.log('\n' + '='.repeat(60) + '\n');
console.log('All tests completed!');
