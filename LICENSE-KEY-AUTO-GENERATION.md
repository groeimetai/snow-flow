# License Key Auto-Generation Implementation

## Summary

Implemented automatic license key generation for the Snow-Flow Enterprise Portal. License keys are now automatically generated when creating customers through the admin or service integrator portals, based on the organization name, seat allocation, and expiry date.

## What Changed

### 1. Backend - License Key Generator (`/portal/backend/src/license/generator.ts`)

Created a new license key generator utility that:
- Generates seat-based license keys in format: `SNOW-ENT-ORG-10/5-20261231-CHECKSUM`
- Generates legacy unlimited license keys: `SNOW-ENT-ORG-20261231-CHECKSUM`
- Uses SHA-256 hashing for checksums with a secret salt
- Validates inputs (tier, organization, seats, expiry)
- Normalizes organization names (uppercase, alphanumeric only)

**Example Generated Keys:**
```
SNOW-ENT-ACMECORPORATION-10/5-20261103-46A082FD
SNOW-ENT-BIGTECHINC-0/0-20261103-80C566B2 (unlimited seats)
SNOW-ENT-LEGACYSYSTEMSLTD-20271103-F9C5B994 (legacy format)
```

### 2. Backend - License Key Parser (`/portal/backend/src/license/parser.ts`)

Updated the parser to:
- Validate checksums using SHA-256 hash verification
- Reject tampered license keys (invalid checksums)
- Support both new seat-based and legacy formats

### 3. Backend - Admin Routes (`/portal/backend/src/routes/admin.ts`)

Updated `POST /api/admin/customers` endpoint to:
- Accept optional `licenseKey`, `developerSeats`, `stakeholderSeats`, `seatLimitsEnforced` in request body
- Auto-generate license key if not provided (1 year expiry by default)
- Validate provided license keys if manually entered
- Use seat values from request or default to unlimited (-1)

### 4. Backend - Service Integrator Routes (`/portal/backend/src/routes/service-integrator.ts`)

Updated `POST /api/service-integrator/customers` endpoint with same auto-generation logic as admin routes.

### 5. Frontend - TypeScript Types (`/portal/frontend/src/types/index.ts`)

Updated interfaces:
- `Customer`: Added `developerSeats`, `stakeholderSeats`, `activeDeveloperSeats`, `activeStakeholderSeats`, `seatLimitsEnforced`, `licenseKey`
- `CreateCustomerDto`: Made `licenseKey` optional (auto-generated if not provided)
- `UpdateCustomerDto`: Added optional seat fields

### 6. Frontend - Admin Customers Page (`/portal/frontend/src/pages/admin/Customers.tsx`)

Updated the customer creation form:
- **Removed** manual license key input field
- **Added** blue info box: "License Key: Will be auto-generated based on organization name and seat allocation"
- **Added** developer seats and stakeholder seats number inputs
- **Added** "Enforce seat limits" checkbox
- **Added** seat usage display columns in table with color-coded badges:
  - Green < 70% usage
  - Yellow 70-90% usage
  - Red > 90% usage
- Shows "Unlimited" for seats = -1

## How It Works

### Creating a Customer (Admin)

1. Admin fills out form:
   - Customer Name: "Acme Corporation"
   - Contact Email: "admin@acme.com"
   - Service Integrator: (select from dropdown)
   - Developer Seats: 10
   - Stakeholder Seats: 5
   - Enforce seat limits: ✓

2. Frontend sends POST request to `/api/admin/customers` (without licenseKey)

3. Backend:
   - Receives request
   - Calls `generateLicenseKey()` with:
     - tier: 'ENT'
     - organization: 'Acme Corporation'
     - developerSeats: 10
     - stakeholderSeats: 5
     - expiresAt: 1 year from now
   - Generates: `SNOW-ENT-ACMECORPORATION-10/5-20261103-46A082FD`
   - Creates customer record with generated license key

4. Frontend displays success: "Customer created successfully! License key generated automatically."

5. Customer can now login with the generated license key

### License Key Format

**New Seat-Based Format:**
```
SNOW-ENT-ACMECORPORATION-10/5-20261103-46A082FD
│    │   │                │  │ │        │
│    │   │                │  │ │        └─ SHA-256 checksum (8 chars)
│    │   │                │  │ └────────── Expiry date (YYYYMMDD)
│    │   │                │  └──────────── Stakeholder seats
│    │   │                └─────────────── Developer seats
│    │   └──────────────────────────────── Organization (normalized)
│    └──────────────────────────────────── Tier (ENT/PRO/TEAM)
└───────────────────────────────────────── Prefix
```

**Special Values:**
- `0` or `-1` for seats = Unlimited
- Checksum ensures license authenticity (can't be forged)

## Security

- **Checksum Validation**: All license keys are validated against SHA-256 checksums
- **Secret Salt**: Checksums use `LICENSE_SECRET` environment variable (defaults to 'snow-flow-enterprise-2025')
- **Tamper Detection**: Modified license keys are rejected with "Invalid checksum" error

## Testing

Run the test suite:
```bash
cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/backend
npx tsx src/license/test-generator.ts
```

Expected output:
```
✅ Valid! Parsed: { tier: 'ENT', organization: 'ACMECORPORATION', ... }
✅ Correctly rejected: Invalid checksum: license key may be tampered with
```

## Migration Notes

### Existing Customers

Old license keys (without seat tracking) will continue to work:
- Legacy format: `SNOW-ENT-ORG-20261231-CHECKSUM`
- Parsed as unlimited seats (`developerSeats: -1`, `stakeholderSeats: -1`)
- `isLegacyFormat: true` flag set

### New Customers

All new customers created after this update will:
- Have auto-generated license keys with seat tracking
- Default to 1 year expiry
- Use checksum validation for security

## Environment Variables

Set in production:
```bash
export LICENSE_SECRET="your-secret-key-change-in-production"
```

This secret is used for checksum generation. **Keep it secret!**

## Files Modified

### Backend
- `/portal/backend/src/license/generator.ts` (new)
- `/portal/backend/src/license/parser.ts` (updated)
- `/portal/backend/src/license/test-generator.ts` (new)
- `/portal/backend/src/routes/admin.ts` (updated)
- `/portal/backend/src/routes/service-integrator.ts` (updated)

### Frontend
- `/portal/frontend/src/types/index.ts` (updated)
- `/portal/frontend/src/pages/admin/Customers.tsx` (updated)

## Next Steps

1. **Deploy to production**:
   ```bash
   cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/backend
   npm run build

   cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/frontend
   npm run build
   ```

2. **Set LICENSE_SECRET** environment variable in production

3. **Run database migrations** (if not already done):
   ```bash
   cd /Users/nielsvanderwerf/snow-flow-enterprise/portal/backend
   npm run migrate
   ```

4. **Test customer creation** in production to verify license key generation

## Questions?

- **Q: Can I still manually enter license keys?**
  - A: No, license keys are now auto-generated for security and consistency. If you need to override, you can set the `licenseKey` field in the API request directly (bypasses frontend).

- **Q: What happens to old license keys?**
  - A: They continue to work! The parser supports both legacy and new formats.

- **Q: Can I change the expiry date?**
  - A: Currently defaults to 1 year. To customize, modify the `createExpiryDateFromNow(1)` call in the admin routes.

- **Q: How do I generate unlimited licenses?**
  - A: Set both developer and stakeholder seats to `-1` (or leave default).
