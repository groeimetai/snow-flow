/**
 * Partner Program Types for Snow-Flow
 *
 * Two-track partner model:
 * 1. Reseller Partners - Wholesale pricing for resale business
 * 2. Solution Partners - Referral fees for implementation/consulting
 */

export enum PartnerType {
  RESELLER = 'reseller',    // Wholesale model: buy seats, resell
  SOLUTION = 'solution'      // Referral model: refer customers, earn commission
}

/**
 * Partner License Configuration
 */
export interface PartnerLicense {
  // Core identification
  licenseKey: string;
  partnerId: string;
  partnerName: string;
  partnerType: PartnerType;

  // Dates
  activatedAt: Date;
  expiresAt: Date;

  // Type-specific configuration
  resellerConfig?: ResellerConfig;
  solutionConfig?: SolutionConfig;

  // Status
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
}

/**
 * Reseller Partner Configuration
 * Buy seats at wholesale, resell at your own pricing
 */
export interface ResellerConfig {
  // Wholesale pricing
  wholesalePrice: number;       // $69/seat/year
  purchasedSeats: number;       // Total seats purchased
  allocatedSeats: number;       // Seats allocated to customers
  availableSeats: number;       // Seats still available

  // Billing
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  nextBillingDate: Date;
  totalRevenue: number;         // Total revenue from this partner

  // Optional features
  whitelabel?: {
    enabled: boolean;
    brandName?: string;
    logo?: {
      url: string;
      width: number;
      height: number;
    };
    colors?: {
      primary: string;
      secondary?: string;
      accent?: string;
    };
    customDomain?: string;
  };

  // Support level
  dedicatedSupport: boolean;
  prioritySupport: boolean;
}

/**
 * Solution Partner Configuration
 * Refer customers, earn commission on their subscriptions
 */
export interface SolutionConfig {
  // Commission rates
  year1CommissionRate: number;      // 15% first year
  year2PlusCommissionRate: number;  // 10% ongoing

  // Referrals tracking
  totalReferrals: number;           // Total customers referred
  activeReferrals: number;          // Currently active referrals
  totalSeats: number;               // Total seats across referrals

  // Revenue tracking
  monthlyRecurringRevenue: number;  // MRR from all referrals
  lifetimeCommissions: number;      // Total paid to date
  currentMonthCommission: number;   // This month's commission

  // Referral system
  referralCode: string;             // Unique code (e.g., SOLUTION-ACME)
  referralLink: string;             // Tracking link

  // Payment
  paymentMethod: 'bank_transfer' | 'paypal' | 'stripe';
  paymentDetails?: Record<string, string>;
  paymentSchedule: 'monthly' | 'quarterly';
  nextPaymentDate: Date;

  // Benefits
  certificationLevel: 'certified' | 'advanced' | 'expert';
  coMarketingEnabled: boolean;
}

/**
 * Partner Customer (end customer of partner)
 */
export interface PartnerCustomer {
  customerId: string;
  customerName: string;
  partnerId: string;
  partnerType: PartnerType;

  // Subscription
  subscriptionId: string;
  seats: {
    developer: number;
    stakeholder: number;
  };

  // Dates
  startDate: Date;
  renewalDate: Date;

  // Billing type
  billingType: 'partner_managed' | 'snowflow_managed';

  // Partner-specific data
  resellerData?: {
    seatAllocationId: string;
    partnerPricing?: number;        // What partner charged
  };

  solutionData?: {
    referralCode: string;
    monthlyValue: number;           // Monthly subscription value
    commissionRate: number;         // Current commission rate
  };
}

/**
 * Partner Metrics
 */
export interface PartnerMetrics {
  partnerId: string;
  partnerType: PartnerType;
  period: {
    start: Date;
    end: Date;
  };

  // Customer metrics
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  retentionRate: number;

  // Revenue metrics
  totalRevenue: number;
  averageRevenuePerCustomer: number;

  // Seat metrics
  totalSeats: number;
  developerSeats: number;
  stakeholderSeats: number;
  seatUtilization?: number;         // For resellers only

  // Partner earnings
  commissionEarned?: number;        // For solution partners
  estimatedMargin?: number;         // For resellers

  // Growth
  monthOverMonthGrowth: number;
  yearOverYearGrowth: number;
}

/**
 * Partner Portal Access
 */
export interface PartnerPortalAccess {
  partnerId: string;
  userId: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';

  permissions: {
    manageLicenses: boolean;
    viewAnalytics: boolean;
    manageCustomers: boolean;
    manageBilling: boolean;
    manageUsers: boolean;
    accessSupport: boolean;
  };

  lastLogin: Date;
  isActive: boolean;
  mfaEnabled: boolean;
}

/**
 * Partner Application
 */
export interface PartnerApplication {
  applicationId: string;
  status: 'pending' | 'approved' | 'rejected';

  // Company info
  companyName: string;
  companyWebsite: string;
  companySize: string;
  industry: string;

  // Contact
  primaryContact: {
    name: string;
    email: string;
    phone: string;
    title: string;
  };

  // Partner track interest
  interestedTrack: 'reseller' | 'solution' | 'both';

  // For resellers
  estimatedAnnualSeats?: string;
  hasExistingCustomers?: boolean;
  existingCustomerCount?: number;

  // For solution partners
  servicenowExperience?: 'none' | 'basic' | 'intermediate' | 'expert';
  servicenowCertifications?: string[];
  servicenowPartnerStatus?: string;

  // Business case
  whyPartner: string;
  targetMarket: string;
  competitiveAdvantage: string;

  // Application dates
  submittedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  reviewNotes?: string;
  reviewedBy?: string;
}

/**
 * Partner Pricing Configuration
 */
export const PARTNER_PRICING = {
  // Reseller track pricing
  reseller: {
    wholesalePerSeat: 69,          // $69/seat/year
    minimumOrder: 25,              // Minimum 25 seats commitment
    suggestedRetail: 99,           // Suggest $99/seat retail
    margin: 0.30,                  // 30% margin at suggested retail

    // Volume discounts
    tiers: [
      { min: 25, max: 99, price: 69 },    // $69/seat for 25-99 seats
      { min: 100, max: 499, price: 59 },  // $59/seat for 100-499 seats
      { min: 500, max: Infinity, price: 49 } // $49/seat for 500+ seats
    ],

    // White-label add-on
    whitelabel: {
      setupFee: 2500,              // One-time $2,500
      monthlyFee: 500,             // $500/month
      customDomain: true,
      customBranding: true
    }
  },

  // Solution track pricing (commission-based)
  solution: {
    setupFee: 0,                   // No upfront cost
    year1Commission: 0.15,         // 15% first year
    year2PlusCommission: 0.10,     // 10% ongoing
    minimumPayout: 100,            // $100 minimum for payout

    // Certification levels
    certificationBenefits: {
      certified: {
        year1: 0.15,
        year2Plus: 0.10,
        coMarketing: false
      },
      advanced: {
        year1: 0.18,
        year2Plus: 0.12,
        coMarketing: true
      },
      expert: {
        year1: 0.20,
        year2Plus: 0.15,
        coMarketing: true
      }
    }
  }
} as const;

/**
 * Partner Benefits by Type
 */
export const PARTNER_BENEFITS = {
  reseller: {
    name: 'Reseller Partner',
    description: 'Buy wholesale, resell at your own pricing',
    benefits: [
      'Wholesale pricing: $69/seat (30% margin)',
      'Volume discounts up to $49/seat',
      'Partner dashboard & seat management',
      'Deal registration system',
      'NFR licenses for demos',
      'Sales enablement & training',
      'Co-marketing support',
      'White-label option ($500/mo)'
    ],
    idealFor: [
      'VARs & Resellers',
      'Managed Service Providers (MSPs)',
      'ServiceNow distributors',
      'IT service companies'
    ]
  },

  solution: {
    name: 'Solution Partner',
    description: 'Refer customers, earn recurring commission',
    benefits: [
      'No upfront costs or inventory',
      '15% commission Year 1',
      '10% recurring commission Year 2+',
      'Partner referral dashboard',
      'Lead registration system',
      'Implementation training',
      'Technical enablement',
      'Co-marketing opportunities'
    ],
    idealFor: [
      'ServiceNow consultants',
      'Implementation partners',
      'System integrators',
      'ServiceNow specialists'
    ]
  }
} as const;
