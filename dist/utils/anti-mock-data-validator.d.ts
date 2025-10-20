/**
 * Anti-Mock Data Validator
 *
 * This utility ensures NO mock, demo, sample, or fake data is ever used in any MCP tools.
 * All data must come from real ServiceNow instances.
 */
interface ValidationResult {
    isValid: boolean;
    violations: string[];
    suspiciousFields: string[];
    suspiciousValues: any[];
}
interface DataIntegrityCheck {
    hasRealData: boolean;
    dataQualityScore: number;
    mockDataDetected: boolean;
    details: string[];
}
export declare class AntiMockDataValidator {
    private logger;
    private readonly MOCK_DATA_PATTERNS;
    private readonly SUSPICIOUS_NUMERIC_PATTERNS;
    constructor();
    /**
     * Validate that dataset contains only real ServiceNow data
     */
    validateDataset(data: any[], source?: string): ValidationResult;
    /**
     * Validate individual field value
     */
    private validateFieldValue;
    /**
     * Validate patterns across the entire dataset
     */
    private validateDatasetPatterns;
    /**
     * Count sequential sys_id patterns
     */
    private countSequentialIds;
    /**
     * Check if two sys_ids are sequential
     */
    private areIdsSequential;
    /**
     * Count records created at exactly the same time
     */
    private countSimultaneousCreations;
    /**
     * Perform comprehensive data integrity check
     */
    performDataIntegrityCheck(data: any[], source?: string): DataIntegrityCheck;
    /**
     * Enforce zero tolerance policy for mock data
     */
    enforceZeroTolerancePolicy(data: any[], source?: string): void;
    /**
     * Generate validation report
     */
    generateValidationReport(data: any[], source?: string): string;
}
export declare const antiMockValidator: AntiMockDataValidator;
export declare const validateRealData: (data: any[], source?: string) => void;
export declare const checkDataIntegrity: (data: any[], source?: string) => DataIntegrityCheck;
export declare const generateDataReport: (data: any[], source?: string) => string;
export {};
//# sourceMappingURL=anti-mock-data-validator.d.ts.map