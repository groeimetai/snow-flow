# Deprecated Files & Components

This document tracks files and components that are no longer used in the portal backend.

## Deprecated Database Schema

### `src/database/credentials-schema.ts`
- **Status**: DEPRECATED (not deleted - still referenced by unused files)
- **Reason**: Replaced by MySQL-based credentials management in `LicenseDatabase`
- **Old approach**: SQLite-only database with `CredentialsDatabase` class
- **New approach**: MySQL with AES-256-GCM encryption in `LicenseDatabase` class
- **Migration**: Credentials now stored in `customer_credentials` table (see `migrations/001_add_customer_credentials.sql`)

**Still referenced by (but not used):**
- `src/workers/token-refresh.ts` - OAuth token refresh worker (disabled)
- `src/routes/monitoring.ts` - Monitoring routes (disabled)

## Deprecated Workers

### `src/workers/token-refresh.ts`
- **Status**: DISABLED (commented out in index.ts)
- **Reason**: Uses old `CredentialsDatabase` (SQLite)
- **TODO**: Rewrite to use `LicenseDatabase` MySQL credentials when OAuth support is needed
- **Current usage**: None (OAuth flows not implemented in MVP)

## Deprecated Routes

### `src/routes/monitoring.ts`
- **Status**: DISABLED (commented out in index.ts)
- **Reason**: Uses old `CredentialsDatabase` (SQLite)
- **TODO**: Update to use `LicenseDatabase` MySQL credentials
- **Current usage**: None (route not registered)

## Replaced Files

### `src/routes/credentials-oauth-complex.ts.bak`
- **Status**: DELETED
- **Reason**: Replaced by simplified `credentials.ts` (MVP version)
- **Old approach**: Complex OAuth2 flows for Jira, Azure DevOps, Confluence
- **New approach**: Simple API token + basic auth (OAuth deferred to later phase)

## Backup Files (DELETED)

All `.backup`, `.bak`, and `.sqlite.backup` files have been removed:
- `src/middleware/sso-auth.ts.backup`
- `src/database/schema.ts.sqlite.backup`
- `src/services/validation.ts.backup`

## Future Cleanup Tasks

When OAuth support is implemented:

1. **Update or remove** `src/workers/token-refresh.ts`:
   - Replace `CredentialsDatabase` with `LicenseDatabase`
   - Update to use MySQL credentials methods
   - Re-enable in `index.ts`

2. **Update or remove** `src/routes/monitoring.ts`:
   - Replace `CredentialsDatabase` with `LicenseDatabase`
   - Update to use MySQL credentials methods
   - Re-enable in `index.ts`

3. **Delete** `src/database/credentials-schema.ts`:
   - Only delete after updating/removing files above
   - Ensure no other files reference it

## Migration Path

**From**: SQLite credentials-schema.ts → **To**: MySQL LicenseDatabase

```typescript
// OLD (SQLite - DEPRECATED)
import { CredentialsDatabase } from './database/credentials-schema.js';
const credsDb = new CredentialsDatabase(db.database);
await credsDb.getOAuthCredential(customerId, service);

// NEW (MySQL - CURRENT)
import { LicenseDatabase } from './database/schema.js';
const db = new LicenseDatabase();
await db.getCustomerCredential(customerId, service);
```

## Environment Variables

**Old** (no longer used):
- None specific to deprecated components

**New** (required for credentials):
- `CREDENTIALS_ENCRYPTION_KEY` - 32-byte key for AES-256-GCM encryption

---

**Last Updated**: 2025-10-28
**Version**: Portal Backend v2.0.0
