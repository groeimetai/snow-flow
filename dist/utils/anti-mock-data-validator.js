"use strict";
/**
 * Anti-Mock Data Validator
 *
 * This utility ensures NO mock, demo, sample, or fake data is ever used in any MCP tools.
 * All data must come from real ServiceNow instances.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDataReport = exports.checkDataIntegrity = exports.validateRealData = exports.antiMockValidator = exports.AntiMockDataValidator = void 0;
const logger_js_1 = require("./logger.js");
class AntiMockDataValidator {
    constructor() {
        // Patterns that indicate mock/demo/test data
        this.MOCK_DATA_PATTERNS = [
            // Explicit mock indicators
            /\bmock\b/i,
            /\bdemo\b/i,
            /\bsample\b/i,
            /\btest\b/i,
            /\bfake\b/i,
            /\bplaceholder\b/i,
            /\bdummy\b/i,
            /\bexample\b/i,
            // Common test values
            /^test$/i,
            /^demo$/i,
            /test.*user/i,
            /demo.*user/i,
            /sample.*data/i,
            /example.*com/i,
            /test@test\.com/i,
            /demo@demo\.com/i,
            // Sequential test patterns
            /test\d+/i,
            /demo\d+/i,
            /user\d+$/i,
            /item\d+$/i,
            // Placeholder values
            /^n\/a$/i,
            /^tbd$/i,
            /^to.*be.*determined/i,
            /^pending$/i,
            /^xxx+$/i,
            /^temp/i,
            // Mock ServiceNow patterns
            /^INC\d{7}000\d+$/, // Sequential incident numbers indicating test data
            /^CHG\d{7}000\d+$/, // Sequential change numbers indicating test data
            /^PRB\d{7}000\d+$/, // Sequential problem numbers indicating test data
        ];
        // Suspicious numeric patterns that might indicate generated/mock data
        this.SUSPICIOUS_NUMERIC_PATTERNS = [
            /^123+$/, // 123, 1234, 12345...
            /^999+$/, // 999, 9999, 99999...
            /^111+$/, // 111, 1111, 11111...
            /^000+$/, // 000, 0000, 00000...
            /^(12){2,}$/, // 121212...
            /^(99){2,}$/, // 999999...
        ];
        this.logger = new logger_js_1.Logger('AntiMockDataValidator');
    }
    /**
     * Validate that dataset contains only real ServiceNow data
     */
    validateDataset(data, source = 'unknown') {
        if (!data || data.length === 0) {
            return {
                isValid: false,
                violations: ['Empty dataset - no real data to validate'],
                suspiciousFields: [],
                suspiciousValues: []
            };
        }
        const violations = [];
        const suspiciousFields = [];
        const suspiciousValues = [];
        // Check each record
        data.forEach((record, index) => {
            if (!record || typeof record !== 'object') {
                violations.push(`Record ${index}: Invalid record structure`);
                return;
            }
            // Check each field in the record
            Object.entries(record).forEach(([field, value]) => {
                const fieldViolations = this.validateFieldValue(field, value, source);
                if (fieldViolations.length > 0) {
                    violations.push(`Record ${index}, Field '${field}': ${fieldViolations.join(', ')}`);
                    if (!suspiciousFields.includes(field)) {
                        suspiciousFields.push(field);
                    }
                    if (!suspiciousValues.includes(value)) {
                        suspiciousValues.push(value);
                    }
                }
            });
        });
        // Additional dataset-level checks
        const datasetViolations = this.validateDatasetPatterns(data, source);
        violations.push(...datasetViolations);
        return {
            isValid: violations.length === 0,
            violations,
            suspiciousFields,
            suspiciousValues
        };
    }
    /**
     * Validate individual field value
     */
    validateFieldValue(field, value, source) {
        const violations = [];
        if (value === null || value === undefined) {
            return violations; // Null values are acceptable
        }
        const stringValue = String(value);
        // Check for mock data patterns
        for (const pattern of this.MOCK_DATA_PATTERNS) {
            if (pattern.test(stringValue)) {
                violations.push(`Matches mock data pattern: ${pattern.source}`);
            }
        }
        // Check numeric patterns for suspicious sequences
        if (typeof value === 'number' || /^\d+$/.test(stringValue)) {
            for (const pattern of this.SUSPICIOUS_NUMERIC_PATTERNS) {
                if (pattern.test(stringValue)) {
                    violations.push(`Suspicious numeric pattern: ${stringValue}`);
                }
            }
        }
        // Field-specific validation
        if (field.toLowerCase().includes('email') && stringValue.includes('@')) {
            if (/@(test|demo|example|mock|fake)\.(com|org|net)$/i.test(stringValue)) {
                violations.push('Test/demo email domain detected');
            }
        }
        if (field.toLowerCase().includes('name') || field.toLowerCase().includes('user')) {
            if (/^(test|demo|sample|mock|fake|admin|user)\d*$/i.test(stringValue)) {
                violations.push('Generic test/demo name pattern');
            }
        }
        return violations;
    }
    /**
     * Validate patterns across the entire dataset
     */
    validateDatasetPatterns(data, source) {
        const violations = [];
        // Check for suspiciously uniform data
        if (data.length > 10) {
            const firstRecord = data[0];
            const identicalCount = data.filter(record => JSON.stringify(record) === JSON.stringify(firstRecord)).length;
            if (identicalCount > data.length * 0.8) {
                violations.push('Dataset appears to have too many identical records (possible mock data)');
            }
        }
        // Check for sequential IDs indicating generated data
        const sysIds = data.map(record => record.sys_id).filter(id => id);
        if (sysIds.length > 5) {
            const sequentialCount = this.countSequentialIds(sysIds);
            if (sequentialCount > sysIds.length * 0.7) {
                violations.push('Too many sequential sys_id values (indicates generated test data)');
            }
        }
        // Check creation dates for suspicious patterns
        const createdDates = data.map(record => record.sys_created_on).filter(date => date);
        if (createdDates.length > 5) {
            const simultaneousCreations = this.countSimultaneousCreations(createdDates);
            if (simultaneousCreations > createdDates.length * 0.8) {
                violations.push('Too many records created simultaneously (indicates bulk test data creation)');
            }
        }
        return violations;
    }
    /**
     * Count sequential sys_id patterns
     */
    countSequentialIds(sysIds) {
        let sequentialCount = 0;
        const sortedIds = sysIds.sort();
        for (let i = 1; i < sortedIds.length; i++) {
            const current = sortedIds[i];
            const previous = sortedIds[i - 1];
            // Check if IDs follow a sequential pattern
            if (this.areIdsSequential(previous, current)) {
                sequentialCount++;
            }
        }
        return sequentialCount;
    }
    /**
     * Check if two sys_ids are sequential
     */
    areIdsSequential(id1, id2) {
        if (id1.length !== id2.length)
            return false;
        if (id1.length !== 32)
            return false; // ServiceNow sys_ids are 32 chars
        // Convert hex to numbers and check if they're sequential
        try {
            const num1 = parseInt(id1.slice(-8), 16);
            const num2 = parseInt(id2.slice(-8), 16);
            return Math.abs(num2 - num1) === 1;
        }
        catch {
            return false;
        }
    }
    /**
     * Count records created at exactly the same time
     */
    countSimultaneousCreations(dates) {
        const dateMap = new Map();
        dates.forEach(date => {
            const normalizedDate = new Date(date).toISOString();
            dateMap.set(normalizedDate, (dateMap.get(normalizedDate) || 0) + 1);
        });
        let simultaneousCount = 0;
        dateMap.forEach(count => {
            if (count > 1) {
                simultaneousCount += count;
            }
        });
        return simultaneousCount;
    }
    /**
     * Perform comprehensive data integrity check
     */
    performDataIntegrityCheck(data, source = 'unknown') {
        const validation = this.validateDataset(data, source);
        let qualityScore = 100;
        // Deduct points for violations
        qualityScore -= validation.violations.length * 10;
        qualityScore -= validation.suspiciousFields.length * 5;
        qualityScore -= validation.suspiciousValues.length * 2;
        // Ensure score doesn't go below 0
        qualityScore = Math.max(0, qualityScore);
        return {
            hasRealData: validation.isValid && qualityScore > 70,
            dataQualityScore: qualityScore,
            mockDataDetected: !validation.isValid,
            details: [
                `Validation result: ${validation.isValid ? 'PASSED' : 'FAILED'}`,
                `Total violations: ${validation.violations.length}`,
                `Suspicious fields: ${validation.suspiciousFields.length}`,
                `Data quality score: ${qualityScore}/100`,
                `Source: ${source}`,
                ...validation.violations.slice(0, 5) // Show first 5 violations
            ]
        };
    }
    /**
     * Enforce zero tolerance policy for mock data
     */
    enforceZeroTolerancePolicy(data, source = 'unknown') {
        const validation = this.validateDataset(data, source);
        if (!validation.isValid) {
            const errorMessage = [
                '🚨 MOCK DATA DETECTED - ZERO TOLERANCE POLICY VIOLATED!',
                `Source: ${source}`,
                `Violations found: ${validation.violations.length}`,
                '',
                'Violations:',
                ...validation.violations.slice(0, 10),
                '',
                '❌ This operation has been BLOCKED.',
                '✅ Only REAL ServiceNow data is allowed.',
                '',
                'Please verify your data source and try again with actual ServiceNow records.'
            ].join('\n');
            this.logger.error(errorMessage);
            throw new Error(`Mock data detected in ${source}. Only real ServiceNow data allowed.`);
        }
        this.logger.info(`✅ Data validation passed for ${source} - ${data.length} real records confirmed`);
    }
    /**
     * Generate validation report
     */
    generateValidationReport(data, source = 'unknown') {
        const integrityCheck = this.performDataIntegrityCheck(data, source);
        return [
            '🔥 ANTI-MOCK DATA VALIDATION REPORT',
            '='.repeat(50),
            `📊 Source: ${source}`,
            `📈 Records Analyzed: ${data.length}`,
            `🎯 Data Quality Score: ${integrityCheck.dataQualityScore}/100`,
            `✅ Real Data Status: ${integrityCheck.hasRealData ? 'CONFIRMED' : 'SUSPICIOUS'}`,
            `🚨 Mock Data Detected: ${integrityCheck.mockDataDetected ? 'YES - BLOCKED' : 'NO - SAFE'}`,
            '',
            '📝 Details:',
            ...integrityCheck.details.map(detail => `  - ${detail}`),
            '',
            integrityCheck.hasRealData
                ? '🎉 VALIDATION PASSED - Real ServiceNow data confirmed!'
                : '❌ VALIDATION FAILED - Suspicious data patterns detected!',
            '',
            '🔐 Zero Mock Data Policy: ENFORCED',
            '📋 Only 100% real ServiceNow data allowed'
        ].join('\n');
    }
}
exports.AntiMockDataValidator = AntiMockDataValidator;
// Export singleton instance
exports.antiMockValidator = new AntiMockDataValidator();
// Export validation utilities for use in MCP servers
const validateRealData = (data, source = 'MCP Operation') => {
    return exports.antiMockValidator.enforceZeroTolerancePolicy(data, source);
};
exports.validateRealData = validateRealData;
const checkDataIntegrity = (data, source = 'MCP Operation') => {
    return exports.antiMockValidator.performDataIntegrityCheck(data, source);
};
exports.checkDataIntegrity = checkDataIntegrity;
const generateDataReport = (data, source = 'MCP Operation') => {
    return exports.antiMockValidator.generateValidationReport(data, source);
};
exports.generateDataReport = generateDataReport;
//# sourceMappingURL=anti-mock-data-validator.js.map