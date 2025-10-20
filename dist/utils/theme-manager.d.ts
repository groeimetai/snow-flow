/**
 * Service Portal Theme Manager
 * Handles automatic dependency injection into Service Portal themes
 */
import { DependencyInfo } from './dependency-detector';
export interface ThemeUpdateOptions {
    autoPermissions?: boolean;
    skipPrompt?: boolean;
    useMinified?: boolean;
    themeId?: string;
    themeName?: string;
}
export interface ThemeInfo {
    sys_id: string;
    name: string;
    css_variables?: string;
    footer?: string;
    header?: string;
    js_includes?: string;
}
export declare class ServicePortalThemeManager {
    /**
     * Update Service Portal theme with dependencies
     */
    static updateThemeWithDependencies(dependencies: DependencyInfo[], mcpTools: any, options?: ThemeUpdateOptions): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Find Service Portal theme
     */
    private static findTheme;
    /**
     * Prompt user for dependency installation
     */
    private static promptForDependencies;
    /**
     * Inject dependencies into theme header
     */
    private static injectDependencies;
    /**
     * Update theme in ServiceNow
     */
    private static updateTheme;
    /**
     * Check if widget requires dependencies and handle installation
     */
    static handleWidgetDependencies(widgetConfig: any, mcpTools: any, options?: ThemeUpdateOptions): Promise<{
        dependencies: DependencyInfo[];
        installed: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=theme-manager.d.ts.map