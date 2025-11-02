# Stakeholder Seats Implementation Plan
## Snow-Flow Enterprise Server

**Version:** 1.0
**Created:** 2025-11-02
**Status:** Draft
**Priority:** P0 (Critical - Blocks Production)

---

## Executive Summary

This document provides a comprehensive implementation plan for adding stakeholder seats support to the Snow-Flow Enterprise server. The client-side implementation is complete, but the server-side infrastructure is entirely missing.

**Current State:** ❌ NOT IMPLEMENTED
**Target State:** ✅ Full seat tracking, validation, and role-based access control
**Estimated Effort:** 40-60 hours (1-1.5 weeks for 1 developer)
**Risk Level:** Medium (requires database changes + backward compatibility)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema Design](#database-schema-design)
3. [License Parser Implementation](#license-parser-implementation)
4. [JWT Payload Extension](#jwt-payload-extension)
5. [Connection Management System](#connection-management-system)
6. [Role-Based Tool Filtering](#role-based-tool-filtering)
7. [Heartbeat & Cleanup Mechanism](#heartbeat--cleanup-mechanism)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Observability](#monitoring--observability)
11. [Rollout Plan](#rollout-plan)

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Snow-Flow Client                          │
│  - Parses license format: SNOW-ENT-ORG-5/1-EXPIRY-CHECKSUM     │
│  - Sends role header: X-Snow-Flow-Role: developer               │
│  - Sends user ID: X-Snow-Flow-User-Id: <hashed-machine-id>     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS + JWT
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Enterprise Portal Backend                     │
│  1. License Parser: Parse DEV/STAKEHOLDER from license key      │
│  2. JWT Generator: Include seat info in JWT payload             │
│  3. Login API: Return seat usage statistics                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ JWT with seat info
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Enterprise MCP Server                         │
│  1. Connection Validator: Check seat limits before connect      │
│  2. Connection Tracker: Track active connections in DB          │
│  3. Tool Filter: Filter tools based on role (dev/stakeholder)   │
│  4. Heartbeat Handler: Process client heartbeats                │
│  5. Cleanup Worker: Remove stale connections                    │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MySQL Database                              │
│  - customers (extended with seat fields)                         │
│  - active_connections (NEW table)                               │
│  - connection_events (NEW table for audit)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. User Login (Portal Backend):**
```
Client → POST /api/auth/customer/login { licenseKey }
   ↓
Parse license: "SNOW-ENT-ACME-10/5-20261231-ABC"
   ↓ Extract: dev_seats=10, stakeholder_seats=5
Query DB: SELECT * FROM customers WHERE license_key = ?
   ↓ Get customer with seat limits
Calculate active seats from active_connections table
   ↓
Generate JWT with seat info
   ↓
Return: { token, customer: { seats: { developer: {total: 10, active: 3}, ... }}}
```

**2. MCP Connection (MCP Server):**
```
Client → GET /mcp/sse
   Headers: Authorization: Bearer <JWT>
           X-Snow-Flow-Role: developer
           X-Snow-Flow-User-Id: abc123...
   ↓
Verify JWT → Extract customerId, features, seat limits
   ↓
Validate seat availability:
   - Count active connections for role
   - Check if within limit
   - Check grace period for reconnections
   ↓
IF seat available:
   - Track connection in active_connections table
   - Connect SSE transport
   - Filter tools based on role
ELSE:
   - Return 429 Too Many Requests
   - Include seat usage info in error
```

**3. Heartbeat (MCP Server):**
```
Client → POST /mcp/heartbeat { userId }
   ↓
Update last_seen timestamp in active_connections
   ↓
Return: { ok: true, activeSince: timestamp }
```

**4. Cleanup (Background Worker):**
```
Every 60 seconds:
   ↓
Find connections where last_seen < (now - 2 minutes)
   ↓
Delete stale connections
   ↓
Update customer.active_developer_seats and active_stakeholder_seats
   ↓
Log cleanup metrics
```

---

## 2. Database Schema Design

### 2.1 Extended `customers` Table

**Migration: `001_add_seat_tracking_to_customers.sql`**

```sql
-- Add seat tracking columns to customers table
ALTER TABLE customers
  ADD COLUMN developer_seats INT DEFAULT -1 COMMENT 'Total developer seats (-1 = unlimited)',
  ADD COLUMN stakeholder_seats INT DEFAULT -1 COMMENT 'Total stakeholder seats (-1 = unlimited)',
  ADD COLUMN active_developer_seats INT DEFAULT 0 COMMENT 'Currently active developer connections',
  ADD COLUMN active_stakeholder_seats INT DEFAULT 0 COMMENT 'Currently active stakeholder connections',
  ADD COLUMN seat_limits_enforced BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable seat enforcement per customer';

-- Add index for seat queries
CREATE INDEX idx_customers_seats ON customers(developer_seats, stakeholder_seats);
```

**TypeScript Interface Update:**

```typescript
// portal/backend/src/database/schema.ts
export interface Customer {
  id: number;
  serviceIntegratorId: number;
  name: string;
  contactEmail: string;
  company?: string;
  licenseKey: string;
  theme?: string;
  customThemeId?: number;

  // NEW: Seat tracking fields
  developerSeats: number;           // -1 = unlimited
  stakeholderSeats: number;         // -1 = unlimited
  activeDeveloperSeats: number;     // Real-time count
  activeStakeholderSeats: number;   // Real-time count
  seatLimitsEnforced: boolean;      // Feature flag per customer

  createdAt: number;
  updatedAt: number;
  status: 'active' | 'suspended' | 'churned';
  totalApiCalls: number;
  lastApiCall?: number;
}
```

### 2.2 New `active_connections` Table

**Migration: `002_create_active_connections_table.sql`**

```sql
-- Track active MCP connections for seat management
CREATE TABLE active_connections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Identity
  customer_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL COMMENT 'Hashed machine ID from client',
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL DEFAULT 'developer',

  -- Connection metadata
  connection_id VARCHAR(128) NOT NULL COMMENT 'Unique SSE connection ID',
  ip_address VARCHAR(45) COMMENT 'Client IP address',
  user_agent VARCHAR(512) COMMENT 'Client user agent',

  -- Timing
  connected_at BIGINT NOT NULL COMMENT 'Unix timestamp (ms) when connected',
  last_seen BIGINT NOT NULL COMMENT 'Unix timestamp (ms) of last heartbeat',

  -- Session info
  jwt_token_hash VARCHAR(64) COMMENT 'SHA256 hash of JWT for correlation',

  -- Unique constraint: one connection per (customer, user_id, role)
  UNIQUE KEY unique_connection (customer_id, user_id, role),

  -- Indexes for efficient queries
  INDEX idx_customer_role (customer_id, role),
  INDEX idx_last_seen (last_seen),
  INDEX idx_connection_id (connection_id),

  -- Foreign key
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**TypeScript Interface:**

```typescript
// portal/backend/src/database/schema.ts
export interface ActiveConnection {
  id: number;
  customerId: number;
  userId: string;
  role: 'developer' | 'stakeholder' | 'admin';
  connectionId: string;
  ipAddress?: string;
  userAgent?: string;
  connectedAt: number;
  lastSeen: number;
  jwtTokenHash?: string;
}
```

### 2.3 New `connection_events` Table (Audit Trail)

**Migration: `003_create_connection_events_table.sql`**

```sql
-- Audit log for connection lifecycle events
CREATE TABLE connection_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  customer_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL,

  event_type ENUM('connect', 'disconnect', 'heartbeat', 'timeout', 'rejected') NOT NULL,
  timestamp BIGINT NOT NULL,

  -- Additional context
  ip_address VARCHAR(45),
  error_message TEXT COMMENT 'Error message if rejected',
  seat_limit INT COMMENT 'Seat limit at time of event',
  active_count INT COMMENT 'Active connections at time of event',

  -- Indexes
  INDEX idx_customer_timestamp (customer_id, timestamp),
  INDEX idx_event_type (event_type),
  INDEX idx_user_events (customer_id, user_id, timestamp),

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**TypeScript Interface:**

```typescript
export interface ConnectionEvent {
  id: number;
  customerId: number;
  userId: string;
  role: 'developer' | 'stakeholder' | 'admin';
  eventType: 'connect' | 'disconnect' | 'heartbeat' | 'timeout' | 'rejected';
  timestamp: number;
  ipAddress?: string;
  errorMessage?: string;
  seatLimit?: number;
  activeCount?: number;
}
```

---

## 3. License Parser Implementation

### 3.1 Parser Logic

**File: `portal/backend/src/license/parser.ts` (NEW FILE)**

```typescript
/**
 * License Parser for Snow-Flow Enterprise
 *
 * Supports two formats:
 * - NEW: SNOW-[TIER]-[ORG]-[DEV_SEATS]/[STAKEHOLDER_SEATS]-[EXPIRY]-[CHECKSUM]
 *   Example: SNOW-ENT-CAPGEMINI-5/1-20261231-A3F2E9C1
 *
 * - LEGACY: SNOW-[TIER]-[ORG]-[EXPIRY]-[CHECKSUM]
 *   Example: SNOW-ENT-ACME-20261231-ABC123
 */

export interface ParsedLicense {
  tier: string;                    // ENT, TEAM, PROFESSIONAL
  organization: string;            // Customer organization name
  developerSeats: number;          // Number of developer seats (-1 = unlimited)
  stakeholderSeats: number;        // Number of stakeholder seats (-1 = unlimited)
  expiresAt: Date;                 // Expiration date
  checksum: string;                // License checksum
  isLegacyFormat: boolean;         // True if old format
  originalKey: string;             // Original license key
}

export class LicenseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseParseError';
  }
}

/**
 * Parse a Snow-Flow license key
 */
export function parseLicenseKey(licenseKey: string): ParsedLicense {
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw new LicenseParseError('License key is required');
  }

  const parts = licenseKey.split('-');

  // Validate basic format: SNOW-TIER-ORG-...
  if (parts.length < 4 || parts[0] !== 'SNOW') {
    throw new LicenseParseError('Invalid license key format: must start with SNOW-');
  }

  const tier = parts[1];
  const organization = parts[2];

  // Determine format by checking if part[3] contains a slash (seats format)
  const hasSeats = parts[3].includes('/');

  if (hasSeats) {
    // New format: SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM
    return parseNewFormat(licenseKey, parts, tier, organization);
  } else {
    // Legacy format: SNOW-TIER-ORG-EXPIRY-CHECKSUM
    return parseLegacyFormat(licenseKey, parts, tier, organization);
  }
}

/**
 * Parse new seat-based format
 */
function parseNewFormat(
  originalKey: string,
  parts: string[],
  tier: string,
  organization: string
): ParsedLicense {
  if (parts.length !== 6) {
    throw new LicenseParseError(
      'Invalid new format: expected SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM'
    );
  }

  const seatsStr = parts[3];
  const expiryStr = parts[4];
  const checksum = parts[5];

  // Parse seats (e.g., "10/5")
  const seatsParts = seatsStr.split('/');
  if (seatsParts.length !== 2) {
    throw new LicenseParseError('Invalid seats format: expected DEV/STAKEHOLDER');
  }

  const developerSeats = parseInt(seatsParts[0], 10);
  const stakeholderSeats = parseInt(seatsParts[1], 10);

  if (isNaN(developerSeats) || isNaN(stakeholderSeats)) {
    throw new LicenseParseError('Invalid seats: must be numbers');
  }

  if (developerSeats < 0 || stakeholderSeats < 0) {
    throw new LicenseParseError('Invalid seats: must be non-negative');
  }

  // Special case: 0 means unlimited (represented as -1 internally)
  const finalDevSeats = developerSeats === 0 ? -1 : developerSeats;
  const finalStakeholderSeats = stakeholderSeats === 0 ? -1 : stakeholderSeats;

  // Parse expiry date (YYYYMMDD)
  const expiresAt = parseExpiryDate(expiryStr);

  return {
    tier,
    organization,
    developerSeats: finalDevSeats,
    stakeholderSeats: finalStakeholderSeats,
    expiresAt,
    checksum,
    isLegacyFormat: false,
    originalKey
  };
}

/**
 * Parse legacy unlimited format
 */
function parseLegacyFormat(
  originalKey: string,
  parts: string[],
  tier: string,
  organization: string
): ParsedLicense {
  if (parts.length !== 5) {
    throw new LicenseParseError(
      'Invalid legacy format: expected SNOW-TIER-ORG-EXPIRY-CHECKSUM'
    );
  }

  const expiryStr = parts[3];
  const checksum = parts[4];

  // Parse expiry date (YYYYMMDD)
  const expiresAt = parseExpiryDate(expiryStr);

  // Legacy licenses have unlimited seats (represented as -1)
  return {
    tier,
    organization,
    developerSeats: -1,
    stakeholderSeats: -1,
    expiresAt,
    checksum,
    isLegacyFormat: true,
    originalKey
  };
}

/**
 * Parse expiry date from YYYYMMDD format
 */
function parseExpiryDate(expiryStr: string): Date {
  if (!/^\d{8}$/.test(expiryStr)) {
    throw new LicenseParseError('Invalid expiry date format: expected YYYYMMDD');
  }

  const year = parseInt(expiryStr.substring(0, 4), 10);
  const month = parseInt(expiryStr.substring(4, 6), 10);
  const day = parseInt(expiryStr.substring(6, 8), 10);

  if (year < 2020 || year > 2100) {
    throw new LicenseParseError('Invalid year in expiry date');
  }

  if (month < 1 || month > 12) {
    throw new LicenseParseError('Invalid month in expiry date');
  }

  if (day < 1 || day > 31) {
    throw new LicenseParseError('Invalid day in expiry date');
  }

  // Create date at end of day (23:59:59) for expiry
  const date = new Date(year, month - 1, day, 23, 59, 59);

  if (isNaN(date.getTime())) {
    throw new LicenseParseError('Invalid expiry date');
  }

  return date;
}

/**
 * Check if license is expired
 */
export function isLicenseExpired(parsedLicense: ParsedLicense): boolean {
  return parsedLicense.expiresAt < new Date();
}

/**
 * Get days until expiry
 */
export function getDaysUntilExpiry(parsedLicense: ParsedLicense): number {
  const now = new Date();
  const diff = parsedLicense.expiresAt.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format seats for display
 */
export function formatSeats(seats: number): string {
  if (seats === -1) {
    return 'Unlimited';
  }
  return seats.toString();
}
```

### 3.2 Integration with Database

**File: `portal/backend/src/database/schema.ts` - Add methods**

```typescript
/**
 * Update customer with parsed license seats
 */
async updateCustomerSeats(
  customerId: number,
  developerSeats: number,
  stakeholderSeats: number
): Promise<void> {
  await this.pool.execute(
    `UPDATE customers
     SET developer_seats = ?,
         stakeholder_seats = ?,
         updated_at = ?
     WHERE id = ?`,
    [developerSeats, stakeholderSeats, Date.now(), customerId]
  );
}

/**
 * Get customer with seat information
 */
async getCustomerWithSeats(customerId: number): Promise<Customer & {
  availableDeveloperSeats: number;
  availableStakeholderSeats: number;
} | undefined> {
  const [rows] = await this.pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [customerId]
  );

  const rowsArray = rows as any[];
  if (rowsArray.length === 0) return undefined;

  const customer = toCamelCase(rowsArray[0]) as Customer;

  // Calculate available seats
  const availableDeveloperSeats = customer.developerSeats === -1
    ? -1
    : Math.max(0, customer.developerSeats - customer.activeDeveloperSeats);

  const availableStakeholderSeats = customer.stakeholderSeats === -1
    ? -1
    : Math.max(0, customer.stakeholderSeats - customer.activeStakeholderSeats);

  return {
    ...customer,
    availableDeveloperSeats,
    availableStakeholderSeats
  };
}
```

### 3.3 Testing

**File: `portal/backend/src/license/parser.test.ts`**

```typescript
import { parseLicenseKey, LicenseParseError, formatSeats } from './parser';

describe('License Parser', () => {
  describe('New Format (Seat-Based)', () => {
    it('should parse valid new format license', () => {
      const license = parseLicenseKey('SNOW-ENT-CAPGEMINI-5/1-20261231-A3F2E9C1');

      expect(license.tier).toBe('ENT');
      expect(license.organization).toBe('CAPGEMINI');
      expect(license.developerSeats).toBe(5);
      expect(license.stakeholderSeats).toBe(1);
      expect(license.expiresAt.getFullYear()).toBe(2026);
      expect(license.checksum).toBe('A3F2E9C1');
      expect(license.isLegacyFormat).toBe(false);
    });

    it('should parse unlimited seats (0/0 → -1/-1)', () => {
      const license = parseLicenseKey('SNOW-ENT-ACME-0/0-20261231-ABC123');

      expect(license.developerSeats).toBe(-1);
      expect(license.stakeholderSeats).toBe(-1);
    });

    it('should handle asymmetric seats', () => {
      const license = parseLicenseKey('SNOW-TEAM-ACME-10/5-20261231-XYZ');

      expect(license.developerSeats).toBe(10);
      expect(license.stakeholderSeats).toBe(5);
    });

    it('should reject invalid seat format', () => {
      expect(() => {
        parseLicenseKey('SNOW-ENT-ACME-5-20261231-ABC');
      }).toThrow(LicenseParseError);
    });

    it('should reject non-numeric seats', () => {
      expect(() => {
        parseLicenseKey('SNOW-ENT-ACME-five/one-20261231-ABC');
      }).toThrow('Invalid seats: must be numbers');
    });
  });

  describe('Legacy Format (Unlimited)', () => {
    it('should parse valid legacy format', () => {
      const license = parseLicenseKey('SNOW-ENT-ACME-20261231-ABC123');

      expect(license.tier).toBe('ENT');
      expect(license.organization).toBe('ACME');
      expect(license.developerSeats).toBe(-1);
      expect(license.stakeholderSeats).toBe(-1);
      expect(license.isLegacyFormat).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty license key', () => {
      expect(() => parseLicenseKey('')).toThrow();
    });

    it('should reject invalid prefix', () => {
      expect(() => parseLicenseKey('FAKE-ENT-ACME-20261231-ABC')).toThrow();
    });

    it('should reject negative seats', () => {
      expect(() => parseLicenseKey('SNOW-ENT-ACME--5/1-20261231-ABC')).toThrow();
    });
  });

  describe('Utility Functions', () => {
    it('should format unlimited seats', () => {
      expect(formatSeats(-1)).toBe('Unlimited');
    });

    it('should format numeric seats', () => {
      expect(formatSeats(10)).toBe('10');
    });
  });
});
```

---

## 4. JWT Payload Extension

### 4.1 Extended JWT Structure

**File: `portal/backend/src/routes/auth.ts` - Update interfaces**

```typescript
export interface CustomerSessionPayload {
  type: 'customer';
  customerId: number;
  licenseKey: string;

  // NEW: License & seat information
  company: string;
  tier: string;
  features: string[];

  // NEW: Seat limits
  developerSeats: number;        // -1 = unlimited
  stakeholderSeats: number;      // -1 = unlimited
  activeDeveloperSeats: number;  // Real-time count
  activeStakeholderSeats: number; // Real-time count
  seatLimitsEnforced: boolean;   // Feature flag

  // NEW: User role (for multi-role scenarios)
  role?: 'developer' | 'stakeholder' | 'admin';

  // Standard JWT fields
  iat: number;
  exp: number;
}
```

### 4.2 Updated Login Flow

**File: `portal/backend/src/routes/auth.ts` - Update `/customer/login`**

```typescript
router.post('/customer/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      res.status(400).json({ error: 'License key is required' });
      return;
    }

    // Find customer by license key
    const customer = await db.getCustomer(licenseKey);
    if (!customer) {
      res.status(401).json({ error: 'Invalid license key' });
      return;
    }

    // Check customer status
    if (customer.status === 'suspended') {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    if (customer.status === 'churned') {
      res.status(403).json({ error: 'Account is no longer active' });
      return;
    }

    // NEW: Parse license to extract seats
    let parsedLicense: ParsedLicense | null = null;
    try {
      parsedLicense = parseLicenseKey(licenseKey);

      // Check if license is expired
      if (isLicenseExpired(parsedLicense)) {
        res.status(403).json({
          error: 'License expired',
          expiresAt: parsedLicense.expiresAt.toISOString()
        });
        return;
      }

      // Update customer with parsed seat information (if changed)
      if (customer.developerSeats !== parsedLicense.developerSeats ||
          customer.stakeholderSeats !== parsedLicense.stakeholderSeats) {
        await db.updateCustomerSeats(
          customer.id,
          parsedLicense.developerSeats,
          parsedLicense.stakeholderSeats
        );

        // Update in-memory customer object
        customer.developerSeats = parsedLicense.developerSeats;
        customer.stakeholderSeats = parsedLicense.stakeholderSeats;
      }
    } catch (error) {
      logger.error('License parse error:', error);
      // Continue with defaults if parse fails (legacy support)
      parsedLicense = null;
    }

    // NEW: Get real-time seat usage from active_connections
    const activeDevSeats = await db.getActiveConnectionCount(customer.id, 'developer');
    const activeStakeholderSeats = await db.getActiveConnectionCount(customer.id, 'stakeholder');

    // Update active seat counts in customer table (eventual consistency)
    await db.updateActiveSeats(customer.id, activeDevSeats, activeStakeholderSeats);

    // NEW: Determine features from tier
    const features = determineFeaturesFromTier(customer.tier || parsedLicense?.tier || 'TEAM');

    // Generate JWT token with extended payload
    const tokenPayload: CustomerSessionPayload = {
      type: 'customer',
      customerId: customer.id,
      licenseKey: customer.licenseKey,

      // NEW: License info
      company: customer.company || customer.name,
      tier: parsedLicense?.tier || 'TEAM',
      features,

      // NEW: Seat information
      developerSeats: customer.developerSeats,
      stakeholderSeats: customer.stakeholderSeats,
      activeDeveloperSeats: activeDevSeats,
      activeStakeholderSeats: activeStakeholderSeats,
      seatLimitsEnforced: customer.seatLimitsEnforced !== false,

      // Standard fields added by jwt.sign()
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // Fetch custom theme if assigned
    let customTheme = null;
    if (customer.customThemeId) {
      const theme = await db.getSITheme(customer.customThemeId);
      if (theme && theme.isActive) {
        customTheme = {
          themeName: theme.themeName,
          displayName: theme.displayName,
          themeConfig: theme.themeConfig,
          primaryColor: theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          accentColor: theme.accentColor,
        };
      }
    }

    // NEW: Calculate seat usage details
    const seatUsage = {
      developer: {
        total: customer.developerSeats,
        totalFormatted: formatSeats(customer.developerSeats),
        active: activeDevSeats,
        available: customer.developerSeats === -1
          ? -1
          : Math.max(0, customer.developerSeats - activeDevSeats),
        usagePercent: customer.developerSeats === -1
          ? 0
          : Math.round((activeDevSeats / customer.developerSeats) * 100)
      },
      stakeholder: {
        total: customer.stakeholderSeats,
        totalFormatted: formatSeats(customer.stakeholderSeats),
        active: activeStakeholderSeats,
        available: customer.stakeholderSeats === -1
          ? -1
          : Math.max(0, customer.stakeholderSeats - activeStakeholderSeats),
        usagePercent: customer.stakeholderSeats === -1
          ? 0
          : Math.round((activeStakeholderSeats / customer.stakeholderSeats) * 100)
      }
    };

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        contactEmail: customer.contactEmail,
        company: customer.company,
        licenseKey: customer.licenseKey,
        tier: parsedLicense?.tier,
        theme: customer.theme,
        customTheme: customTheme,
        status: customer.status,
        totalApiCalls: customer.totalApiCalls,
        createdAt: customer.createdAt,

        // NEW: Seat usage information
        seats: seatUsage,
        seatLimitsEnforced: customer.seatLimitsEnforced,

        // NEW: License expiry warning
        licenseExpiry: parsedLicense ? {
          expiresAt: parsedLicense.expiresAt.toISOString(),
          daysUntilExpiry: getDaysUntilExpiry(parsedLicense),
          isExpired: isLicenseExpired(parsedLicense)
        } : null
      },
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Determine features from license tier
 */
function determineFeaturesFromTier(tier: string): string[] {
  const tierUpper = tier.toUpperCase();

  const baseFeatures = ['core'];

  if (tierUpper === 'TEAM') {
    return [...baseFeatures, 'jira'];
  }

  if (tierUpper === 'PROFESSIONAL' || tierUpper === 'PRO') {
    return [...baseFeatures, 'jira', 'azure-devops'];
  }

  if (tierUpper === 'ENTERPRISE' || tierUpper === 'ENT') {
    return [...baseFeatures, 'jira', 'azure-devops', 'confluence', 'sso', 'ml'];
  }

  return baseFeatures;
}
```

---

## 5. Connection Management System

### 5.1 Connection Tracking Methods

**File: `portal/backend/src/database/schema.ts` - Add to LicenseDatabase class**

```typescript
// ===== CONNECTION TRACKING METHODS =====

/**
 * Track new active connection
 */
async trackConnection(
  customerId: number,
  userId: string,
  role: 'developer' | 'stakeholder' | 'admin',
  connectionId: string,
  ipAddress?: string,
  userAgent?: string,
  jwtTokenHash?: string
): Promise<ActiveConnection> {
  const now = Date.now();

  // UPSERT: Insert or update last_seen if already exists
  await this.pool.execute(
    `INSERT INTO active_connections (
      customer_id, user_id, role, connection_id, ip_address, user_agent,
      jwt_token_hash, connected_at, last_seen
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      connection_id = VALUES(connection_id),
      last_seen = VALUES(last_seen),
      ip_address = VALUES(ip_address),
      user_agent = VALUES(user_agent)`,
    [customerId, userId, role, connectionId, ipAddress, userAgent, jwtTokenHash, now, now]
  );

  // Log connection event
  await this.logConnectionEvent(customerId, userId, role, 'connect', ipAddress);

  // Fetch and return the connection
  const [rows] = await this.pool.execute(
    'SELECT * FROM active_connections WHERE customer_id = ? AND user_id = ? AND role = ?',
    [customerId, userId, role]
  );

  return toCamelCase((rows as any[])[0]) as ActiveConnection;
}

/**
 * Update connection heartbeat
 */
async updateConnectionHeartbeat(
  customerId: number,
  userId: string,
  role: 'developer' | 'stakeholder' | 'admin'
): Promise<boolean> {
  const [result] = await this.pool.execute(
    'UPDATE active_connections SET last_seen = ? WHERE customer_id = ? AND user_id = ? AND role = ?',
    [Date.now(), customerId, userId, role]
  );

  return (result as any).affectedRows > 0;
}

/**
 * Remove connection (disconnect)
 */
async removeConnection(
  customerId: number,
  userId: string,
  role: 'developer' | 'stakeholder' | 'admin'
): Promise<void> {
  await this.pool.execute(
    'DELETE FROM active_connections WHERE customer_id = ? AND user_id = ? AND role = ?',
    [customerId, userId, role]
  );

  // Log disconnect event
  await this.logConnectionEvent(customerId, userId, role, 'disconnect');
}

/**
 * Get active connection count for customer by role
 */
async getActiveConnectionCount(
  customerId: number,
  role: 'developer' | 'stakeholder' | 'admin'
): Promise<number> {
  const [rows] = await this.pool.execute(
    'SELECT COUNT(*) as count FROM active_connections WHERE customer_id = ? AND role = ?',
    [customerId, role]
  );

  return ((rows as any[])[0]).count;
}

/**
 * Get recent connection (for grace period check)
 */
async getRecentConnection(
  customerId: number,
  userId: string,
  gracePeriodMs: number
): Promise<ActiveConnection | null> {
  const cutoff = Date.now() - gracePeriodMs;

  const [rows] = await this.pool.execute(
    `SELECT * FROM active_connections
     WHERE customer_id = ? AND user_id = ? AND last_seen > ?
     LIMIT 1`,
    [customerId, userId, cutoff]
  );

  if ((rows as any[]).length === 0) return null;

  return toCamelCase((rows as any[])[0]) as ActiveConnection;
}

/**
 * Clean up stale connections (no heartbeat for 2+ minutes)
 */
async cleanupStaleConnections(timeoutMs: number = 2 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - timeoutMs;

  // Get stale connections before deleting (for logging)
  const [staleRows] = await this.pool.execute(
    'SELECT customer_id, user_id, role FROM active_connections WHERE last_seen < ?',
    [cutoff]
  );

  const staleConnections = staleRows as any[];

  // Delete stale connections
  const [result] = await this.pool.execute(
    'DELETE FROM active_connections WHERE last_seen < ?',
    [cutoff]
  );

  const deletedCount = (result as any).affectedRows;

  // Log timeout events
  for (const conn of staleConnections) {
    await this.logConnectionEvent(
      conn.customer_id,
      conn.user_id,
      conn.role,
      'timeout'
    );
  }

  return deletedCount;
}

/**
 * Update customer active seat counts (called after connection changes)
 */
async updateActiveSeats(
  customerId: number,
  activeDeveloperSeats: number,
  activeStakeholderSeats: number
): Promise<void> {
  await this.pool.execute(
    `UPDATE customers
     SET active_developer_seats = ?,
         active_stakeholder_seats = ?,
         updated_at = ?
     WHERE id = ?`,
    [activeDeveloperSeats, activeStakeholderSeats, Date.now(), customerId]
  );
}

/**
 * Recalculate and update active seats for customer
 */
async recalculateActiveSeats(customerId: number): Promise<void> {
  const devCount = await this.getActiveConnectionCount(customerId, 'developer');
  const stakeholderCount = await this.getActiveConnectionCount(customerId, 'stakeholder');

  await this.updateActiveSeats(customerId, devCount, stakeholderCount);
}

/**
 * Log connection event for audit trail
 */
async logConnectionEvent(
  customerId: number,
  userId: string,
  role: 'developer' | 'stakeholder' | 'admin',
  eventType: ConnectionEvent['eventType'],
  ipAddress?: string,
  errorMessage?: string,
  seatLimit?: number,
  activeCount?: number
): Promise<void> {
  await this.pool.execute(
    `INSERT INTO connection_events (
      customer_id, user_id, role, event_type, timestamp,
      ip_address, error_message, seat_limit, active_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      userId,
      role,
      eventType,
      Date.now(),
      ipAddress || null,
      errorMessage || null,
      seatLimit || null,
      activeCount || null
    ]
  );
}

/**
 * Get connection events for customer (for monitoring/debugging)
 */
async getConnectionEvents(
  customerId: number,
  limit: number = 100
): Promise<ConnectionEvent[]> {
  const [rows] = await this.pool.execute(
    `SELECT * FROM connection_events
     WHERE customer_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [customerId, limit]
  );

  return (rows as any[]).map(row => toCamelCase(row) as ConnectionEvent);
}
```

### 5.2 MCP Server Connection Handler

**File: `mcp-server/src/index.ts` - Update SSE endpoint**

```typescript
import crypto from 'crypto';

// Grace period for reconnections (5 minutes)
const GRACE_PERIOD_MS = 5 * 60 * 1000;

// SSE endpoint for MCP - WITH SEAT VALIDATION
app.get('/mcp/sse', async (req: Request, res: Response) => {
  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;
  const roleHeader = req.headers['x-snow-flow-role'] as string | undefined;
  const userIdHeader = req.headers['x-snow-flow-user-id'] as string | undefined;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const role = (roleHeader || 'developer') as 'developer' | 'stakeholder' | 'admin';
  const userId = userIdHeader || generateFallbackUserId(req);

  try {
    // Verify JWT
    const jwtPayload: CustomerSessionPayload = jwt.verify(token, JWT_SECRET) as CustomerSessionPayload;

    logger.info('MCP connection attempt:', {
      customerId: jwtPayload.customerId,
      company: jwtPayload.company,
      role,
      userId: userId.substring(0, 8) + '...',
      ip: req.ip
    });

    // NEW: Validate seat availability
    const seatValidation = await validateSeatAvailability(
      jwtPayload,
      role,
      userId,
      req.ip
    );

    if (!seatValidation.allowed) {
      logger.warn('Connection rejected - seat limit reached:', seatValidation);

      res.status(429).json({
        error: 'Seat limit reached',
        message: seatValidation.message,
        seatInfo: {
          role,
          limit: seatValidation.limit,
          active: seatValidation.activeCount,
          available: seatValidation.available
        }
      });
      return;
    }

    // Generate unique connection ID
    const connectionId = crypto.randomUUID();

    // Create JWT token hash for correlation
    const jwtHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

    // NEW: Track connection in database
    await db.trackConnection(
      jwtPayload.customerId,
      userId,
      role,
      connectionId,
      req.ip,
      req.headers['user-agent'],
      jwtHash
    );

    logger.info('MCP client connected:', {
      customerId: jwtPayload.customerId,
      role,
      connectionId,
      seatUsage: `${seatValidation.activeCount + 1}/${seatValidation.limit === -1 ? '∞' : seatValidation.limit}`
    });

    // Store JWT payload and connection metadata in server context
    (mcpServer as any)._clientJwt = jwtPayload;
    (mcpServer as any)._connectionId = connectionId;
    (mcpServer as any)._userId = userId;
    (mcpServer as any)._role = role;

    // Create SSE transport
    const transport = new SSEServerTransport('/mcp/messages', res);

    // Handle disconnect
    req.on('close', async () => {
      logger.info('MCP client disconnected:', { connectionId, customerId: jwtPayload.customerId });

      try {
        await db.removeConnection(jwtPayload.customerId, userId, role);
        await db.recalculateActiveSeats(jwtPayload.customerId);
      } catch (error) {
        logger.error('Error removing connection:', error);
      }
    });

    // Connect MCP server to transport
    await mcpServer.connect(transport);

    logger.info('MCP transport connected successfully');
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logger.error('JWT verification failed:', error.message);
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      logger.error('MCP connection error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Validate if customer has available seats for this role
 */
async function validateSeatAvailability(
  jwtPayload: CustomerSessionPayload,
  role: 'developer' | 'stakeholder' | 'admin',
  userId: string,
  ipAddress?: string
): Promise<{
  allowed: boolean;
  message?: string;
  limit: number;
  activeCount: number;
  available: number;
}> {
  // Admins always allowed
  if (role === 'admin') {
    return {
      allowed: true,
      limit: -1,
      activeCount: 0,
      available: -1
    };
  }

  // Check if seat enforcement is disabled for this customer
  if (!jwtPayload.seatLimitsEnforced) {
    return {
      allowed: true,
      limit: -1,
      activeCount: 0,
      available: -1
    };
  }

  // Get seat limit from JWT payload
  const seatLimit = role === 'developer'
    ? jwtPayload.developerSeats
    : jwtPayload.stakeholderSeats;

  // Unlimited seats
  if (seatLimit === -1) {
    return {
      allowed: true,
      limit: -1,
      activeCount: 0,
      available: -1
    };
  }

  // Get current active connections
  const activeCount = await db.getActiveConnectionCount(jwtPayload.customerId, role);

  // Check if limit reached
  if (activeCount >= seatLimit) {
    // Check grace period for reconnections (same user within 5 minutes)
    const recentConnection = await db.getRecentConnection(
      jwtPayload.customerId,
      userId,
      GRACE_PERIOD_MS
    );

    if (recentConnection) {
      logger.info('Connection allowed via grace period:', {
        customerId: jwtPayload.customerId,
        userId: userId.substring(0, 8) + '...',
        lastSeen: new Date(recentConnection.lastSeen).toISOString()
      });

      return {
        allowed: true,
        limit: seatLimit,
        activeCount,
        available: 0,
        message: 'Reconnection allowed (grace period)'
      };
    }

    // Limit reached, no grace period
    await db.logConnectionEvent(
      jwtPayload.customerId,
      userId,
      role,
      'rejected',
      ipAddress,
      'Seat limit reached',
      seatLimit,
      activeCount
    );

    return {
      allowed: false,
      message: `${role === 'developer' ? 'Developer' : 'Stakeholder'} seat limit reached. ` +
               `Your license allows ${seatLimit} concurrent ${role} connections. ` +
               `Currently ${activeCount} are active. ` +
               `Please wait for an existing connection to disconnect or upgrade your license.`,
      limit: seatLimit,
      activeCount,
      available: 0
    };
  }

  // Seats available
  return {
    allowed: true,
    limit: seatLimit,
    activeCount,
    available: seatLimit - activeCount
  };
}

/**
 * Generate fallback user ID if client doesn't provide one
 */
function generateFallbackUserId(req: Request): string {
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  return crypto
    .createHash('sha256')
    .update(`${ip}-${userAgent}-${Date.now()}`)
    .digest('hex')
    .substring(0, 32);
}
```

---

## 6. Role-Based Tool Filtering

### 6.1 Tool Metadata Extension

**File: `mcp-server/src/index.ts` - Update tool registry**

```typescript
// Tool registry with role-based access control
interface EnterpriseToolDefinition {
  name: string;
  handler: Function;
  feature: string;
  description: string;
  // NEW: Access control
  readOnly: boolean;           // True if tool only reads data
  category: string;            // 'business-intelligence' | 'development' | 'admin'
  minRole: 'stakeholder' | 'developer' | 'admin';  // Minimum role required
}

const ENTERPRISE_TOOLS: EnterpriseToolDefinition[] = [
  // Jira tools - mostly read-only for stakeholders
  {
    name: 'jira_get_issue',
    handler: jiraGetIssue,
    feature: 'jira',
    description: 'Get Jira issue by key',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'  // Stakeholders can view issues
  },
  {
    name: 'jira_search_issues',
    handler: jiraSearchIssues,
    feature: 'jira',
    description: 'Search Jira issues with JQL',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'  // Stakeholders can search
  },
  {
    name: 'jira_get_project',
    handler: jiraGetProject,
    feature: 'jira',
    description: 'Get Jira project details',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'  // Stakeholders can view projects
  },
  {
    name: 'jira_create_issue',
    handler: jiraCreateIssue,
    feature: 'jira',
    description: 'Create new Jira issue',
    readOnly: false,
    category: 'development',
    minRole: 'developer'  // Only developers can create
  },
  {
    name: 'jira_update_issue',
    handler: jiraUpdateIssue,
    feature: 'jira',
    description: 'Update existing Jira issue',
    readOnly: false,
    category: 'development',
    minRole: 'developer'  // Only developers can update
  },
  {
    name: 'jira_transition_issue',
    handler: jiraTransitionIssue,
    feature: 'jira',
    description: 'Transition Jira issue status',
    readOnly: false,
    category: 'development',
    minRole: 'developer'  // Only developers can transition
  },
  {
    name: 'jira_sync_backlog_advanced',
    handler: jiraSyncBacklog,
    feature: 'jira',
    description: 'Bidirectional Jira backlog sync with AI parsing',
    readOnly: false,
    category: 'development',
    minRole: 'developer'  // Only developers can sync
  },
  {
    name: 'jira_link_issues',
    handler: jiraLinkIssues,
    feature: 'jira',
    description: 'Link two Jira issues',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },

  // Azure DevOps tools
  {
    name: 'azure_get_work_item',
    handler: azdoGetWorkItem,
    feature: 'azure-devops',
    description: 'Get Azure DevOps work item by ID',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'azure_get_pipeline_runs',
    handler: azdoGetPipelineRuns,
    feature: 'azure-devops',
    description: 'Get Azure pipeline run history',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'azure_get_pull_requests',
    handler: azdoGetPullRequests,
    feature: 'azure-devops',
    description: 'Get Azure DevOps pull requests',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'azure_get_releases',
    handler: azdoGetReleases,
    feature: 'azure-devops',
    description: 'Get Azure DevOps releases',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'azure_create_work_item',
    handler: azdoCreateWorkItem,
    feature: 'azure-devops',
    description: 'Create new Azure DevOps work item',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'azure_update_work_item',
    handler: azdoUpdateWorkItem,
    feature: 'azure-devops',
    description: 'Update Azure DevOps work item',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'azure_trigger_pipeline',
    handler: azdoTriggerPipeline,
    feature: 'azure-devops',
    description: 'Trigger Azure pipeline run',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'azure_create_pull_request',
    handler: azdoCreatePullRequest,
    feature: 'azure-devops',
    description: 'Create Azure DevOps pull request',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'azure_create_release',
    handler: azdoCreateRelease,
    feature: 'azure-devops',
    description: 'Create Azure DevOps release',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'azure_sync_work_items',
    handler: azdoSyncWorkItems,
    feature: 'azure-devops',
    description: 'Sync Azure DevOps work items to ServiceNow',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },

  // Confluence tools
  {
    name: 'confluence_get_page',
    handler: confluenceGetPage,
    feature: 'confluence',
    description: 'Get Confluence page by ID',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'confluence_search_content',
    handler: confluenceSearchContent,
    feature: 'confluence',
    description: 'Search Confluence content',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'confluence_get_space',
    handler: confluenceGetSpace,
    feature: 'confluence',
    description: 'Get Confluence space details',
    readOnly: true,
    category: 'business-intelligence',
    minRole: 'stakeholder'
  },
  {
    name: 'confluence_create_page',
    handler: confluenceCreatePage,
    feature: 'confluence',
    description: 'Create new Confluence page',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'confluence_update_page',
    handler: confluenceUpdatePage,
    feature: 'confluence',
    description: 'Update Confluence page',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'confluence_create_space',
    handler: confluenceCreateSpace,
    feature: 'confluence',
    description: 'Create new Confluence space',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'confluence_link_pages',
    handler: confluenceLinkPages,
    feature: 'confluence',
    description: 'Link Confluence pages',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  },
  {
    name: 'confluence_sync_pages',
    handler: confluenceSyncPages,
    feature: 'confluence',
    description: 'Sync Confluence pages to ServiceNow knowledge base',
    readOnly: false,
    category: 'development',
    minRole: 'developer'
  }
];
```

### 6.2 Role-Based Filtering Logic

**File: `mcp-server/src/index.ts` - Update ListTools handler**

```typescript
// Register MCP tools with role-based filtering
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // Get client JWT payload from server context
  const jwtPayload = (mcpServer as any)._clientJwt as CustomerSessionPayload | undefined;
  const userRole = (mcpServer as any)._role as 'developer' | 'stakeholder' | 'admin' | undefined;

  if (!jwtPayload || !jwtPayload.features) {
    return { tools: [] };
  }

  // Determine effective role
  const effectiveRole = userRole || jwtPayload.role || 'developer';

  logger.info('Listing tools for role:', {
    customerId: jwtPayload.customerId,
    role: effectiveRole,
    features: jwtPayload.features
  });

  // Filter tools based on:
  // 1. License features (jira, azure-devops, confluence, etc.)
  // 2. User role (stakeholder can only access read-only BI tools)
  const availableTools = ENTERPRISE_TOOLS
    .filter(tool => {
      // Check feature access
      if (!jwtPayload.features.includes(tool.feature)) {
        return false;
      }

      // Check role access
      const roleHierarchy = { 'stakeholder': 1, 'developer': 2, 'admin': 3 };
      const userLevel = roleHierarchy[effectiveRole];
      const minLevel = roleHierarchy[tool.minRole];

      if (userLevel < minLevel) {
        return false;
      }

      return true;
    })
    .map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: (tool.handler as any).inputSchema || {
        type: 'object',
        properties: {},
        required: []
      },
      // Include metadata for client-side UX
      metadata: {
        readOnly: tool.readOnly,
        category: tool.category,
        minRole: tool.minRole
      }
    }));

  logger.info('Tools filtered:', {
    total: ENTERPRISE_TOOLS.length,
    available: availableTools.length,
    role: effectiveRole
  });

  return { tools: availableTools };
});
```

### 6.3 Call Tool Validation

**File: `mcp-server/src/index.ts` - Update CallTool handler**

```typescript
// Handle tool calls with role validation
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`Tool '${name}' called without required arguments`);
  }

  // Get client context
  const jwtPayload = (mcpServer as any)._clientJwt as CustomerSessionPayload;
  const userRole = (mcpServer as any)._role as 'developer' | 'stakeholder' | 'admin';

  if (!jwtPayload) {
    throw new Error('Unauthorized: No JWT token');
  }

  // Find tool
  const tool = ENTERPRISE_TOOLS.find(t => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Check feature access
  if (!jwtPayload.features.includes(tool.feature)) {
    throw new Error(`Tool '${name}' requires feature: ${tool.feature}`);
  }

  // NEW: Check role access
  const effectiveRole = userRole || jwtPayload.role || 'developer';
  const roleHierarchy = { 'stakeholder': 1, 'developer': 2, 'admin': 3 };
  const userLevel = roleHierarchy[effectiveRole];
  const minLevel = roleHierarchy[tool.minRole];

  if (userLevel < minLevel) {
    throw new Error(
      `Tool '${name}' requires ${tool.minRole} role. Your role: ${effectiveRole}`
    );
  }

  try {
    // Fetch credentials from database
    const credentials = await credsDb.getCredentials(jwtPayload.customerId, tool.feature);

    if (!credentials) {
      throw new Error(`No credentials configured for ${tool.feature}. Please configure in portal.`);
    }

    // Get customer info for context
    const customer = await db.getCustomerById(jwtPayload.customerId);

    if (!customer) {
      throw new Error(`Customer ${jwtPayload.customerId} not found`);
    }

    // Execute tool
    const toolCredentials: any = {
      [tool.feature]: credentials
    };

    const result = await tool.handler(args as any, customer, toolCredentials);

    // Log successful tool call
    logger.info('Tool executed successfully:', {
      tool: name,
      customerId: jwtPayload.customerId,
      role: effectiveRole,
      readOnly: tool.readOnly
    });

    return result;
  } catch (error: any) {
    logger.error(`Tool '${name}' execution failed:`, error);
    throw error;
  }
});
```

---

## 7. Heartbeat & Cleanup Mechanism

### 7.1 Heartbeat Endpoint

**File: `mcp-server/src/index.ts` - Add heartbeat endpoint**

```typescript
/**
 * Heartbeat endpoint - clients send heartbeat every 30 seconds
 */
app.post('/mcp/heartbeat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const userIdHeader = req.headers['x-snow-flow-user-id'] as string | undefined;
    const roleHeader = req.headers['x-snow-flow-role'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    const userId = userIdHeader || generateFallbackUserId(req);
    const role = (roleHeader || 'developer') as 'developer' | 'stakeholder' | 'admin';

    // Verify JWT
    const jwtPayload: CustomerSessionPayload = jwt.verify(token, JWT_SECRET) as CustomerSessionPayload;

    // Update heartbeat in database
    const updated = await db.updateConnectionHeartbeat(
      jwtPayload.customerId,
      userId,
      role
    );

    if (!updated) {
      // Connection not found - might have been cleaned up
      res.status(404).json({
        error: 'Connection not found',
        message: 'Your connection may have timed out. Please reconnect.'
      });
      return;
    }

    res.json({
      ok: true,
      timestamp: Date.now()
    });
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      logger.error('Heartbeat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

### 7.2 Cleanup Worker

**File: `mcp-server/src/workers/connection-cleanup.ts` (NEW FILE)**

```typescript
/**
 * Connection Cleanup Worker
 *
 * Periodically removes stale connections (no heartbeat for 2+ minutes)
 * and updates customer active seat counts.
 */

import winston from 'winston';
import { LicenseDatabase } from '../database/schema.js';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Cleanup interval: every 60 seconds
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Timeout: connections with no heartbeat for 2+ minutes are stale
const CONNECTION_TIMEOUT_MS = 2 * 60 * 1000;

export class ConnectionCleanupWorker {
  private db: LicenseDatabase;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(db: LicenseDatabase) {
    this.db = db;
  }

  /**
   * Start the cleanup worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Cleanup worker already running');
      return;
    }

    this.isRunning = true;

    logger.info('Starting connection cleanup worker', {
      interval: `${CLEANUP_INTERVAL_MS / 1000}s`,
      timeout: `${CONNECTION_TIMEOUT_MS / 1000}s`
    });

    // Run immediately on start
    this.runCleanup();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the cleanup worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Connection cleanup worker stopped');
  }

  /**
   * Run cleanup cycle
   */
  private async runCleanup(): Promise<void> {
    try {
      const startTime = Date.now();

      // Step 1: Clean up stale connections
      const deletedCount = await this.db.cleanupStaleConnections(CONNECTION_TIMEOUT_MS);

      // Step 2: Recalculate active seats for affected customers
      if (deletedCount > 0) {
        logger.info('Cleaned up stale connections', { count: deletedCount });

        // Get all customers with active connections
        const [rows] = await this.db.pool.execute(
          'SELECT DISTINCT customer_id FROM active_connections'
        );

        const customerIds = (rows as any[]).map(r => r.customer_id);

        // Recalculate seats for each customer
        for (const customerId of customerIds) {
          await this.db.recalculateActiveSeats(customerId);
        }

        logger.info('Recalculated active seats', { customers: customerIds.length });
      }

      const duration = Date.now() - startTime;

      logger.debug('Cleanup cycle completed', {
        duration: `${duration}ms`,
        deletedConnections: deletedCount
      });
    } catch (error) {
      logger.error('Cleanup cycle failed:', error);
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { running: boolean; interval: number; timeout: number } {
    return {
      running: this.isRunning,
      interval: CLEANUP_INTERVAL_MS,
      timeout: CONNECTION_TIMEOUT_MS
    };
  }
}

/**
 * Export singleton instance
 */
export let cleanupWorker: ConnectionCleanupWorker | null = null;

export function initializeCleanupWorker(db: LicenseDatabase): void {
  if (cleanupWorker) {
    logger.warn('Cleanup worker already initialized');
    return;
  }

  cleanupWorker = new ConnectionCleanupWorker(db);
  cleanupWorker.start();
}

export function stopCleanupWorker(): void {
  if (cleanupWorker) {
    cleanupWorker.stop();
    cleanupWorker = null;
  }
}
```

### 7.3 Integrate Worker in MCP Server

**File: `mcp-server/src/index.ts` - Update startServer()**

```typescript
import { initializeCleanupWorker, stopCleanupWorker } from './workers/connection-cleanup.js';

// Start server
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || '8080');

    // Initialize database
    logger.info('🔌 Connecting to database...');

    db = new LicenseDatabase();
    await db.initialize();
    logger.info('✅ License database connected');

    // Initialize credentials database
    credsDb = new CredentialsDatabase();
    await credsDb.initialize();
    logger.info('✅ Credentials database connected');

    // NEW: Initialize connection cleanup worker
    initializeCleanupWorker(db);
    logger.info('✅ Connection cleanup worker started');

    // Start HTTP server
    app.listen(port, '0.0.0.0', () => {
      logger.info('');
      logger.info('╔════════════════════════════════════════════════════════╗');
      logger.info('║  Snow-Flow Enterprise MCP Server                       ║');
      logger.info('║  Version: 2.0.0                                        ║');
      logger.info('║                                                        ║');
      logger.info(`║  🌐 Server: http://0.0.0.0:${port}                      ║`);
      logger.info('║  🔌 SSE Endpoint: GET /mcp/sse                         ║');
      logger.info('║  📨 Messages: POST /mcp/messages                       ║');
      logger.info('║  💓 Heartbeat: POST /mcp/heartbeat                     ║');
      logger.info('║  ❤️  Health: GET /health                                ║');
      logger.info('║                                                        ║');
      logger.info(`║  🛠️  Tools: ${ENTERPRISE_TOOLS.length} enterprise tools                    ║`);
      logger.info('║  🧹 Cleanup: Active (60s interval)                     ║');
      logger.info('║  🪑 Seats: Tracking enabled                            ║');
      logger.info('╚════════════════════════════════════════════════════════╝');
      logger.info('');
    });
  } catch (error) {
    logger.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  stopCleanupWorker();  // NEW
  if (db) await db.close();
  if (credsDb) await credsDb.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  stopCleanupWorker();  // NEW
  if (db) await db.close();
  if (credsDb) await credsDb.close();
  process.exit(0);
});
```

---

## 8. Migration Strategy

### 8.1 Database Migrations

**Create migration files:**

```bash
mkdir -p portal/backend/src/migrations
```

**File: `portal/backend/src/migrations/001_add_seat_tracking_to_customers.sql`**

```sql
-- Migration: Add seat tracking to customers table
-- Version: 1.0.0
-- Date: 2025-11-02

ALTER TABLE customers
  ADD COLUMN developer_seats INT DEFAULT -1 COMMENT 'Total developer seats (-1 = unlimited)',
  ADD COLUMN stakeholder_seats INT DEFAULT -1 COMMENT 'Total stakeholder seats (-1 = unlimited)',
  ADD COLUMN active_developer_seats INT DEFAULT 0 COMMENT 'Currently active developer connections',
  ADD COLUMN active_stakeholder_seats INT DEFAULT 0 COMMENT 'Currently active stakeholder connections',
  ADD COLUMN seat_limits_enforced BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable seat enforcement per customer';

-- Add index for performance
CREATE INDEX idx_customers_seats ON customers(developer_seats, stakeholder_seats);

-- Backfill: Set all existing customers to unlimited seats (legacy behavior)
UPDATE customers SET
  developer_seats = -1,
  stakeholder_seats = -1,
  active_developer_seats = 0,
  active_stakeholder_seats = 0,
  seat_limits_enforced = TRUE
WHERE developer_seats IS NULL;
```

**File: `portal/backend/src/migrations/002_create_active_connections_table.sql`**

```sql
-- Migration: Create active_connections table
-- Version: 1.0.0
-- Date: 2025-11-02

CREATE TABLE active_connections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  customer_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL COMMENT 'Hashed machine ID from client',
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL DEFAULT 'developer',

  connection_id VARCHAR(128) NOT NULL COMMENT 'Unique SSE connection ID',
  ip_address VARCHAR(45) COMMENT 'Client IP address',
  user_agent VARCHAR(512) COMMENT 'Client user agent',

  connected_at BIGINT NOT NULL COMMENT 'Unix timestamp (ms) when connected',
  last_seen BIGINT NOT NULL COMMENT 'Unix timestamp (ms) of last heartbeat',

  jwt_token_hash VARCHAR(64) COMMENT 'SHA256 hash of JWT for correlation',

  -- Unique constraint: one connection per (customer, user_id, role)
  UNIQUE KEY unique_connection (customer_id, user_id, role),

  INDEX idx_customer_role (customer_id, role),
  INDEX idx_last_seen (last_seen),
  INDEX idx_connection_id (connection_id),

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**File: `portal/backend/src/migrations/003_create_connection_events_table.sql`**

```sql
-- Migration: Create connection_events table for audit trail
-- Version: 1.0.0
-- Date: 2025-11-02

CREATE TABLE connection_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  customer_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL,

  event_type ENUM('connect', 'disconnect', 'heartbeat', 'timeout', 'rejected') NOT NULL,
  timestamp BIGINT NOT NULL,

  ip_address VARCHAR(45),
  error_message TEXT COMMENT 'Error message if rejected',
  seat_limit INT COMMENT 'Seat limit at time of event',
  active_count INT COMMENT 'Active connections at time of event',

  INDEX idx_customer_timestamp (customer_id, timestamp),
  INDEX idx_event_type (event_type),
  INDEX idx_user_events (customer_id, user_id, timestamp),

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.2 Migration Runner

**File: `portal/backend/src/migrations/runner.ts` - Update to run seat migrations**

Add to existing migration runner:

```typescript
import fs from 'fs';
import path from 'path';
import { LicenseDatabase } from '../database/schema.js';

export async function runMigrations(db: LicenseDatabase): Promise<void> {
  const migrationsDir = path.join(__dirname, '.');

  const migrationFiles = [
    '001_add_seat_tracking_to_customers.sql',
    '002_create_active_connections_table.sql',
    '003_create_connection_events_table.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);

    if (!fs.existsSync(filePath)) {
      console.warn(`Migration file not found: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await db.pool.execute(statement);
        console.log(`✅ Executed: ${file} - ${statement.substring(0, 50)}...`);
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⏭️  Skipped (already exists): ${file}`);
        } else {
          console.error(`❌ Migration failed: ${file}`, error);
          throw error;
        }
      }
    }
  }

  console.log('✅ All migrations completed');
}
```

### 8.3 Rollback Plan

**File: `portal/backend/src/migrations/rollback/001_rollback_seat_tracking.sql`**

```sql
-- Rollback: Remove seat tracking from customers
ALTER TABLE customers
  DROP COLUMN developer_seats,
  DROP COLUMN stakeholder_seats,
  DROP COLUMN active_developer_seats,
  DROP COLUMN active_stakeholder_seats,
  DROP COLUMN seat_limits_enforced;

DROP INDEX idx_customers_seats ON customers;

-- Drop tables
DROP TABLE IF EXISTS connection_events;
DROP TABLE IF EXISTS active_connections;
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**File: `portal/backend/src/database/schema.test.ts`**

```typescript
import { LicenseDatabase } from './schema';

describe('Connection Tracking', () => {
  let db: LicenseDatabase;
  const testCustomerId = 1;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    db = new LicenseDatabase();
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.pool.execute('DELETE FROM active_connections WHERE customer_id = ?', [testCustomerId]);
  });

  test('should track new connection', async () => {
    const connection = await db.trackConnection(
      testCustomerId,
      testUserId,
      'developer',
      'conn-123',
      '127.0.0.1',
      'Test Agent'
    );

    expect(connection.customerId).toBe(testCustomerId);
    expect(connection.userId).toBe(testUserId);
    expect(connection.role).toBe('developer');
  });

  test('should update heartbeat', async () => {
    await db.trackConnection(testCustomerId, testUserId, 'developer', 'conn-123');

    const updated = await db.updateConnectionHeartbeat(testCustomerId, testUserId, 'developer');

    expect(updated).toBe(true);
  });

  test('should count active connections', async () => {
    await db.trackConnection(testCustomerId, 'user-1', 'developer', 'conn-1');
    await db.trackConnection(testCustomerId, 'user-2', 'developer', 'conn-2');

    const count = await db.getActiveConnectionCount(testCustomerId, 'developer');

    expect(count).toBe(2);
  });

  test('should cleanup stale connections', async () => {
    // Create connection with old last_seen
    await db.pool.execute(
      `INSERT INTO active_connections (customer_id, user_id, role, connection_id, connected_at, last_seen)
       VALUES (?, ?, 'developer', 'conn-old', ?, ?)`,
      [testCustomerId, testUserId, Date.now(), Date.now() - 5 * 60 * 1000]  // 5 minutes ago
    );

    const deleted = await db.cleanupStaleConnections(2 * 60 * 1000);  // 2 minute timeout

    expect(deleted).toBeGreaterThan(0);
  });

  test('should enforce seat limits', async () => {
    // Set customer to 2 developer seats
    await db.updateCustomerSeats(testCustomerId, 2, 1);

    // Create 2 connections
    await db.trackConnection(testCustomerId, 'user-1', 'developer', 'conn-1');
    await db.trackConnection(testCustomerId, 'user-2', 'developer', 'conn-2');

    const count = await db.getActiveConnectionCount(testCustomerId, 'developer');
    expect(count).toBe(2);

    // Try to create 3rd connection
    await db.trackConnection(testCustomerId, 'user-3', 'developer', 'conn-3');

    // Should now be 3 (enforcement happens at MCP server level)
    const newCount = await db.getActiveConnectionCount(testCustomerId, 'developer');
    expect(newCount).toBe(3);
  });

  test('should allow grace period reconnection', async () => {
    const recentConnection = await db.trackConnection(
      testCustomerId,
      testUserId,
      'developer',
      'conn-123'
    );

    // Check grace period (should find recent connection)
    const found = await db.getRecentConnection(testCustomerId, testUserId, 5 * 60 * 1000);

    expect(found).toBeDefined();
    expect(found?.userId).toBe(testUserId);
  });
});
```

### 9.2 Integration Tests

**File: `mcp-server/src/integration.test.ts`**

```typescript
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, db } from './index';

describe('Seat Management Integration', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const testCustomerId = 999;
  const testLicenseKey = 'SNOW-ENT-TEST-2/1-20261231-TEST123';

  beforeAll(async () => {
    // Setup test customer with 2 dev seats, 1 stakeholder seat
    await db.pool.execute(
      `INSERT INTO customers (id, service_integrator_id, name, contact_email, license_key,
                              developer_seats, stakeholder_seats, status, created_at, updated_at, total_api_calls)
       VALUES (?, 1, 'Test Customer', 'test@example.com', ?, 2, 1, 'active', ?, ?, 0)
       ON DUPLICATE KEY UPDATE developer_seats = 2, stakeholder_seats = 1`,
      [testCustomerId, testLicenseKey, Date.now(), Date.now()]
    );
  });

  afterAll(async () => {
    // Cleanup
    await db.pool.execute('DELETE FROM customers WHERE id = ?', [testCustomerId]);
    await db.close();
  });

  test('should allow connection within seat limit', async () => {
    const token = jwt.sign({
      type: 'customer',
      customerId: testCustomerId,
      licenseKey: testLicenseKey,
      developerSeats: 2,
      stakeholderSeats: 1,
      seatLimitsEnforced: true,
      features: ['jira']
    }, JWT_SECRET);

    const response = await request(app)
      .get('/mcp/sse')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Snow-Flow-Role', 'developer')
      .set('X-Snow-Flow-User-Id', 'test-user-1');

    // SSE connection should start (status 200)
    expect(response.status).toBe(200);
  });

  test('should reject connection when seat limit reached', async () => {
    const token = jwt.sign({
      type: 'customer',
      customerId: testCustomerId,
      developerSeats: 2,
      seatLimitsEnforced: true,
      features: ['jira']
    }, JWT_SECRET);

    // Create 2 connections (max limit)
    await db.trackConnection(testCustomerId, 'user-1', 'developer', 'conn-1');
    await db.trackConnection(testCustomerId, 'user-2', 'developer', 'conn-2');

    // Try 3rd connection
    const response = await request(app)
      .get('/mcp/sse')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Snow-Flow-Role', 'developer')
      .set('X-Snow-Flow-User-Id', 'user-3');

    expect(response.status).toBe(429);
    expect(response.body.error).toBe('Seat limit reached');
  });

  test('should filter tools based on role', async () => {
    const devToken = jwt.sign({
      type: 'customer',
      customerId: testCustomerId,
      role: 'developer',
      features: ['jira']
    }, JWT_SECRET);

    const stakeholderToken = jwt.sign({
      type: 'customer',
      customerId: testCustomerId,
      role: 'stakeholder',
      features: ['jira']
    }, JWT_SECRET);

    // Developer should see all jira tools
    // Stakeholder should only see read-only tools
    // (Would need to mock MCP server.listTools() response)
  });
});
```

### 9.3 End-to-End Tests

**File: `e2e/seat-management.test.ts`**

```typescript
/**
 * E2E Test: Seat Management
 *
 * Tests the complete flow from login to MCP connection with seat validation
 */

describe('E2E: Seat Management', () => {
  test('Full flow: Login → Connect → Heartbeat → Disconnect', async () => {
    // 1. Login
    const loginResponse = await fetch('http://localhost:3000/api/auth/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: 'SNOW-ENT-TEST-5/1-20261231-ABC' })
    });

    expect(loginResponse.status).toBe(200);
    const { token, customer } = await loginResponse.json();

    expect(customer.seats.developer.total).toBe(5);
    expect(customer.seats.stakeholder.total).toBe(1);

    // 2. Connect to MCP
    const sseResponse = await fetch('http://localhost:8080/mcp/sse', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Snow-Flow-Role': 'developer',
        'X-Snow-Flow-User-Id': 'e2e-test-user'
      }
    });

    expect(sseResponse.status).toBe(200);

    // 3. Send heartbeat
    const heartbeatResponse = await fetch('http://localhost:8080/mcp/heartbeat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Snow-Flow-Role': 'developer',
        'X-Snow-Flow-User-Id': 'e2e-test-user'
      }
    });

    expect(heartbeatResponse.status).toBe(200);

    // 4. Disconnect (close SSE connection)
    // ... would close the SSE stream here
  });
});
```

---

## 10. Monitoring & Observability

### 10.1 Metrics

**File: `mcp-server/src/metrics/seat-metrics.ts` (NEW)**

```typescript
/**
 * Seat Management Metrics
 *
 * Exposes Prometheus-compatible metrics for seat usage monitoring
 */

import { LicenseDatabase } from '../database/schema.js';

export interface SeatMetrics {
  totalCustomers: number;
  customersWithSeatLimits: number;
  totalDeveloperSeatsAllocated: number;
  totalStakeholderSeatsAllocated: number;
  totalActiveDeveloperConnections: number;
  totalActiveStakeholderConnections: number;
  averageDeveloperSeatUtilization: number;
  averageStakeholderSeatUtilization: number;
  customersAtCapacity: number;
  recentRejections: number;
}

export async function collectSeatMetrics(db: LicenseDatabase): Promise<SeatMetrics> {
  // Total customers
  const [customerRows] = await db.pool.execute(
    'SELECT COUNT(*) as count FROM customers WHERE status = "active"'
  );
  const totalCustomers = (customerRows as any[])[0].count;

  // Customers with seat limits
  const [limitRows] = await db.pool.execute(
    `SELECT COUNT(*) as count FROM customers
     WHERE status = "active" AND (developer_seats > 0 OR stakeholder_seats > 0)`
  );
  const customersWithSeatLimits = (limitRows as any[])[0].count;

  // Total seats allocated
  const [seatRows] = await db.pool.execute(
    `SELECT
       SUM(CASE WHEN developer_seats > 0 THEN developer_seats ELSE 0 END) as dev_seats,
       SUM(CASE WHEN stakeholder_seats > 0 THEN stakeholder_seats ELSE 0 END) as stakeholder_seats
     FROM customers WHERE status = "active"`
  );
  const totalDeveloperSeatsAllocated = (seatRows as any[])[0].dev_seats || 0;
  const totalStakeholderSeatsAllocated = (seatRows as any[])[0].stakeholder_seats || 0;

  // Active connections
  const [activeRows] = await db.pool.execute(
    `SELECT
       SUM(CASE WHEN role = 'developer' THEN 1 ELSE 0 END) as dev_connections,
       SUM(CASE WHEN role = 'stakeholder' THEN 1 ELSE 0 END) as stakeholder_connections
     FROM active_connections`
  );
  const totalActiveDeveloperConnections = (activeRows as any[])[0].dev_connections || 0;
  const totalActiveStakeholderConnections = (activeRows as any[])[0].stakeholder_connections || 0;

  // Utilization
  const averageDeveloperSeatUtilization = totalDeveloperSeatsAllocated > 0
    ? (totalActiveDeveloperConnections / totalDeveloperSeatsAllocated) * 100
    : 0;

  const averageStakeholderSeatUtilization = totalStakeholderSeatsAllocated > 0
    ? (totalActiveStakeholderConnections / totalStakeholderSeatsAllocated) * 100
    : 0;

  // Customers at capacity
  const [capacityRows] = await db.pool.execute(
    `SELECT COUNT(*) as count FROM customers
     WHERE status = "active"
     AND (
       (developer_seats > 0 AND active_developer_seats >= developer_seats) OR
       (stakeholder_seats > 0 AND active_stakeholder_seats >= stakeholder_seats)
     )`
  );
  const customersAtCapacity = (capacityRows as any[])[0].count;

  // Recent rejections (last hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const [rejectionRows] = await db.pool.execute(
    `SELECT COUNT(*) as count FROM connection_events
     WHERE event_type = 'rejected' AND timestamp > ?`,
    [oneHourAgo]
  );
  const recentRejections = (rejectionRows as any[])[0].count;

  return {
    totalCustomers,
    customersWithSeatLimits,
    totalDeveloperSeatsAllocated,
    totalStakeholderSeatsAllocated,
    totalActiveDeveloperConnections,
    totalActiveStakeholderConnections,
    averageDeveloperSeatUtilization,
    averageStakeholderSeatUtilization,
    customersAtCapacity,
    recentRejections
  };
}

/**
 * Expose metrics endpoint
 */
export async function metricsHandler(db: LicenseDatabase): Promise<string> {
  const metrics = await collectSeatMetrics(db);

  return `
# HELP snow_flow_total_customers Total number of active customers
# TYPE snow_flow_total_customers gauge
snow_flow_total_customers ${metrics.totalCustomers}

# HELP snow_flow_customers_with_seat_limits Customers with seat limits configured
# TYPE snow_flow_customers_with_seat_limits gauge
snow_flow_customers_with_seat_limits ${metrics.customersWithSeatLimits}

# HELP snow_flow_developer_seats_allocated Total developer seats allocated across all customers
# TYPE snow_flow_developer_seats_allocated gauge
snow_flow_developer_seats_allocated ${metrics.totalDeveloperSeatsAllocated}

# HELP snow_flow_stakeholder_seats_allocated Total stakeholder seats allocated across all customers
# TYPE snow_flow_stakeholder_seats_allocated gauge
snow_flow_stakeholder_seats_allocated ${metrics.totalStakeholderSeatsAllocated}

# HELP snow_flow_active_developer_connections Current active developer connections
# TYPE snow_flow_active_developer_connections gauge
snow_flow_active_developer_connections ${metrics.totalActiveDeveloperConnections}

# HELP snow_flow_active_stakeholder_connections Current active stakeholder connections
# TYPE snow_flow_active_stakeholder_connections gauge
snow_flow_active_stakeholder_connections ${metrics.totalActiveStakeholderConnections}

# HELP snow_flow_developer_seat_utilization Average developer seat utilization percentage
# TYPE snow_flow_developer_seat_utilization gauge
snow_flow_developer_seat_utilization ${metrics.averageDeveloperSeatUtilization.toFixed(2)}

# HELP snow_flow_stakeholder_seat_utilization Average stakeholder seat utilization percentage
# TYPE snow_flow_stakeholder_seat_utilization gauge
snow_flow_stakeholder_seat_utilization ${metrics.averageStakeholderSeatUtilization.toFixed(2)}

# HELP snow_flow_customers_at_capacity Customers currently at seat capacity
# TYPE snow_flow_customers_at_capacity gauge
snow_flow_customers_at_capacity ${metrics.customersAtCapacity}

# HELP snow_flow_recent_seat_rejections Connection rejections in last hour
# TYPE snow_flow_recent_seat_rejections counter
snow_flow_recent_seat_rejections ${metrics.recentRejections}
`.trim();
}
```

**File: `mcp-server/src/index.ts` - Add metrics endpoint**

```typescript
import { metricsHandler } from './metrics/seat-metrics.js';

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsHandler(db);
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).send('Error collecting metrics');
  }
});
```

### 10.2 Logging

**Structured logging for seat events:**

```typescript
// Good example
logger.info('Connection rejected', {
  event: 'seat_limit_reached',
  customerId: 123,
  role: 'developer',
  limit: 5,
  active: 5,
  userId: 'abc123...',
  ip: '1.2.3.4'
});

// Bad example
logger.info('Connection rejected for customer 123');
```

### 10.3 Alerting Rules

**Example Prometheus alerts:**

```yaml
# alerts/seat-management.yml
groups:
  - name: seat_management
    interval: 60s
    rules:
      - alert: HighSeatUtilization
        expr: snow_flow_developer_seat_utilization > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High developer seat utilization (>90%)"
          description: "Average developer seat utilization is {{ $value }}%"

      - alert: CustomerAtCapacity
        expr: snow_flow_customers_at_capacity > 0
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "Customers at seat capacity"
          description: "{{ $value }} customers are at 100% seat capacity"

      - alert: FrequentRejections
        expr: rate(snow_flow_recent_seat_rejections[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High rate of seat limit rejections"
          description: "{{ $value }} rejections per minute"
```

---

## 11. Rollout Plan

### Phase 1: Database Schema (Week 1, Day 1-2)

**Tasks:**
1. Review and test migration scripts locally
2. Deploy migrations to staging database
3. Verify backward compatibility (existing customers unaffected)
4. Deploy to production database (off-peak hours)

**Rollback:** Keep rollback script ready

**Success Criteria:**
- All migrations execute without errors
- Existing customers still have unlimited seats (-1)
- No downtime

### Phase 2: License Parser & JWT (Week 1, Day 3-4)

**Tasks:**
1. Deploy license parser to portal backend
2. Update login endpoint with extended JWT payload
3. Test with new and legacy license formats
4. Deploy to staging
5. Test end-to-end login flow
6. Deploy to production

**Rollback:** Revert portal backend deployment

**Success Criteria:**
- New licenses parse correctly
- Legacy licenses still work (unlimited seats)
- JWT payload includes seat information
- Login API returns seat usage stats

### Phase 3: Connection Tracking (Week 1, Day 5 - Week 2, Day 1)

**Tasks:**
1. Deploy MCP server with connection tracking
2. Deploy cleanup worker
3. Test seat validation logic in staging
4. Monitor logs for connection/disconnect events
5. Deploy to production (gradual rollout)

**Rollback:** Disable seat enforcement flag per customer

**Success Criteria:**
- Connections tracked in database
- Heartbeats update last_seen timestamp
- Cleanup worker removes stale connections
- Grace period works for reconnections

### Phase 4: Seat Enforcement (Week 2, Day 2-3)

**Tasks:**
1. Enable seat enforcement for pilot customers
2. Monitor rejection rates
3. Collect feedback
4. Fine-tune grace period and timeout values
5. Gradually enable for all customers with seat limits

**Rollback:** Set `seat_limits_enforced = FALSE` for affected customers

**Success Criteria:**
- Seat limits enforced correctly
- Rejections logged with clear error messages
- No false positives (legitimate reconnections allowed)

### Phase 5: Role-Based Filtering (Week 2, Day 4-5)

**Tasks:**
1. Deploy tool metadata updates
2. Deploy role-based filtering logic
3. Test stakeholder access (read-only tools only)
4. Test developer access (all tools)
5. Deploy to production

**Rollback:** Remove role checks (all users get developer access)

**Success Criteria:**
- Stakeholders see only read-only BI tools
- Developers see all licensed tools
- Tool execution blocked for insufficient role

### Phase 6: Monitoring & Optimization (Ongoing)

**Tasks:**
1. Set up Prometheus scraping of /metrics endpoint
2. Configure Grafana dashboards for seat usage
3. Set up alerts for high utilization
4. Monitor performance impact
5. Optimize database queries if needed

**Success Criteria:**
- Metrics visible in Grafana
- Alerts firing correctly
- No performance degradation
- Seat usage trends tracked over time

---

## 12. Risk Assessment

### High Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migration fails | System down | Test thoroughly in staging, have rollback ready, execute during off-peak |
| Seat enforcement too aggressive | Legitimate users blocked | Grace period (5 min), monitoring, per-customer feature flag |
| Performance degradation | Slow connections | Optimize queries, add indexes, load test before production |
| Backward compatibility broken | Legacy customers can't connect | Extensive testing with old licenses, fallback to unlimited |

### Medium Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cleanup worker removes active connections | Users disconnected | Conservative timeout (2 min), heartbeat every 30s |
| JWT payload too large | Token size issues | Monitor token size, optimize if needed |
| Race conditions in seat counting | Wrong seat counts | Use database transactions, recalculate periodically |

### Low Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Metrics endpoint performance impact | Slow metrics scraping | Cache metrics for 30s, optimize queries |
| Logs too verbose | Storage issues | Use appropriate log levels, rotate logs |

---

## 13. Success Criteria

### Functional Requirements

- [x] Parse new license format: `SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM`
- [x] Track active connections in database
- [x] Enforce seat limits (reject when limit reached)
- [x] Grace period for reconnections (5 minutes)
- [x] Heartbeat mechanism (clients send every 30s)
- [x] Cleanup stale connections (no heartbeat for 2+ minutes)
- [x] Role-based tool filtering (stakeholder vs developer)
- [x] Extended JWT with seat information
- [x] Login API returns seat usage stats

### Non-Functional Requirements

- **Performance:** Connection validation < 50ms
- **Reliability:** 99.9% uptime for seat enforcement
- **Scalability:** Support 10,000+ concurrent connections
- **Monitoring:** Prometheus metrics exposed
- **Logging:** All seat events logged with context
- **Security:** JWT validation, role enforcement
- **Backward Compatibility:** Legacy licenses still work

---

## 14. Post-Implementation Tasks

### Documentation

- [ ] Update API documentation with new endpoints
- [ ] Write customer-facing guide on seat management
- [ ] Update internal operations runbook
- [ ] Create troubleshooting guide for seat issues

### Training

- [ ] Train customer support on seat-related issues
- [ ] Create internal demo of seat enforcement
- [ ] Document common issues and solutions

### Optimization

- [ ] Profile database query performance
- [ ] Optimize hot paths (connection validation)
- [ ] Consider Redis cache for seat counts
- [ ] Add database query explain analysis

---

## 15. Future Enhancements

### Phase 7: Portal UI for Seat Management (Future)

- Customer dashboard showing real-time seat usage
- Ability to view active connections per user
- Force disconnect capability for admins
- Seat usage history and reports
- Self-service seat purchase (upsell flow)

### Phase 8: Advanced Features (Future)

- **Dynamic seat allocation:** Temporarily borrow stakeholder seats for developers
- **Seat reservations:** Pre-allocate seats for specific users
- **Usage-based billing:** Track seat usage for billing purposes
- **Multi-tenant seat pools:** Share seats across sub-organizations
- **Auto-scaling:** Automatically request more seats when limit reached

---

## Conclusion

This implementation plan provides a comprehensive roadmap for adding stakeholder seats support to Snow-Flow Enterprise. The phased approach minimizes risk while delivering value incrementally.

**Next Steps:**
1. Review this plan with the team
2. Get approval for database schema changes
3. Set up staging environment
4. Begin Phase 1: Database Schema implementation

**Estimated Timeline:** 1.5-2 weeks for full implementation

**Questions or Concerns?** Please reach out to the engineering team.
