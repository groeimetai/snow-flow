# Snow-Flow Partner Program

Complete documentation for the Snow-Flow Partner Program, featuring two partnership tracks designed for ServiceNow consultants, system integrators, and service providers.

## Table of Contents

1. [Overview](#overview)
2. [Partner Types](#partner-types)
3. [Partner Tiers](#partner-tiers)
4. [License Key Formats](#license-key-formats)
5. [Getting Started](#getting-started)
6. [CLI Commands](#cli-commands)
7. [Pricing & Revenue](#pricing--revenue)
8. [Benefits & Support](#benefits--support)

## Overview

The Snow-Flow Partner Program offers two distinct partnership tracks aligned with industry standards:

- **Reseller Partners**: Buy wholesale licenses (25+ seats), resell at your own pricing with volume discounts
- **Solution Partners**: Refer customers, earn recurring commission (15% Y1, 10% Y2+)

**White-label option** available as add-on for Reseller partners ($500/month).

## Partner Types

### 1. Reseller Partner

**Model**: Wholesale bulk purchase with volume discounts

Reseller partners purchase Snow-Flow licenses at wholesale pricing and resell them to their customers at their own pricing, keeping the margin. Volume discounts reward scale.

**Pricing**:
- 25-99 seats: $69/seat/year
- 100-499 seats: $59/seat/year
- 500+ seats: $49/seat/year
- Minimum: 25 seats ($1,725/year minimum)
- Suggested retail: $99/seat
- Profit margins: 30-51% (depending on volume)

**Features**:
- ✅ White-label portal option ($500/month add-on)
- ✅ Custom domain support
- ✅ Partner success manager
- ✅ Flexible seat allocation
- ✅ Priority support
- ✅ Volume discount tiers
- ✅ Partner dashboard with analytics

**License Key Format**:
```
SNOW-RESELLER-[ORG]-[SEATS]-[EXPIRY]-[CHECKSUM]
Example: SNOW-RESELLER-ACME-100-20261231-ABC123
```

**Use Cases**:
- ServiceNow consultancies with 25+ clients
- System integrators bundling Snow-Flow with services
- MSPs offering managed ServiceNow development
- VARs and resellers in ServiceNow ecosystem

### 2. Solution Partner

**Model**: Commission-based referrals (industry standard)

Solution partners refer customers to Snow-Flow and earn recurring commission on their subscriptions. No upfront costs, no inventory management, no minimum commitment.

**Commission Rates** (same for all tiers):
- Year 1: **15%** (industry standard)
- Year 2+: **10%** (recurring ongoing)
- Lifetime Value: 110% of Year 1 subscription value

**Features**:
- ✅ No upfront costs ($0 to start)
- ✅ Monthly recurring revenue (passive income)
- ✅ Unique referral code (SOLUTION-YOURORG)
- ✅ Performance dashboard with MRR tracking
- ✅ Co-marketing support
- ✅ Sales enablement materials
- ✅ Implementation best practices
- ✅ ServiceNow-focused messaging

**License Key Format**:
```
SNOW-SOLUTION-[ORG]-[EXPIRY]-[CHECKSUM]
Example: SNOW-SOLUTION-ACME-20261231-ABC123
```

**Use Cases**:
- ServiceNow consultants without resale operations
- Implementation partners focusing on services
- Individual consultants with customer networks
- System integrators preferring commission model
- Freelance ServiceNow specialists

### White-label Add-on (Reseller Partners Only)

**Model**: Optional white-label branding for Reseller partners

Reseller partners can add white-label branding to create a fully branded experience for their customers.

**Pricing**:
- Setup fee: $2,500 (one-time)
- Monthly fee: $500/month
- Requires: Active Reseller partner license

**Features**:
- ✅ Custom branding & logo
- ✅ Custom domain (e.g., platform.partner.com)
- ✅ Branded portal for your customers
- ✅ Branded email templates
- ✅ Custom documentation
- ✅ White-labeled API access

**Use Cases**:
- Reseller partners wanting to brand Snow-Flow as their own product
- ServiceNow Elite Partners with 100+ seats
- Partners wanting complete brand control for customers

**Note**: White-label is not a separate partner track, but an optional add-on for Reseller partners.

## Partner Tiers

Partners unlock additional **support and benefits** as they grow their customer base.

**Important**: Tiers determine support level and benefits, **NOT commission rates**. All Solution Partners receive 15% Y1 / 10% Y2+ regardless of tier.

### Certified Partner (1-10 customers)

**Benefits**:
- Partner portal access
- Sales enablement materials
- Technical documentation
- Email support (24h response)
- Monthly partner newsletter
- Partner badge for website
- Listed in partner directory

**For Reseller Partners**: Standard wholesale pricing applies
**For Solution Partners**: 15% Y1, 10% Y2+ (same for all tiers)

### Gold Partner (11-50 customers)

**Benefits**:
- All Certified benefits
- Dedicated partner success manager
- Priority support (4h response)
- Co-marketing opportunities
- Quarterly business reviews
- Early access to new features
- Featured partner status
- Case study development

**For Reseller Partners**: Eligible for volume discounts based on total seats
**For Solution Partners**: 15% Y1, 10% Y2+ (same commission, better support)

### Platinum Partner (51+ customers)

**Benefits**:
- All Gold benefits
- Dedicated success TEAM
- 24/7 priority support (1h response)
- Joint marketing campaigns
- Roadmap influence
- Custom integrations support
- Strategic partnership
- Executive sponsor

**For Reseller Partners**: Maximum volume discounts + strategic support
**For Solution Partners**: 15% Y1, 10% Y2+ (same commission, premium support)

## License Key Formats

Partner license keys follow track-specific formats:

### Reseller Partner Format

```
SNOW-RESELLER-[ORG]-[SEATS]-[EXPIRY]-[CHECKSUM]
```

**Components**:
- **SNOW**: Snow-Flow identifier
- **RESELLER**: Reseller partner track
- **ORG**: Partner organization name (uppercase, alphanumeric)
- **SEATS**: Number of purchased seats (minimum 25)
- **EXPIRY**: Expiration date (YYYYMMDD format)
- **CHECKSUM**: License validation checksum

**Example**:
```
SNOW-RESELLER-ACME-100-20261231-ABC123
  └─ ACME Corp with 100 purchased seats, expires Dec 31, 2026
```

### Solution Partner Format

```
SNOW-SOLUTION-[ORG]-[EXPIRY]-[CHECKSUM]
```

**Components**:
- **SNOW**: Snow-Flow identifier
- **SOLUTION**: Solution partner track
- **ORG**: Partner organization name (uppercase, alphanumeric)
- **EXPIRY**: Expiration date (YYYYMMDD format)
- **CHECKSUM**: License validation checksum

**Example**:
```
SNOW-SOLUTION-ACME-20261231-ABC123
  └─ ACME Corp solution partner, expires Dec 31, 2026
  └─ No seat limit (commission-based model)
  └─ Referral code auto-generated: SOLUTION-ACME
```

## Getting Started

### 1. Apply for Partner Program

Contact our partner team:
- Email: partners@snow-flow.dev
- Website: https://snow-flow.dev/#partners

### 2. Receive Partner License Key

Once approved, you'll receive:
- Partner license key
- Partner ID
- Access to partner portal
- Onboarding materials

### 3. Authenticate with CLI

```bash
snow-flow partner login
# Enter your partner license key when prompted
```

### 4. Verify Partner Status

```bash
snow-flow partner status
```

## CLI Commands

### Partner Login

Authenticate with your partner license key:

```bash
snow-flow partner login
```

You'll be prompted to enter your license key:
```
SNOW-PARTNER-RESELLER-ACME-100-20261231-ABC123
```

The CLI will:
1. Validate license key format
2. Parse partner type and details
3. Check expiration date
4. Verify checksum
5. Store authentication locally

### Partner Status

View your current partner authentication:

```bash
snow-flow partner status
```

Output includes:
- Partner name and ID
- Partner type
- License status (active/expired)
- Type-specific details (seats, referral code, etc.)
- Expiration date
- Days remaining

### Partner Logout

Logout from your partner account:

```bash
snow-flow partner logout
```

## Pricing & Revenue

### Reseller Partner Economics

**Example**: 100 seats purchased

```
Wholesale cost:   $49/seat × 100 = $4,900/year
Suggested retail: $75/seat × 100 = $7,500/year
Gross margin:                      $2,600/year (35%)

If you sell at $100/seat:
Your revenue:     $100/seat × 100 = $10,000/year
Your margin:                        $5,100/year (51%)
```

### Referral Partner Economics

**Example**: Refer customer with 20 seats at $99/seat

```
Customer pays Snow-Flow: $99/seat × 20 = $1,980/year

Your commission (Certified tier):
  Year 1: 30% × $1,980 = $594
  Year 2: 20% × $1,980 = $396/year (recurring)
  Year 3+: 20% × $1,980 = $396/year (recurring)

Your commission (Platinum tier):
  Year 1: 40% × $1,980 = $792
  Year 2+: 30% × $1,980 = $594/year (recurring)
```

### White-label Partner Economics

**Example**: 150 seats total usage

```
Base fee:                          $10,000/year
Included seats:                    100 seats
Overage:                           50 seats
Overage cost: $30/seat × 50 =     $1,500/year
Total cost:                        $11,500/year

If you sell at $100/seat:
Your revenue: $100/seat × 150 =    $15,000/year
Your margin:                       $3,500/year (23%)
```

## Benefits & Support

### Partner Portal

All partners get access to:
- Customer management dashboard
- License key management
- Performance analytics
- Commission tracking (Referral partners)
- Seat allocation (Reseller partners)
- Co-marketing materials
- Sales enablement content

### Technical Support

**Certified Partners**:
- Email support: 24-hour response
- Partner documentation
- Monthly newsletter

**Gold Partners**:
- Email support: 4-hour response
- Dedicated account manager
- Quarterly business reviews
- Early feature access

**Platinum Partners**:
- 24/7 priority support
- Dedicated success team
- Direct Slack channel
- Custom integrations support

### Marketing Support

**All Partners**:
- Partner logo on Snow-Flow website
- Partner directory listing
- Sales enablement materials

**Gold+ Partners**:
- Co-marketing opportunities
- Joint webinars
- Case study development
- Press release support

**Platinum Partners**:
- Joint marketing campaigns
- Speaking opportunities
- Priority event sponsorship
- Custom marketing materials

## Partner Resources

### Documentation
- Partner Portal: https://partners.snow-flow.dev
- API Documentation: https://docs.snow-flow.dev/api
- Sales Materials: https://partners.snow-flow.dev/sales
- Marketing Assets: https://partners.snow-flow.dev/marketing

### Contact
- Partner Support: partners@snow-flow.dev
- Sales Questions: sales@snow-flow.dev
- Technical Support: support@snow-flow.dev

### Community
- Partner Slack: https://slack.snow-flow.dev
- Partner Discord: https://discord.gg/snowflow-partners
- Monthly Partner Calls: First Tuesday of each month

---

## FAQ

### Q: Can I switch between partner types?

Yes! Contact partners@snow-flow.dev to discuss transitioning between partner models.

### Q: How long does partner approval take?

Typically 2-3 business days for Reseller/Referral partners. White-label partnerships may take 1-2 weeks for infrastructure setup.

### Q: Can I be both a Reseller and Referral partner?

Yes! Many partners maintain both relationships - reselling to large customers and referring smaller opportunities.

### Q: What happens when my partner license expires?

You'll receive renewal notices 60, 30, and 7 days before expiration. Your customers remain active, but you won't be able to allocate new seats or receive new commissions until renewed.

### Q: Can I customize pricing for my customers (Reseller)?

Absolutely! Reseller partners set their own retail pricing. We only suggest pricing guidelines - you control your margins.

### Q: How are referral commissions paid?

Monthly via bank transfer, PayPal, or Stripe, with a $100 minimum threshold. All commissions are tracked in your partner portal.

### Q: Can I get a custom commission rate?

Platinum partners with 51+ customers can discuss custom commission structures. Contact partners@snow-flow.dev.

---

**Last Updated**: November 5, 2025
**Version**: 2.0.0
**Program Contact**: partners@snow-flow.dev
