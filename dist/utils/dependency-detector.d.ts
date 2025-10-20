/**
 * Dependency Detector for ServiceNow Widgets
 * Automatically detects external libraries used in widget code
 * and manages their installation in Service Portal themes
 */
export interface DependencyInfo {
    name: string;
    version?: string;
    cdnUrl: string;
    minifiedUrl?: string;
    integrity?: string;
    type: 'js' | 'css';
    description: string;
    detectionPatterns: RegExp[];
}
export declare const KNOWN_DEPENDENCIES: DependencyInfo[];
export declare class DependencyDetector {
    /**
     * Detect dependencies in widget code
     */
    static detectDependencies(code: string): DependencyInfo[];
    /**
     * Analyze widget for dependencies
     */
    static analyzeWidget(widget: {
        template?: string;
        css?: string;
        client_script?: string;
        script?: string;
    }): DependencyInfo[];
    /**
     * Generate script tags for dependencies
     */
    static generateScriptTags(dependencies: DependencyInfo[], useMinified?: boolean): string;
    /**
     * Check if a dependency is likely already loaded
     */
    static isDependencyLoaded(themeContent: string, dependency: DependencyInfo): boolean;
    /**
     * Get missing dependencies from theme
     */
    static getMissingDependencies(detectedDeps: DependencyInfo[], themeContent: string): DependencyInfo[];
}
//# sourceMappingURL=dependency-detector.d.ts.map