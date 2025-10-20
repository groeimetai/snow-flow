/**
 * Template Engine for Dynamic Artifact Generation
 * Replaces hardcoded artifact implementations with flexible templates
 */
export interface TemplateVariables {
    [key: string]: string | number | boolean;
}
export interface Template {
    type: string;
    name: string;
    description: string;
    category?: string;
    config: any;
    variables?: TemplateVariables;
}
export declare class TemplateEngine {
    private templatesPath;
    constructor(templatesPath?: string);
    /**
     * Load a template from file
     */
    loadTemplate(templatePath: string): Promise<Template>;
    /**
     * Process template with variables
     */
    processTemplate(template: Template, variables?: TemplateVariables): any;
    /**
     * Create artifact from template
     */
    createFromTemplate(templateName: string, variables?: TemplateVariables): Promise<any>;
    /**
     * Get available templates
     */
    getAvailableTemplates(type?: string, category?: string): Promise<Template[]>;
    /**
     * Get templates from a directory
     */
    private getTemplatesFromDirectory;
    /**
     * Check if directory exists
     */
    private directoryExists;
    /**
     * Create example from template
     */
    createExample(templateName: string, exampleName: string, variables: TemplateVariables): Promise<void>;
    /**
     * Validate template structure
     */
    validateTemplate(template: Template): string[];
    /**
     * Generate artifact from natural language
     */
    generateFromDescription(description: string, type?: string): Promise<any>;
    /**
     * Select the best template based on natural language description
     */
    private selectBestTemplate;
    /**
     * Score a template based on how well it matches the description
     */
    private scoreTemplate;
    /**
     * Extract variables from natural language description
     */
    private extractVariablesFromDescription;
    /**
     * Apply intelligent defaults based on context
     */
    private applyIntelligentDefaults;
    /**
     * Create from pattern template
     */
    createFromPattern(pattern: string, variables?: TemplateVariables): Promise<any>;
}
//# sourceMappingURL=template-engine.d.ts.map