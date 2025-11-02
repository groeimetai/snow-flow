# Stakeholder Seats - Technical Implementation Specification

**Version:** 1.0
**Date:** 2025-11-02
**Status:** Implementation Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [License Format](#license-format)
4. [Seat Tracking System](#seat-tracking-system)
5. [Permission Model](#permission-model)
6. [API Endpoints](#api-endpoints)
7. [Implementation Steps](#implementation-steps)

---

## Overview

### Goals

- Add support for **Developer Seats** and **Stakeholder Seats** in enterprise licenses
- Track active seat usage in real-time
- Enforce seat limits at connection time
- Provide role-based access control (RBAC)
- Enable read-only access for stakeholders

### Architecture Principles

1. **Reuse existing infrastructure** - Same MCP server, proxy, portal
2. **Backward compatibility** - Old license format continues to work
3. **Real-time tracking** - Active sessions tracked in database
4. **Security first** - Role validation server-side, not client-side
5. **Graceful degradation** - Clear error messages when limits reached

---

## Database Schema

### 1. New Tables

#### `users` Table

Stores user accounts (developers and stakeholders).

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL DEFAULT 'stakeholder',
  password_hash VARCHAR(255), -- NULL for SSO users
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_login BIGINT,
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  preferences JSON, -- UI preferences, dashboard config, etc.

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_email_per_customer (customer_id, email),
  INDEX idx_customer_role (customer_id, role),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Fields:**
- `id`: Unique user ID
- `customer_id`: Foreign key to customers table
- `email`: User email (unique per customer)
- `name`: Display name
- `role`: User role (developer/stakeholder/admin)
- `password_hash`: Hashed password (bcrypt) - NULL for SSO users
- `created_at`: Unix timestamp (milliseconds)
- `updated_at`: Unix timestamp (milliseconds)
- `last_login`: Last login timestamp
- `status`: Account status
- `preferences`: JSON blob for user preferences

---

#### `active_sessions` Table

Tracks active MCP connections and portal sessions for seat counting.

```sql
CREATE TABLE active_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  user_id INT, -- NULL for legacy MCP proxy connections without user auth
  session_id VARCHAR(255) NOT NULL UNIQUE, -- Unique session identifier
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL,
  session_type ENUM('mcp_proxy', 'portal_web', 'portal_api') NOT NULL,

  -- Connection metadata
  instance_id VARCHAR(255), -- For MCP proxy: machine fingerprint
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Session lifecycle
  connected_at BIGINT NOT NULL,
  last_activity BIGINT NOT NULL,
  expires_at BIGINT, -- NULL = no expiration

  -- Additional context
  metadata JSON, -- Version, platform, etc.

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_customer_role (customer_id, role),
  INDEX idx_last_activity (last_activity),
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Fields:**
- `id`: Unique session ID
- `customer_id`: Foreign key to customers table
- `user_id`: Foreign key to users table (NULL for anonymous connections)
- `session_id`: Unique session identifier (JWT JTI or generated UUID)
- `role`: Session role (determines which tools are available)
- `session_type`: Connection type
  - `mcp_proxy`: Claude Code + MCP proxy connection
  - `portal_web`: Web portal browser session
  - `portal_api`: Portal API connection
- `instance_id`: Machine fingerprint (for MCP proxy)
- `ip_address`: Client IP address
- `user_agent`: Client user agent string
- `connected_at`: Session start timestamp
- `last_activity`: Last heartbeat timestamp
- `expires_at`: Session expiration (NULL for MCP connections)
- `metadata`: Additional session context (JSON)

---

#### `licenses` Table Updates

Add seat count fields to existing `licenses` table.

```sql
ALTER TABLE licenses
ADD COLUMN developer_seats INT NOT NULL DEFAULT 0 AFTER features,
ADD COLUMN stakeholder_seats INT NOT NULL DEFAULT 0 AFTER developer_seats,
ADD INDEX idx_seats (developer_seats, stakeholder_seats);
```

**New Fields:**
- `developer_seats`: Maximum number of concurrent developer seats
- `stakeholder_seats`: Maximum number of concurrent stakeholder seats

**Migration Strategy:**
- Existing licenses: Set `developer_seats = 999` and `stakeholder_seats = 999` (unlimited)
- New licenses: Parse from license key format

---

### 2. TypeScript Interfaces

#### User Interface

```typescript
export interface User {
  id: number;
  customerId: number;
  email: string;
  name: string;
  role: 'developer' | 'stakeholder' | 'admin';
  passwordHash?: string; // NULL for SSO users
  createdAt: number;
  updatedAt: number;
  lastLogin?: number;
  status: 'active' | 'inactive' | 'suspended';
  preferences?: Record<string, any>;
}
```

#### Active Session Interface

```typescript
export interface ActiveSession {
  id: number;
  customerId: number;
  userId?: number; // NULL for legacy connections
  sessionId: string;
  role: 'developer' | 'stakeholder' | 'admin';
  sessionType: 'mcp_proxy' | 'portal_web' | 'portal_api';
  instanceId?: string;
  ipAddress?: string;
  userAgent?: string;
  connectedAt: number;
  lastActivity: number;
  expiresAt?: number;
  metadata?: Record<string, any>;
}
```

#### License Interface Update

```typescript
export interface License {
  id: number;
  key: string;
  tier: 'Team' | 'Professional' | 'Enterprise';
  status: 'active' | 'expired' | 'suspended' | 'invalid';
  companyName: string;
  contactEmail: string;
  customerId?: number;
  maxInstances: number;
  features: string; // JSON array
  developerSeats: number;      // 🆕 NEW
  stakeholderSeats: number;    // 🆕 NEW
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  totalApiCalls: number;
  lastApiCall?: number;
}
```

---

## License Format

### New Format

```
SNOW-[TIER]-[ORG]-[DEV_SEATS]/[STAKEHOLDER_SEATS]-[EXPIRY]-[CHECKSUM]
```

**Components:**
- `TIER`: Team, ENT (Enterprise), or ULT (Ultimate)
- `ORG`: Organization identifier (uppercase alphanumeric)
- `DEV_SEATS`: Number of developer seats (integer)
- `STAKEHOLDER_SEATS`: Number of stakeholder seats (integer)
- `EXPIRY`: Expiration date (YYYYMMDD)
- `CHECKSUM`: HMAC-SHA256 signature (8 chars)

**Examples:**
```
SNOW-TEAM-CAPGEMINI-5/1-20261231-A3F2E9C1
  → Tier: Team
  → Org: CAPGEMINI
  → 5 developer seats
  → 1 stakeholder seat
  → Expires: 2026-12-31

SNOW-ENT-ACME-10/5-20261231-B4E3F2D5
  → Tier: Enterprise
  → Org: ACME
  → 10 developer seats
  → 5 stakeholder seats
  → Expires: 2026-12-31
```

### Backward Compatibility

Old format (no seats):
```
SNOW-ENT-ACME-20261231-ABC123
```

**Parsing Logic:**
1. Try to parse new format (with seats)
2. If no seats found, use defaults:
   - `developerSeats = 999` (unlimited)
   - `stakeholderSeats = 999` (unlimited)
3. Both formats remain valid

---

## Seat Tracking System

### 1. Session Lifecycle

#### A. Developer Connection (MCP Proxy)

```
1. Developer starts Claude Code with MCP proxy
2. Proxy reads license key, parses seat counts
3. Proxy generates JWT with:
   - role: 'developer'
   - userId: null (or machine ID)
   - sessionId: unique UUID
4. Proxy connects to MCP server via SSE
5. MCP server receives connection:
   a. Validates JWT
   b. Checks seat availability: count active developer sessions
   c. If seats available: create active_sessions record
   d. If seats full: reject with 429 error
6. During session: periodic heartbeat updates last_activity
7. On disconnect: delete active_sessions record
8. Cleanup: cron job deletes stale sessions (last_activity > 30min)
```

#### B. Stakeholder Connection (Portal)

```
1. Stakeholder logs in to web portal
2. Portal authenticates user (email/password or SSO)
3. Portal generates JWT with:
   - role: 'stakeholder'
   - userId: user.id
   - sessionId: unique UUID
4. Portal checks seat availability
5. If seats available: create active_sessions record
6. User browses portal, JWT included in API calls
7. On each API call: update last_activity
8. On logout: delete active_sessions record
9. Auto-logout: session expires after 8 hours of inactivity
```

### 2. Seat Availability Check

**Algorithm:**

```typescript
async function checkSeatAvailability(
  customerId: number,
  role: 'developer' | 'stakeholder'
): Promise<{ available: boolean; used: number; limit: number }> {
  // 1. Get license
  const customer = await db.getCustomerById(customerId);
  const license = await db.getLicense(customer.licenseKey);

  // 2. Get seat limits
  const limit = role === 'developer'
    ? license.developerSeats
    : license.stakeholderSeats;

  // 3. Count active sessions
  const activeSessions = await db.getActiveSessions(customerId, role);

  // 4. Clean up stale sessions (last_activity > 30 minutes ago)
  const now = Date.now();
  const staleThreshold = now - (30 * 60 * 1000);
  const staleSessions = activeSessions.filter(s => s.lastActivity < staleThreshold);

  for (const session of staleSessions) {
    await db.deleteActiveSession(session.id);
  }

  // 5. Recount after cleanup
  const activeCount = activeSessions.filter(s => s.lastActivity >= staleThreshold).length;

  // 6. Check availability
  return {
    available: activeCount < limit,
    used: activeCount,
    limit: limit
  };
}
```

### 3. Session Heartbeat

**MCP Proxy Heartbeat:**
- Every tool call updates `last_activity`
- No explicit heartbeat needed (tools are used frequently)

**Portal Heartbeat:**
- JavaScript interval: every 5 minutes
- API call: `PUT /api/session/heartbeat`
- Updates `last_activity` timestamp

**Stale Session Cleanup:**
- Cron job runs every 10 minutes
- Deletes sessions where `last_activity > 30 minutes ago`
- Frees up seats automatically

---

## Permission Model

### 1. Tool Permission Metadata

Every MCP tool has permission metadata:

```typescript
interface ToolDefinition {
  name: string;
  handler: Function;
  feature: string; // e.g., 'jira', 'azure-devops', 'stakeholder-insights'
  description: string;
  permission: 'read' | 'write';  // 🆕 NEW
  allowedRoles: ('developer' | 'stakeholder' | 'admin')[]; // 🆕 NEW
}
```

**Example:**

```typescript
const ENTERPRISE_TOOLS: ToolDefinition[] = [
  // ===== WRITE TOOLS (Developers only) =====
  {
    name: 'jira_create_issue',
    handler: jiraCreateIssue,
    feature: 'jira',
    description: 'Create new Jira issue',
    permission: 'write',
    allowedRoles: ['developer', 'admin']
  },
  {
    name: 'jira_update_issue',
    handler: jiraUpdateIssue,
    feature: 'jira',
    description: 'Update Jira issue',
    permission: 'write',
    allowedRoles: ['developer', 'admin']
  },

  // ===== READ TOOLS (Stakeholders + Developers) =====
  {
    name: 'jira_get_issue',
    handler: jiraGetIssue,
    feature: 'jira',
    description: 'Get Jira issue details',
    permission: 'read',
    allowedRoles: ['developer', 'stakeholder', 'admin']
  },
  {
    name: 'jira_search_issues',
    handler: jiraSearchIssues,
    feature: 'jira',
    description: 'Search Jira issues with JQL',
    permission: 'read',
    allowedRoles: ['developer', 'stakeholder', 'admin']
  },

  // ===== STAKEHOLDER-SPECIFIC TOOLS =====
  {
    name: 'snow_stakeholder_executive_summary',
    handler: generateExecutiveSummary,
    feature: 'stakeholder-insights',
    description: 'Generate executive summary from ServiceNow',
    permission: 'read',
    allowedRoles: ['stakeholder', 'admin']
  }
];
```

### 2. JWT Payload Structure

**Developer JWT (from MCP Proxy):**

```json
{
  "customerId": 123,
  "company": "ACME Corp",
  "tier": "Enterprise",
  "features": ["jira", "azure-devops", "stakeholder-insights"],
  "role": "developer",
  "userId": null,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1730534400,
  "exp": 1730620800
}
```

**Stakeholder JWT (from Portal):**

```json
{
  "customerId": 123,
  "company": "ACME Corp",
  "tier": "Enterprise",
  "features": ["jira", "azure-devops", "stakeholder-insights"],
  "role": "stakeholder",
  "userId": 456,
  "sessionId": "660f9500-f39c-52e5-b827-557766551111",
  "iat": 1730534400,
  "exp": 1730620800
}
```

### 3. Permission Checks

#### ListTools (Tool Discovery)

```typescript
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
  const jwtPayload = (mcpServer as any)._clientJwt;

  if (!jwtPayload || !jwtPayload.features || !jwtPayload.role) {
    return { tools: [] };
  }

  // Filter tools based on:
  // 1. License features
  // 2. User role
  const availableTools = ENTERPRISE_TOOLS.filter(tool => {
    const hasFeature = jwtPayload.features.includes(tool.feature);
    const hasRole = tool.allowedRoles.includes(jwtPayload.role);
    return hasFeature && hasRole;
  }).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.handler.inputSchema || { type: 'object', properties: {}, required: [] }
  }));

  return { tools: availableTools };
});
```

#### CallTool (Execution)

```typescript
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const jwtPayload = (mcpServer as any)._clientJwt;

  // 1. Validate JWT
  if (!jwtPayload || !jwtPayload.role) {
    throw new Error('Unauthorized: Invalid JWT');
  }

  // 2. Find tool
  const tool = ENTERPRISE_TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // 3. Check role permission
  if (!tool.allowedRoles.includes(jwtPayload.role)) {
    throw new Error(
      `Access denied: Tool '${name}' requires one of roles: ${tool.allowedRoles.join(', ')}. ` +
      `Your role: ${jwtPayload.role}`
    );
  }

  // 4. Double-check: Stakeholders can ONLY use read-only tools
  if (jwtPayload.role === 'stakeholder' && tool.permission === 'write') {
    throw new Error(
      `Access denied: Stakeholders do not have write permissions. ` +
      `Tool '${name}' requires write access.`
    );
  }

  // 5. Check feature access
  if (!jwtPayload.features.includes(tool.feature)) {
    throw new Error(`Tool '${name}' requires feature: ${tool.feature}`);
  }

  // 6. Update session activity (heartbeat)
  if (jwtPayload.sessionId) {
    await db.updateSessionActivity(jwtPayload.customerId, jwtPayload.sessionId);
  }

  // 7. Execute tool
  const credentials = await credsDb.getCredentials(jwtPayload.customerId, tool.feature);
  const customer = await db.getCustomerById(jwtPayload.customerId);
  const result = await tool.handler(args, customer, { [tool.feature]: credentials });

  return result;
});
```

---

## API Endpoints

### Portal Backend API

#### User Management

```typescript
// Create stakeholder user
POST /api/admin/users
Body: {
  email: string;
  name: string;
  role: 'developer' | 'stakeholder';
  password?: string; // Optional if SSO enabled
}
Response: User

// List users
GET /api/admin/users?role=stakeholder
Response: User[]

// Update user
PATCH /api/admin/users/:userId
Body: Partial<User>
Response: User

// Delete user
DELETE /api/admin/users/:userId
Response: { success: boolean }

// Invite user (sends email)
POST /api/admin/users/invite
Body: {
  email: string;
  name: string;
  role: 'developer' | 'stakeholder';
}
Response: { success: boolean; inviteUrl: string }
```

#### Seat Management

```typescript
// Get seat usage
GET /api/admin/seats/usage
Response: {
  developer: {
    limit: number;
    used: number;
    available: number;
    sessions: ActiveSession[];
  };
  stakeholder: {
    limit: number;
    used: number;
    available: number;
    sessions: ActiveSession[];
  };
}

// Get active sessions
GET /api/admin/sessions?role=developer
Response: ActiveSession[]

// Terminate session (force disconnect)
DELETE /api/admin/sessions/:sessionId
Response: { success: boolean }
```

#### Authentication (Stakeholder Portal)

```typescript
// Login
POST /api/stakeholder/auth/login
Body: { email: string; password: string }
Response: { token: string; user: User }

// Logout
POST /api/stakeholder/auth/logout
Headers: { Authorization: 'Bearer <token>' }
Response: { success: boolean }

// Get current user
GET /api/stakeholder/auth/me
Headers: { Authorization: 'Bearer <token>' }
Response: User

// Session heartbeat
PUT /api/stakeholder/session/heartbeat
Headers: { Authorization: 'Bearer <token>' }
Response: { success: boolean; expiresAt: number }
```

---

## Implementation Steps

### Phase 1: Database Schema (Week 1)

**Files to modify:**
- `mcp-server/src/database/schema.ts`
- `mcp-server/migrations/` (new SQL migration files)

**Tasks:**
1. ✅ Add `users` table schema
2. ✅ Add `active_sessions` table schema
3. ✅ Update `licenses` table (add seat columns)
4. ✅ Create TypeScript interfaces
5. ✅ Implement database methods:
   - `createUser()`, `getUser()`, `listUsers()`, `updateUser()`, `deleteUser()`
   - `createActiveSession()`, `getActiveSessions()`, `updateSessionActivity()`, `deleteActiveSession()`
   - `getSeatUsage()`, `checkSeatAvailability()`
   - `cleanupStaleSessions()`

**Migration SQL:**

```sql
-- migrations/004_add_stakeholder_seats.sql

-- 1. Create users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL DEFAULT 'stakeholder',
  password_hash VARCHAR(255),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_login BIGINT,
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  preferences JSON,

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_email_per_customer (customer_id, email),
  INDEX idx_customer_role (customer_id, role),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create active_sessions table
CREATE TABLE active_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  user_id INT,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL,
  session_type ENUM('mcp_proxy', 'portal_web', 'portal_api') NOT NULL,
  instance_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  connected_at BIGINT NOT NULL,
  last_activity BIGINT NOT NULL,
  expires_at BIGINT,
  metadata JSON,

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_customer_role (customer_id, role),
  INDEX idx_last_activity (last_activity),
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add seat columns to licenses
ALTER TABLE licenses
ADD COLUMN developer_seats INT NOT NULL DEFAULT 999 AFTER features,
ADD COLUMN stakeholder_seats INT NOT NULL DEFAULT 999 AFTER developer_seats,
ADD INDEX idx_seats (developer_seats, stakeholder_seats);

-- 4. Update existing licenses with default unlimited seats
UPDATE licenses SET developer_seats = 999, stakeholder_seats = 999 WHERE developer_seats = 0;
```

### Phase 2: License Parsing (Week 1)

**Files to modify:**
- `src/license/validator.ts` (in snow-flow project)
- `src/license/types.ts`

**Tasks:**
1. ✅ Update license parser to handle new format
2. ✅ Add backward compatibility for old format
3. ✅ Update `ParsedLicense` interface
4. ✅ Add unit tests for both formats

**Example Implementation:**

```typescript
// src/license/validator.ts

interface ParsedLicense {
  tier: string;
  organization: string;
  developerSeats: number;      // 🆕 NEW
  stakeholderSeats: number;    // 🆕 NEW
  expiresAt: Date;
  checksum: string;
}

function parseLicenseKey(licenseKey: string): ParsedLicense {
  // New format: SNOW-TIER-ORG-DEV/STAKE-EXPIRY-CHECKSUM
  // Old format: SNOW-TIER-ORG-EXPIRY-CHECKSUM

  const parts = licenseKey.split('-');

  if (parts.length < 5) {
    throw new Error('Invalid license key format');
  }

  const [prefix, tier, organization, seatsOrExpiry, ...rest] = parts;

  if (prefix !== 'SNOW') {
    throw new Error('Invalid license key prefix');
  }

  // Check if seatsOrExpiry contains '/' (new format)
  let developerSeats = 999;
  let stakeholderSeats = 999;
  let expiry: string;
  let checksum: string;

  if (seatsOrExpiry.includes('/')) {
    // New format with seats
    const [dev, stake] = seatsOrExpiry.split('/');
    developerSeats = parseInt(dev, 10);
    stakeholderSeats = parseInt(stake, 10);
    expiry = rest[0];
    checksum = rest[1];
  } else {
    // Old format without seats (unlimited)
    expiry = seatsOrExpiry;
    checksum = rest[0];
  }

  // Parse expiry date
  const year = parseInt(expiry.substring(0, 4), 10);
  const month = parseInt(expiry.substring(4, 6), 10) - 1;
  const day = parseInt(expiry.substring(6, 8), 10);
  const expiresAt = new Date(year, month, day);

  return {
    tier,
    organization,
    developerSeats,
    stakeholderSeats,
    expiresAt,
    checksum
  };
}
```

### Phase 3: Seat Tracking Middleware (Week 2)

**Files to modify:**
- `mcp-server/src/index.ts`
- `mcp-server/src/middleware/seat-tracking.ts` (new file)

**Tasks:**
1. ✅ Create seat availability check middleware
2. ✅ Add session creation on SSE connect
3. ✅ Add session heartbeat on tool calls
4. ✅ Add session cleanup on disconnect
5. ✅ Add cron job for stale session cleanup

**Example Implementation:**

```typescript
// mcp-server/src/middleware/seat-tracking.ts

export async function checkAndCreateSession(
  jwtPayload: JWTPayload,
  req: Request
): Promise<{ allowed: boolean; reason?: string }> {
  const { customerId, role, sessionId } = jwtPayload;

  // 1. Check seat availability
  const availability = await db.checkSeatAvailability(customerId, role);

  if (!availability.available) {
    return {
      allowed: false,
      reason: `No ${role} seats available. ` +
              `Used: ${availability.used}/${availability.limit}. ` +
              `Please disconnect an existing session or upgrade your license.`
    };
  }

  // 2. Create session record
  await db.createActiveSession({
    customerId,
    userId: jwtPayload.userId || null,
    sessionId,
    role,
    sessionType: 'mcp_proxy',
    instanceId: jwtPayload.instanceId || null,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    expiresAt: null, // MCP sessions don't expire
    metadata: {
      version: jwtPayload.version || 'unknown',
      tier: jwtPayload.tier
    }
  });

  return { allowed: true };
}

export async function updateSessionHeartbeat(
  customerId: number,
  sessionId: string
): Promise<void> {
  await db.updateSessionActivity(customerId, sessionId);
}

export async function cleanupStaleSessionsCron(): Promise<void> {
  setInterval(async () => {
    const staleThreshold = Date.now() - (30 * 60 * 1000); // 30 minutes
    const deleted = await db.cleanupStaleSessions(staleThreshold);

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} stale sessions`);
    }
  }, 10 * 60 * 1000); // Run every 10 minutes
}
```

### Phase 4: Permission System (Week 2)

**Files to modify:**
- `mcp-server/src/index.ts`
- `mcp-server/src/tools/permissions.ts` (new file)

**Tasks:**
1. ✅ Add permission metadata to tool definitions
2. ✅ Update ListTools handler (filter by role)
3. ✅ Update CallTool handler (validate permissions)
4. ✅ Add double-check for stakeholder write protection

**Example: see "Permission Model" section above**

### Phase 5: Portal User Management (Week 3)

**Files to modify:**
- `portal/backend/src/routes/admin.ts`
- `portal/backend/src/routes/stakeholder.ts` (new file)
- `portal/backend/src/middleware/auth.ts`

**Tasks:**
1. ✅ Implement user CRUD API endpoints
2. ✅ Implement seat usage API endpoints
3. ✅ Implement stakeholder authentication
4. ✅ Add password hashing (bcrypt)
5. ✅ Add JWT generation with role

### Phase 6: Portal Frontend (Week 3-4)

**Files to create/modify:**
- `portal/frontend/src/pages/admin/UserManagement.tsx`
- `portal/frontend/src/pages/admin/SeatUsage.tsx`
- `portal/frontend/src/pages/stakeholder/Dashboard.tsx`
- `portal/frontend/src/pages/stakeholder/Login.tsx`

**Tasks:**
1. ✅ Build user management UI (admin)
2. ✅ Build seat usage dashboard (admin)
3. ✅ Build stakeholder login page
4. ✅ Build stakeholder dashboard
5. ✅ Add session heartbeat (5min interval)

### Phase 7: Testing & Documentation (Week 4)

**Tasks:**
1. ✅ Unit tests for license parsing
2. ✅ Integration tests for seat tracking
3. ✅ Load testing (simulate 50+ concurrent sessions)
4. ✅ Security audit (test permission bypasses)
5. ✅ Update all documentation
6. ✅ Create admin guide
7. ✅ Create stakeholder onboarding guide

---

## Error Handling

### Seat Limit Reached

**HTTP Response:**

```json
{
  "error": "Seat limit reached",
  "code": "SEAT_LIMIT_EXCEEDED",
  "message": "No developer seats available. Used: 10/10. Please disconnect an existing session or upgrade your license.",
  "details": {
    "role": "developer",
    "used": 10,
    "limit": 10,
    "activeSessions": [
      {
        "sessionId": "...",
        "connectedAt": 1730534400000,
        "instanceId": "machine-abc-123"
      }
    ]
  }
}
```

**HTTP Status:** `429 Too Many Requests`

### Permission Denied

**HTTP Response:**

```json
{
  "error": "Permission denied",
  "code": "INSUFFICIENT_PERMISSIONS",
  "message": "Tool 'jira_create_issue' requires one of roles: developer, admin. Your role: stakeholder",
  "details": {
    "tool": "jira_create_issue",
    "requiredRoles": ["developer", "admin"],
    "userRole": "stakeholder"
  }
}
```

**HTTP Status:** `403 Forbidden`

---

## Security Considerations

1. **Role Validation Server-Side**
   - Never trust role from client
   - Always extract role from JWT (server-signed)
   - Validate JWT signature before extracting payload

2. **Session Hijacking Protection**
   - Unique session IDs (UUIDs)
   - JWT includes session ID (jti claim)
   - Rotate JWTs every 24 hours
   - Invalidate on logout

3. **Seat Limit Bypass Protection**
   - Seat check happens server-side
   - Transaction-safe (check + create session is atomic)
   - Race condition handled by unique constraint on session_id

4. **Write Permission Protection**
   - Double-check in CallTool handler
   - Stakeholders CANNOT call write tools, even if they bypass ListTools
   - Tools themselves can validate read-only mode

---

## Monitoring & Analytics

### Metrics to Track

1. **Seat Utilization**
   - Peak concurrent developer seats
   - Peak concurrent stakeholder seats
   - Average utilization percentage
   - Seat limit reached events

2. **Session Analytics**
   - Average session duration
   - Sessions per user
   - Peak concurrent sessions (time of day)
   - Stale session cleanup count

3. **Permission Violations**
   - Failed permission checks
   - Attempted write operations by stakeholders
   - Seat limit exceeded attempts

4. **User Activity**
   - Logins per day
   - Most active stakeholders
   - Tool usage by role
   - Portal vs MCP usage split

---

## Future Enhancements

### Phase 8: Advanced Features (Future)

1. **Seat Pooling**
   - Allow seat sharing across customers (for SIs)
   - Dynamic seat allocation

2. **Seat Reservations**
   - Reserve seats for specific users
   - Priority queueing when seats are full

3. **Usage-Based Billing**
   - Track actual seat-hours used
   - Bill based on usage, not fixed price

4. **Mobile App**
   - iOS/Android app for stakeholders
   - Push notifications for alerts

5. **AI Copilot Mode**
   - Natural language conversations
   - Multi-turn context awareness
   - Proactive insights

---

## Conclusion

This specification provides a complete implementation plan for Stakeholder Seats in snow-flow-enterprise. The design prioritizes:

- ✅ **Backward compatibility** - Existing customers unaffected
- ✅ **Security** - Server-side validation, no client trust
- ✅ **Scalability** - Efficient queries, indexed tables
- ✅ **User experience** - Clear errors, graceful degradation
- ✅ **Flexibility** - Easy to extend with new roles/features

Implementation can begin immediately with Phase 1 (Database Schema).

---

**Next Steps:**
1. Review and approve this specification
2. Create implementation tasks in project management tool
3. Assign developers to phases
4. Begin Phase 1 implementation

