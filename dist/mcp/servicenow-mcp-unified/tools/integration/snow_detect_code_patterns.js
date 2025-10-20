"use strict";
/**
 * snow_detect_code_patterns - Code pattern detection and analysis
 *
 * Detect common code patterns, anti-patterns, and best practices
 * in ServiceNow scripts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_detect_code_patterns',
    description: 'Detect code patterns, anti-patterns, and best practices in ServiceNow scripts',
    inputSchema: {
        type: 'object',
        properties: {
            code: {
                type: 'string',
                description: 'JavaScript code to analyze'
            },
            check_es5: {
                type: 'boolean',
                description: 'Check for ES5 compliance',
                default: true
            },
            check_performance: {
                type: 'boolean',
                description: 'Check for performance anti-patterns',
                default: true
            },
            check_security: {
                type: 'boolean',
                description: 'Check for security issues',
                default: true
            },
            check_best_practices: {
                type: 'boolean',
                description: 'Check ServiceNow best practices',
                default: true
            }
        },
        required: ['code']
    }
};
async function execute(args, context) {
    const { code, check_es5 = true, check_performance = true, check_security = true, check_best_practices = true } = args;
    try {
        const patterns = {
            es5_violations: [],
            performance_issues: [],
            security_issues: [],
            best_practice_violations: [],
            good_patterns: []
        };
        // ES5 Compliance Check
        if (check_es5) {
            const es5Patterns = [
                { regex: /\bconst\s+/g, type: 'const', message: 'Use var instead of const' },
                { regex: /\blet\s+/g, type: 'let', message: 'Use var instead of let' },
                { regex: /=>\s*{|=>\s*\(/g, type: 'arrow_function', message: 'Use function() {} instead of arrow functions' },
                { regex: /`[^`]*`/g, type: 'template_literal', message: 'Use string concatenation instead of template literals' },
                { regex: /\.\.\./g, type: 'spread', message: 'Spread operator not supported in ES5' },
                { regex: /class\s+\w+/g, type: 'class', message: 'Use function constructors instead of classes' }
            ];
            es5Patterns.forEach(pattern => {
                const matches = code.match(pattern.regex);
                if (matches) {
                    patterns.es5_violations.push({
                        type: pattern.type,
                        count: matches.length,
                        message: pattern.message,
                        severity: 'error'
                    });
                }
            });
        }
        // Performance Anti-patterns
        if (check_performance) {
            const performancePatterns = [
                {
                    regex: /while\s*\(\s*gr\.next\(\)/g,
                    type: 'unbounded_while_loop',
                    message: 'Use for loop with limit instead of unbounded while(gr.next())',
                    severity: 'high'
                },
                {
                    regex: /new\s+GlideRecord\([^)]+\)[^}]*\{[^}]*new\s+GlideRecord/g,
                    type: 'nested_gliderecord',
                    message: 'Nested GlideRecord queries can cause performance issues',
                    severity: 'high'
                },
                {
                    regex: /gr\.query\(\)[^}]*while[^}]*gr\.getValue/g,
                    type: 'getValue_in_loop',
                    message: 'Repeated getValue() calls in loop - cache values instead',
                    severity: 'medium'
                },
                {
                    regex: /gs\.getUser\(\)\.getID\(\)/g,
                    type: 'repeated_getUser',
                    message: 'Cache gs.getUser() result instead of calling repeatedly',
                    severity: 'low'
                }
            ];
            performancePatterns.forEach(pattern => {
                if (pattern.regex.test(code)) {
                    patterns.performance_issues.push({
                        type: pattern.type,
                        message: pattern.message,
                        severity: pattern.severity
                    });
                }
            });
        }
        // Security Issues
        if (check_security) {
            const securityPatterns = [
                {
                    regex: /eval\s*\(/g,
                    type: 'eval_usage',
                    message: 'eval() is a security risk - avoid using it',
                    severity: 'critical'
                },
                {
                    regex: /gs\.executeNow\s*\(/g,
                    type: 'executeNow',
                    message: 'gs.executeNow() can bypass security - use with caution',
                    severity: 'high'
                },
                {
                    regex: /setWorkflow\s*\(\s*false\s*\)/g,
                    type: 'workflow_bypass',
                    message: 'Disabling workflow can bypass business rules',
                    severity: 'medium'
                },
                {
                    regex: /password|pwd|secret|api[_-]?key/gi,
                    type: 'hardcoded_credentials',
                    message: 'Possible hardcoded credentials - use system properties instead',
                    severity: 'critical'
                }
            ];
            securityPatterns.forEach(pattern => {
                if (pattern.regex.test(code)) {
                    patterns.security_issues.push({
                        type: pattern.type,
                        message: pattern.message,
                        severity: pattern.severity
                    });
                }
            });
        }
        // ServiceNow Best Practices
        if (check_best_practices) {
            const bestPractices = [
                {
                    regex: /gr\.query\(\)[^}]*if\s*\(\s*gr\.next/g,
                    type: 'missing_query_limit',
                    message: 'Add setLimit() before query() for better performance',
                    severity: 'medium'
                },
                {
                    regex: /current\./g,
                    type: 'current_object',
                    message: 'Using current object - ensure it exists in context',
                    severity: 'info',
                    isGood: true
                },
                {
                    regex: /try\s*\{[^}]*\}\s*catch/g,
                    type: 'error_handling',
                    message: 'Good: Error handling implemented',
                    severity: 'info',
                    isGood: true
                },
                {
                    regex: /gs\.(info|warn|error|debug)\(/g,
                    type: 'logging',
                    message: 'Good: Logging statements present',
                    severity: 'info',
                    isGood: true
                }
            ];
            bestPractices.forEach(pattern => {
                if (pattern.regex.test(code)) {
                    if (pattern.isGood) {
                        patterns.good_patterns.push({
                            type: pattern.type,
                            message: pattern.message
                        });
                    }
                    else {
                        patterns.best_practice_violations.push({
                            type: pattern.type,
                            message: pattern.message,
                            severity: pattern.severity
                        });
                    }
                }
            });
        }
        // Calculate overall score
        const criticalIssues = [
            ...patterns.es5_violations.filter((v) => v.severity === 'error'),
            ...patterns.security_issues.filter((i) => i.severity === 'critical')
        ].length;
        const highIssues = [
            ...patterns.performance_issues.filter((i) => i.severity === 'high'),
            ...patterns.security_issues.filter((i) => i.severity === 'high')
        ].length;
        const totalIssues = patterns.es5_violations.length +
            patterns.performance_issues.length +
            patterns.security_issues.length +
            patterns.best_practice_violations.length;
        let codeQuality = 'excellent';
        if (criticalIssues > 0) {
            codeQuality = 'critical';
        }
        else if (highIssues > 2) {
            codeQuality = 'poor';
        }
        else if (totalIssues > 5) {
            codeQuality = 'moderate';
        }
        else if (totalIssues > 0) {
            codeQuality = 'good';
        }
        return (0, error_handler_js_1.createSuccessResult)({
            patterns,
            summary: {
                total_issues: totalIssues,
                critical_issues: criticalIssues,
                high_priority_issues: highIssues,
                good_patterns_found: patterns.good_patterns.length,
                code_quality: codeQuality
            },
            recommendations: generateRecommendations(patterns),
            es5_compliant: patterns.es5_violations.length === 0
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
function generateRecommendations(patterns) {
    const recommendations = [];
    if (patterns.es5_violations.length > 0) {
        recommendations.push('Convert all ES6+ syntax to ES5 for ServiceNow compatibility');
    }
    if (patterns.security_issues.some((i) => i.severity === 'critical')) {
        recommendations.push('Address critical security issues immediately');
    }
    if (patterns.performance_issues.length > 0) {
        recommendations.push('Optimize performance by addressing identified anti-patterns');
    }
    if (patterns.best_practice_violations.length > 3) {
        recommendations.push('Review ServiceNow best practices and update code accordingly');
    }
    if (recommendations.length === 0) {
        recommendations.push('Code follows ServiceNow best practices');
    }
    return recommendations;
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_detect_code_patterns.js.map