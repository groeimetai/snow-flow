"use strict";
/**
 * Dependency Detector for ServiceNow Widgets
 * Automatically detects external libraries used in widget code
 * and manages their installation in Service Portal themes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyDetector = exports.KNOWN_DEPENDENCIES = void 0;
const logger_1 = require("../utils/logger");
// Common libraries used in ServiceNow widgets
exports.KNOWN_DEPENDENCIES = [
    {
        name: 'Chart.js',
        version: '4.4.1',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
        type: 'js',
        description: 'Simple yet flexible JavaScript charting library',
        detectionPatterns: [
            /new\s+Chart\s*\(/gi,
            /Chart\.register/gi,
            /Chart\.defaults/gi,
            /require\s*\(\s*['"]chart\.js['"]\s*\)/gi,
            /import.*from\s+['"]chart\.js['"]/gi
        ]
    },
    {
        name: 'moment.js',
        version: '2.29.4',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.js',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js',
        type: 'js',
        description: 'Parse, validate, manipulate, and display dates and times',
        detectionPatterns: [
            /moment\s*\(/gi,
            /moment\.utc/gi,
            /moment\.format/gi,
            /require\s*\(\s*['"]moment['"]\s*\)/gi,
            /import.*from\s+['"]moment['"]/gi
        ]
    },
    {
        name: 'lodash',
        version: '4.17.21',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.js',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js',
        type: 'js',
        description: 'Modern JavaScript utility library',
        detectionPatterns: [
            /_\.\w+\s*\(/gi,
            /lodash\.\w+/gi,
            /require\s*\(\s*['"]lodash['"]\s*\)/gi,
            /import.*from\s+['"]lodash['"]/gi
        ]
    },
    {
        name: 'd3.js',
        version: '7.8.5',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.js',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js',
        type: 'js',
        description: 'Data-Driven Documents - powerful visualization library',
        detectionPatterns: [
            /d3\.\w+\s*\(/gi,
            /d3\.select/gi,
            /d3\.scale/gi,
            /require\s*\(\s*['"]d3['"]\s*\)/gi,
            /import.*from\s+['"]d3['"]/gi
        ]
    },
    {
        name: 'axios',
        version: '1.6.5',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/axios@1.6.5/dist/axios.js',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/axios@1.6.5/dist/axios.min.js',
        type: 'js',
        description: 'Promise based HTTP client',
        detectionPatterns: [
            /axios\.\w+\s*\(/gi,
            /axios\.get/gi,
            /axios\.post/gi,
            /require\s*\(\s*['"]axios['"]\s*\)/gi,
            /import.*from\s+['"]axios['"]/gi
        ]
    },
    {
        name: 'jQuery',
        version: '3.7.1',
        cdnUrl: 'https://code.jquery.com/jquery-3.7.1.js',
        minifiedUrl: 'https://code.jquery.com/jquery-3.7.1.min.js',
        integrity: 'sha256-eKhayi8LEQwp4NKxN+CfCh+3qOVUtJn3QNZ0TciWLP4=',
        type: 'js',
        description: 'jQuery JavaScript Library',
        detectionPatterns: [
            /\$\s*\(/gi,
            /jQuery\s*\(/gi,
            /\$\.ajax/gi,
            /\$\.\w+\s*\(/gi,
            /require\s*\(\s*['"]jquery['"]\s*\)/gi
        ]
    },
    {
        name: 'Bootstrap',
        version: '5.3.2',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.js',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
        type: 'js',
        description: 'Bootstrap JavaScript bundle',
        detectionPatterns: [
            /bootstrap\.\w+/gi,
            /new\s+bootstrap\.\w+/gi,
            /data-bs-\w+/gi,
            /class=["'].*\b(btn|modal|dropdown|collapse)\b/gi
        ]
    },
    {
        name: 'Bootstrap CSS',
        version: '5.3.2',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.css',
        minifiedUrl: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
        type: 'css',
        description: 'Bootstrap CSS framework',
        detectionPatterns: [
            /class=["'].*\b(container|row|col-|btn-|alert-|modal-)\b/gi,
            /@import.*bootstrap/gi
        ]
    }
];
class DependencyDetector {
    /**
     * Detect dependencies in widget code
     */
    static detectDependencies(code) {
        const detectedDeps = [];
        const codeToAnalyze = code.toLowerCase();
        for (const dep of exports.KNOWN_DEPENDENCIES) {
            for (const pattern of dep.detectionPatterns) {
                if (pattern.test(code)) {
                    // Avoid duplicates
                    if (!detectedDeps.find(d => d.name === dep.name)) {
                        detectedDeps.push(dep);
                        logger_1.logger.info(`🔍 Detected dependency: ${dep.name}`);
                    }
                    break;
                }
            }
        }
        return detectedDeps;
    }
    /**
     * Analyze widget for dependencies
     */
    static analyzeWidget(widget) {
        const allCode = [
            widget.template || '',
            widget.css || '',
            widget.client_script || '',
            widget.script || ''
        ].join('\n');
        return this.detectDependencies(allCode);
    }
    /**
     * Generate script tags for dependencies
     */
    static generateScriptTags(dependencies, useMinified = true) {
        const tags = [];
        for (const dep of dependencies) {
            const url = useMinified && dep.minifiedUrl ? dep.minifiedUrl : dep.cdnUrl;
            if (dep.type === 'js') {
                if (dep.integrity) {
                    tags.push(`<script src="${url}" integrity="${dep.integrity}" crossorigin="anonymous"></script>`);
                }
                else {
                    tags.push(`<script src="${url}"></script>`);
                }
            }
            else if (dep.type === 'css') {
                if (dep.integrity) {
                    tags.push(`<link rel="stylesheet" href="${url}" integrity="${dep.integrity}" crossorigin="anonymous">`);
                }
                else {
                    tags.push(`<link rel="stylesheet" href="${url}">`);
                }
            }
        }
        return tags.join('\n');
    }
    /**
     * Check if a dependency is likely already loaded
     */
    static isDependencyLoaded(themeContent, dependency) {
        // Check for various patterns that indicate the library is already loaded
        const patterns = [
            new RegExp(dependency.name.replace('.', '\\.'), 'i'),
            new RegExp(dependency.cdnUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
            new RegExp(dependency.minifiedUrl?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '', 'i')
        ];
        return patterns.some(pattern => pattern.test(themeContent));
    }
    /**
     * Get missing dependencies from theme
     */
    static getMissingDependencies(detectedDeps, themeContent) {
        return detectedDeps.filter(dep => !this.isDependencyLoaded(themeContent, dep));
    }
}
exports.DependencyDetector = DependencyDetector;
//# sourceMappingURL=dependency-detector.js.map