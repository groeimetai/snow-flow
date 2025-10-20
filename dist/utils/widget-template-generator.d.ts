/**
 * ServiceNow Widget Template Generator
 * Generates functional ServiceNow Service Portal widget templates based on requirements
 */
export interface WidgetTemplateOptions {
    title?: string;
    instruction?: string;
    type?: 'dashboard' | 'chart' | 'table' | 'form' | 'info' | 'auto';
    theme?: 'default' | 'dark' | 'minimal';
    responsive?: boolean;
}
export interface WidgetComponents {
    template: string;
    css: string;
    serverScript: string;
    clientScript: string;
    optionSchema: string;
    coherenceReport: WidgetCoherenceReport;
}
export interface WidgetCoherenceReport {
    isCoherent: boolean;
    dataProperties: {
        server: string[];
        html: string[];
        matched: string[];
        missing: string[];
    };
    methods: {
        html: string[];
        client: string[];
        matched: string[];
        missing: string[];
    };
    serverActions: {
        client: string[];
        server: string[];
        matched: string[];
        missing: string[];
    };
    warnings: string[];
    suggestions: string[];
}
export declare class ServiceNowWidgetTemplateGenerator {
    /**
     * Generate complete widget components based on instruction
     */
    generateWidget(options: WidgetTemplateOptions): WidgetComponents;
    /**
     * Detect widget type from instruction
     */
    private detectWidgetType;
    /**
     * Extract widget title from instruction
     */
    private extractTitleFromInstruction;
    /**
     * Generate HTML template based on widget type
     */
    private generateTemplate;
    /**
     * Chart widget template with Chart.js integration
     */
    private generateChartTemplate;
    /**
     * Dashboard widget template with metrics
     */
    private generateDashboardTemplate;
    /**
     * Table widget template with sorting and filtering
     */
    private generateTableTemplate;
    /**
     * Form widget template with validation
     */
    private generateFormTemplate;
    /**
     * Info card widget template (default/generic)
     */
    private generateInfoTemplate;
    /**
     * Generate CSS styles based on widget type and options
     */
    private generateCss;
    private getChartCss;
    private getDashboardCss;
    private getTableCss;
    private getFormCss;
    private getInfoCss;
    private getDarkThemeCss;
    private getMinimalThemeCss;
    private getResponsiveCss;
    /**
     * Generate server script based on widget type
     */
    private generateServerScript;
    /**
     * Generate client script based on widget type
     */
    private generateClientScript;
    /**
     * Generate option schema based on widget type
     */
    private generateOptionSchema;
    /**
     * Validate widget coherence - ensures HTML, client script, and server script work together
     */
    private validateCoherence;
}
export declare const widgetTemplateGenerator: ServiceNowWidgetTemplateGenerator;
//# sourceMappingURL=widget-template-generator.d.ts.map