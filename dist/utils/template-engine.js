"use strict";
/**
 * Template Engine for Dynamic Artifact Generation
 * Replaces hardcoded artifact implementations with flexible templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateEngine = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class TemplateEngine {
    constructor(templatesPath) {
        this.templatesPath = templatesPath || (0, path_1.join)(process.cwd(), 'src', 'templates');
    }
    /**
     * Load a template from file
     */
    async loadTemplate(templatePath) {
        const fullPath = (0, path_1.join)(this.templatesPath, templatePath);
        const content = await fs_1.promises.readFile(fullPath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * Process template with variables
     */
    processTemplate(template, variables = {}) {
        // Merge provided variables with defaults
        const allVariables = {
            ...template.variables,
            ...variables
        };
        // Convert template to string for processing
        let templateStr = JSON.stringify(template.config);
        // Replace all variable placeholders
        for (const [key, value] of Object.entries(allVariables)) {
            // Replace {{KEY}} with value
            const regex = new RegExp(`{{${key}}}`, 'g');
            templateStr = templateStr.replace(regex, String(value));
            // Replace {{KEY|default}} with value or default
            const defaultRegex = new RegExp(`{{${key}\\|([^}]+)}}`, 'g');
            templateStr = templateStr.replace(defaultRegex, String(value));
        }
        // Replace any remaining {{KEY|default}} patterns with defaults
        templateStr = templateStr.replace(/{{[^|]+\|([^}]+)}}/g, '$1');
        // Remove any unmatched placeholders
        templateStr = templateStr.replace(/{{[^}]+}}/g, '');
        // Parse back to object
        const processed = JSON.parse(templateStr);
        // Add metadata
        return {
            ...processed,
            _template: {
                source: template.name,
                type: template.type,
                processed_at: new Date().toISOString()
            }
        };
    }
    /**
     * Create artifact from template
     */
    async createFromTemplate(templateName, variables = {}) {
        // Load base template
        const templatePath = `base/${templateName}.template.json`;
        const template = await this.loadTemplate(templatePath);
        // Process with variables
        return this.processTemplate(template, variables);
    }
    /**
     * Get available templates
     */
    async getAvailableTemplates(type, category) {
        const templates = [];
        // Check base directory
        const baseDir = (0, path_1.join)(this.templatesPath, 'base');
        if (await this.directoryExists(baseDir)) {
            const baseTemplates = await this.getTemplatesFromDirectory(baseDir);
            templates.push(...baseTemplates);
        }
        // Check patterns directory
        const patternsDir = (0, path_1.join)(this.templatesPath, 'patterns');
        if (await this.directoryExists(patternsDir)) {
            const patternTemplates = await this.getTemplatesFromDirectory(patternsDir);
            templates.push(...patternTemplates);
        }
        // Filter by type and category if specified
        return templates.filter(template => {
            if (type && template.type !== type)
                return false;
            if (category && template.category !== category)
                return false;
            return true;
        });
    }
    /**
     * Get templates from a directory
     */
    async getTemplatesFromDirectory(dir) {
        const templates = [];
        const files = await fs_1.promises.readdir(dir);
        for (const file of files) {
            if (file.endsWith('.template.json')) {
                try {
                    const relativePath = (0, path_1.join)(dir, file).replace(this.templatesPath + '/', '');
                    const template = await this.loadTemplate(relativePath);
                    templates.push(template);
                }
                catch (error) {
                    console.error(`Error loading template ${file}:`, error);
                }
            }
        }
        return templates;
    }
    /**
     * Check if directory exists
     */
    async directoryExists(path) {
        try {
            const stat = await fs_1.promises.stat(path);
            return stat.isDirectory();
        }
        catch {
            return false;
        }
    }
    /**
     * Create example from template
     */
    async createExample(templateName, exampleName, variables) {
        const artifact = await this.createFromTemplate(templateName, variables);
        // Save to examples directory
        const exampleDir = (0, path_1.join)(this.templatesPath, 'examples', exampleName);
        await fs_1.promises.mkdir(exampleDir, { recursive: true });
        const outputPath = (0, path_1.join)(exampleDir, `${exampleName}.json`);
        await fs_1.promises.writeFile(outputPath, JSON.stringify(artifact, null, 2));
    }
    /**
     * Validate template structure
     */
    validateTemplate(template) {
        const errors = [];
        if (!template.type) {
            errors.push('Template must have a type');
        }
        if (!template.name) {
            errors.push('Template must have a name');
        }
        if (!template.config) {
            errors.push('Template must have a config section');
        }
        // Type-specific validation
        switch (template.type) {
            case 'widget':
                if (!template.config.template) {
                    errors.push('Widget template must have HTML template');
                }
                break;
            case 'flow':
                if (!template.config.flow_definition) {
                    errors.push('Flow template must have flow_definition');
                }
                break;
            case 'script_include':
                if (!template.config.script) {
                    errors.push('Script include template must have script');
                }
                break;
        }
        return errors;
    }
    /**
     * Generate artifact from natural language
     */
    async generateFromDescription(description, type) {
        // Determine the best template based on description
        const template = await this.selectBestTemplate(description, type);
        // Extract variables from description
        const variables = this.extractVariablesFromDescription(description, template);
        // Process template with extracted variables
        return this.processTemplate(template, variables);
    }
    /**
     * Select the best template based on natural language description
     */
    async selectBestTemplate(description, preferredType) {
        const lowerDesc = description.toLowerCase();
        // Determine type if not specified
        let type = preferredType;
        if (!type) {
            if (lowerDesc.includes('widget') || lowerDesc.includes('dashboard') || lowerDesc.includes('visualization')) {
                type = 'widget';
            }
            else if (lowerDesc.includes('flow') || lowerDesc.includes('workflow') || lowerDesc.includes('approval')) {
                type = 'flow';
            }
            else if (lowerDesc.includes('script') || lowerDesc.includes('utility') || lowerDesc.includes('function')) {
                type = 'script_include';
            }
            else if (lowerDesc.includes('rule') || lowerDesc.includes('trigger')) {
                type = 'business_rule';
            }
            else if (lowerDesc.includes('table') || lowerDesc.includes('data model')) {
                type = 'table';
            }
        }
        // Get available templates of this type
        const templates = await this.getAvailableTemplates(type);
        // Score templates based on description match
        let bestTemplate = null;
        let bestScore = 0;
        for (const template of templates) {
            const score = this.scoreTemplate(template, description);
            if (score > bestScore) {
                bestScore = score;
                bestTemplate = template;
            }
        }
        // Fallback to base template if no good match
        if (!bestTemplate) {
            const basePath = `base/${type}.template.json`;
            bestTemplate = await this.loadTemplate(basePath);
        }
        return bestTemplate;
    }
    /**
     * Score a template based on how well it matches the description
     */
    scoreTemplate(template, description) {
        let score = 0;
        const lowerDesc = description.toLowerCase();
        const lowerTemplateName = template.name.toLowerCase();
        const lowerTemplateDesc = template.description.toLowerCase();
        // Check template name
        const nameWords = lowerTemplateName.split(/\s+/);
        for (const word of nameWords) {
            if (lowerDesc.includes(word) && word.length > 3) {
                score += 2;
            }
        }
        // Check template description
        const descWords = lowerTemplateDesc.split(/\s+/);
        for (const word of descWords) {
            if (lowerDesc.includes(word) && word.length > 3) {
                score += 1;
            }
        }
        // Pattern-specific scoring
        if (template.category) {
            if (template.category.includes('dashboard') && lowerDesc.includes('dashboard'))
                score += 5;
            if (template.category.includes('approval') && lowerDesc.includes('approval'))
                score += 5;
            if (template.category.includes('integration') && (lowerDesc.includes('integrate') || lowerDesc.includes('api')))
                score += 5;
            if (template.category.includes('datatable') && (lowerDesc.includes('table') || lowerDesc.includes('list')))
                score += 5;
        }
        return score;
    }
    /**
     * Extract variables from natural language description
     */
    extractVariablesFromDescription(description, template) {
        const variables = {};
        const lowerDesc = description.toLowerCase();
        // Extract name variants
        const nameMatch = description.match(/(?:create|build|make)\s+(?:a|an)?\s*([^,.\s]+(?:\s+[^,.\s]+)*?)(?:\s+(?:widget|flow|script|for|with|that|$))/i);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            variables.NAME = name;
            variables.WIDGET_NAME = name.replace(/\s+/g, '_').toLowerCase();
            variables.FLOW_NAME = name.replace(/\s+/g, '_').toLowerCase();
            variables.CLASS_NAME = name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
            variables.WIDGET_TITLE = name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            variables.FLOW_DESCRIPTION = `${name} automation flow`;
            variables.WIDGET_DESCRIPTION = `Widget for ${name.toLowerCase()}`;
        }
        // Extract table name
        const tablePatterns = [
            /(?:for|on|from|of)\s+(\w+)\s+(?:table|records?|data)/i,
            /(?:track|manage|display|show)\s+(\w+)(?:\s|$)/i,
            /(\w+)\s+(?:management|tracking|dashboard)/i
        ];
        for (const pattern of tablePatterns) {
            const match = description.match(pattern);
            if (match) {
                variables.TABLE = match[1].toLowerCase();
                variables.TABLE_NAME = match[1].toLowerCase();
                break;
            }
        }
        // Extract trigger conditions
        if (lowerDesc.includes('when created') || lowerDesc.includes('on create')) {
            variables.TRIGGER_TYPE = 'record_created';
        }
        else if (lowerDesc.includes('when updated') || lowerDesc.includes('on update')) {
            variables.TRIGGER_TYPE = 'record_updated';
        }
        else if (lowerDesc.includes('when deleted') || lowerDesc.includes('on delete')) {
            variables.TRIGGER_TYPE = 'record_deleted';
        }
        // Extract approval-specific variables
        if (template.type === 'flow' && lowerDesc.includes('approval')) {
            // Extract amount thresholds
            const amountMatch = description.match(/(?:over|above|greater than|more than)\s*[$€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
            if (amountMatch) {
                variables.HIGH_AMOUNT_THRESHOLD = amountMatch[1].replace(/,/g, '');
            }
            // Extract approvers
            if (lowerDesc.includes('manager'))
                variables.APPROVAL_TYPE = 'manager';
            if (lowerDesc.includes('director'))
                variables.APPROVAL_TYPE = 'director';
            if (lowerDesc.includes('group'))
                variables.APPROVAL_TYPE = 'group';
        }
        // Extract integration-specific variables
        if (template.type === 'flow' && lowerDesc.includes('integrat')) {
            const apiMatch = description.match(/(?:api|endpoint|url):\s*([^\s]+)/i);
            if (apiMatch) {
                variables.API_ENDPOINT = apiMatch[1];
            }
        }
        // Extract refresh intervals for dashboards
        if (template.type === 'widget' && lowerDesc.includes('dashboard')) {
            const intervalMatch = description.match(/(?:refresh|update)\s+(?:every|each)\s+(\d+)\s*(?:second|minute)/i);
            if (intervalMatch) {
                let interval = parseInt(intervalMatch[1]);
                if (lowerDesc.includes('minute'))
                    interval *= 60;
                variables.REFRESH_INTERVAL = interval.toString();
            }
        }
        // Apply intelligent defaults based on context
        this.applyIntelligentDefaults(variables, template, description);
        return variables;
    }
    /**
     * Apply intelligent defaults based on context
     */
    applyIntelligentDefaults(variables, template, description) {
        const lowerDesc = description.toLowerCase();
        // Table-specific defaults
        if (variables.TABLE) {
            const table = variables.TABLE;
            // Incident-specific defaults
            if (table === 'incident') {
                variables.PRIORITY_FIELD = variables.PRIORITY_FIELD || 'priority';
                variables.STATE_FIELD = variables.STATE_FIELD || 'state';
                variables.ASSIGNED_TO_FIELD = variables.ASSIGNED_TO_FIELD || 'assigned_to';
            }
            // Request-specific defaults
            if (table.includes('request')) {
                variables.APPROVAL_FIELD = variables.APPROVAL_FIELD || 'approval';
                variables.STAGE_FIELD = variables.STAGE_FIELD || 'stage';
            }
            // Change-specific defaults
            if (table.includes('change')) {
                variables.RISK_FIELD = variables.RISK_FIELD || 'risk';
                variables.CAB_REQUIRED_FIELD = variables.CAB_REQUIRED_FIELD || 'cab_required';
            }
        }
        // Apply ServiceNow best practices
        if (template.type === 'widget') {
            variables.WIDGET_ROLES = variables.WIDGET_ROLES || '';
            variables.MAX_RECORDS = variables.MAX_RECORDS || '100';
        }
        if (template.type === 'flow') {
            variables.ACTIVE = variables.ACTIVE || 'true';
            variables.RUN_AS = variables.RUN_AS || 'system_user';
        }
        if (template.type === 'business_rule') {
            variables.ORDER = variables.ORDER || '100';
            variables.ACTIVE = variables.ACTIVE || 'true';
        }
    }
    /**
     * Create from pattern template
     */
    async createFromPattern(pattern, variables = {}) {
        // Load pattern template
        const templatePath = `patterns/${pattern}.template.json`;
        const template = await this.loadTemplate(templatePath);
        // Apply intelligent defaults
        this.applyIntelligentDefaults(variables, template, '');
        // Process with variables
        return this.processTemplate(template, variables);
    }
}
exports.TemplateEngine = TemplateEngine;
//# sourceMappingURL=template-engine.js.map