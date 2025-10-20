"use strict";
/**
 * ServiceNow Artifact Indexer
 * Intelligent indexing system for large ServiceNow artifacts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowArtifactIndexer = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_js_1 = require("../utils/logger.js");
class ServiceNowArtifactIndexer {
    constructor(memoryPath = (0, path_1.join)(process.cwd(), 'memory', 'servicenow_artifacts')) {
        this.logger = new logger_js_1.Logger('ServiceNowArtifactIndexer');
        this.memoryPath = memoryPath;
    }
    async intelligentlyIndex(artifact) {
        this.logger.info('Indexing ServiceNow artifact', {
            sys_id: artifact.sys_id,
            type: artifact.sys_class_name
        });
        const structure = await this.decomposeArtifact(artifact);
        const context = await this.extractContext(artifact);
        const relationships = await this.mapRelationships(artifact);
        const claudeSummary = await this.createClaudeSummary(artifact);
        const modificationPoints = await this.identifyModificationPoints(artifact);
        const searchTerms = await this.generateSearchTerms(artifact);
        const indexed = {
            meta: {
                sys_id: artifact.sys_id,
                name: artifact.name || artifact.title || 'Unknown',
                type: artifact.sys_class_name || artifact.table,
                last_updated: artifact.sys_updated_on,
                size_estimate: this.estimateSize(artifact),
            },
            structure,
            context,
            relationships,
            claudeSummary,
            modificationPoints,
            searchTerms,
            editHistory: [],
        };
        await this.storeInMemory(indexed);
        return indexed;
    }
    async decomposeArtifact(artifact) {
        switch (artifact.sys_class_name) {
            case 'sp_widget':
                return this.decomposeWidget(artifact);
            case 'sys_hub_flow':
                return this.decomposeFlow(artifact);
            case 'sys_script_include':
                return this.decomposeScript(artifact);
            case 'sys_app_application':
                return this.decomposeApplication(artifact);
            default:
                return this.decomposeGeneric(artifact);
        }
    }
    async decomposeWidget(widget) {
        const components = {
            template: {
                present: !!widget.template,
                complexity: widget.template ? this.assessHTMLComplexity(widget.template) : 'none',
                size: widget.template?.length || 0,
                features: widget.template ? this.extractHTMLFeatures(widget.template) : [],
            },
            css: {
                present: !!widget.css,
                complexity: widget.css ? this.assessCSSComplexity(widget.css) : 'none',
                size: widget.css?.length || 0,
            },
            client_script: {
                present: !!widget.client_script,
                complexity: widget.client_script ? this.assessJSComplexity(widget.client_script) : 'none',
                size: widget.client_script?.length || 0,
                functions: widget.client_script ? this.extractJSFunctions(widget.client_script) : [],
            },
            server_script: {
                present: !!widget.server_script,
                complexity: widget.server_script ? this.assessJSComplexity(widget.server_script) : 'none',
                size: widget.server_script?.length || 0,
                functions: widget.server_script ? this.extractJSFunctions(widget.server_script) : [],
            },
            options: {
                present: !!widget.option_schema,
                schema: widget.option_schema ? this.parseOptionSchema(widget.option_schema) : null,
            },
        };
        return {
            type: 'widget',
            components,
            complexity: this.assessOverallComplexity(components),
            editableFields: [
                'template',
                'css',
                'client_script',
                'server_script',
                'option_schema',
                'title',
                'description',
            ],
        };
    }
    async decomposeFlow(flow) {
        const flowDefinition = this.parseFlowDefinition(flow.flow_definition);
        const components = {
            trigger: {
                type: flowDefinition.trigger?.type || 'unknown',
                table: flowDefinition.trigger?.table || 'unknown',
                conditions: flowDefinition.trigger?.conditions || 'none',
                description: this.describeTrigger(flowDefinition.trigger),
            },
            steps: flowDefinition.steps?.map((step) => ({
                id: step.id,
                type: step.type,
                name: step.name,
                configuration: step.config,
                description: this.generateStepDescription(step),
                editableFields: this.identifyEditableFields(step),
            })) || [],
            variables: flowDefinition.variables || [],
            errorHandling: flowDefinition.errorHandling || 'none',
        };
        return {
            type: 'flow',
            components,
            complexity: this.assessFlowComplexity(components),
            editableFields: [
                'name',
                'description',
                'trigger_conditions',
                'active',
                'flow_definition',
            ],
        };
    }
    async decomposeScript(script) {
        const scriptContent = script.script || '';
        const components = {
            functions: this.extractJSFunctions(scriptContent),
            variables: this.extractJSVariables(scriptContent),
            apis: this.extractServiceNowAPIs(scriptContent),
            complexity: this.assessJSComplexity(scriptContent),
            dependencies: this.extractDependencies(scriptContent),
        };
        return {
            type: 'script',
            components,
            complexity: this.assessScriptComplexity(components),
            editableFields: ['script', 'description', 'api_name'],
        };
    }
    async decomposeApplication(app) {
        const components = {
            scope: app.scope,
            version: app.version,
            vendor: app.vendor,
            tables: [], // Would be populated by querying related tables
            modules: [], // Would be populated by querying sys_app_module
            roles: [], // Would be populated by querying sys_user_role
        };
        return {
            type: 'application',
            components,
            complexity: 'medium',
            editableFields: ['name', 'description', 'version', 'vendor'],
        };
    }
    async decomposeGeneric(artifact) {
        return {
            type: 'generic',
            components: {
                fields: Object.keys(artifact).filter(key => !key.startsWith('sys_')),
            },
            complexity: 'low',
            editableFields: ['name', 'description'],
        };
    }
    async extractContext(artifact) {
        return {
            usage: this.determineUsage(artifact),
            dependencies: await this.findDependencies(artifact),
            impact: this.assessImpact(artifact),
            commonModifications: this.getCommonModifications(artifact.sys_class_name),
        };
    }
    async mapRelationships(artifact) {
        return {
            relatedArtifacts: await this.findRelatedArtifacts(artifact),
            dependencies: await this.findDependencies(artifact),
            usage: await this.findUsage(artifact),
        };
    }
    async createClaudeSummary(artifact) {
        const name = artifact.name || artifact.title || 'Unknown';
        const type = this.getReadableType(artifact.sys_class_name);
        const purpose = this.inferPurpose(artifact);
        const modificationSuggestions = this.getModificationSuggestions(artifact);
        return `${name} is a ${type} in ServiceNow that ${purpose}. 

🎯 Key Functions:
${this.extractKeyFunctions(artifact).join('\n')}

🔧 Common Modifications:
${modificationSuggestions.join('\n')}

💡 Claude can help you modify this artifact using natural language instructions like:
- "Add email notification after approval"
- "Change the approval threshold to €1000"
- "Update the widget to show real-time data"`;
    }
    async identifyModificationPoints(artifact) {
        const points = [];
        switch (artifact.sys_class_name) {
            case 'sys_hub_flow':
                points.push({
                    location: 'after_approval_step',
                    type: 'insert_activity',
                    description: 'Perfect place to add email notifications, task creation, or additional approvals',
                    examples: [
                        'Add email notification to manager',
                        'Create task for procurement team',
                        'Add second-level approval for high amounts',
                    ],
                }, {
                    location: 'approval_step_config',
                    type: 'modify_settings',
                    description: 'Modify approval criteria, timeout, and assignees',
                    examples: [
                        'Change approval threshold',
                        'Modify timeout duration',
                        'Update approval group',
                    ],
                });
                break;
            case 'sp_widget':
                points.push({
                    location: 'template_structure',
                    type: 'modify_html',
                    description: 'Modify the widget layout and structure',
                    examples: [
                        'Add new data fields',
                        'Change color scheme',
                        'Add interactive elements',
                    ],
                }, {
                    location: 'client_script_functions',
                    type: 'modify_javascript',
                    description: 'Modify client-side behavior and interactions',
                    examples: [
                        'Add click handlers',
                        'Implement real-time updates',
                        'Add form validation',
                    ],
                });
                break;
        }
        return points;
    }
    async generateSearchTerms(artifact) {
        const terms = [
            artifact.name || '',
            artifact.title || '',
            artifact.sys_class_name,
            this.getReadableType(artifact.sys_class_name),
        ];
        // Add purpose-based terms
        const purpose = this.inferPurpose(artifact);
        terms.push(...purpose.split(' '));
        // Add content-based terms
        if (artifact.description) {
            terms.push(...artifact.description.split(' '));
        }
        return terms.filter(term => term.length > 2).map(term => term.toLowerCase());
    }
    parseFlowDefinition(flowDefinition) {
        try {
            return JSON.parse(flowDefinition);
        }
        catch {
            // If not JSON, return a basic structure
            return {
                trigger: { type: 'unknown', table: 'unknown', conditions: 'unknown' },
                steps: [],
                variables: [],
            };
        }
    }
    assessHTMLComplexity(html) {
        const elementCount = (html.match(/<[^>]+>/g) || []).length;
        if (elementCount < 10)
            return 'low';
        if (elementCount < 50)
            return 'medium';
        return 'high';
    }
    assessCSSComplexity(css) {
        const ruleCount = (css.match(/\{[^}]+\}/g) || []).length;
        if (ruleCount < 5)
            return 'low';
        if (ruleCount < 20)
            return 'medium';
        return 'high';
    }
    assessJSComplexity(js) {
        const functionCount = (js.match(/function\s+\w+/g) || []).length;
        const lines = js.split('\n').length;
        if (functionCount < 3 && lines < 50)
            return 'low';
        if (functionCount < 10 && lines < 200)
            return 'medium';
        return 'high';
    }
    assessOverallComplexity(components) {
        const complexities = Object.values(components)
            .map((comp) => comp.complexity)
            .filter(c => c !== 'none');
        if (complexities.includes('high'))
            return 'high';
        if (complexities.includes('medium'))
            return 'medium';
        return 'low';
    }
    assessFlowComplexity(components) {
        const stepCount = components.steps?.length || 0;
        if (stepCount < 3)
            return 'low';
        if (stepCount < 10)
            return 'medium';
        return 'high';
    }
    assessScriptComplexity(components) {
        const functionCount = components.functions?.length || 0;
        if (functionCount < 3)
            return 'low';
        if (functionCount < 10)
            return 'medium';
        return 'high';
    }
    extractHTMLFeatures(html) {
        const features = [];
        if (html.includes('ng-'))
            features.push('AngularJS');
        if (html.includes('bootstrap'))
            features.push('Bootstrap');
        if (html.includes('table'))
            features.push('Table');
        if (html.includes('form'))
            features.push('Form');
        if (html.includes('chart'))
            features.push('Chart');
        return features;
    }
    extractJSFunctions(js) {
        const matches = js.match(/function\s+(\w+)/g) || [];
        return matches.map(match => match.replace('function ', ''));
    }
    extractJSVariables(js) {
        const matches = js.match(/var\s+(\w+)/g) || [];
        return matches.map(match => match.replace('var ', ''));
    }
    extractServiceNowAPIs(js) {
        const apis = [];
        if (js.includes('GlideRecord'))
            apis.push('GlideRecord');
        if (js.includes('GlideSystem'))
            apis.push('GlideSystem');
        if (js.includes('GlideUser'))
            apis.push('GlideUser');
        if (js.includes('GlideDateTime'))
            apis.push('GlideDateTime');
        return apis;
    }
    extractDependencies(js) {
        const deps = [];
        const includeMatches = js.match(/gs\.include\(['"]([^'"]+)['"]\)/g) || [];
        deps.push(...includeMatches.map(match => match.match(/['"]([^'"]+)['"]/)?.[1] || ''));
        return deps.filter(dep => dep.length > 0);
    }
    parseOptionSchema(schema) {
        try {
            return JSON.parse(schema);
        }
        catch {
            return null;
        }
    }
    describeTrigger(trigger) {
        if (!trigger)
            return 'Unknown trigger';
        return `Triggers on ${trigger.table} when ${trigger.type}`;
    }
    generateStepDescription(step) {
        return `${step.type} step: ${step.name}`;
    }
    identifyEditableFields(step) {
        const baseFields = ['name', 'description'];
        switch (step.type) {
            case 'approval':
                return [...baseFields, 'approver', 'timeout', 'condition'];
            case 'script':
                return [...baseFields, 'script', 'inputs', 'outputs'];
            case 'notification':
                return [...baseFields, 'recipients', 'template', 'condition'];
            default:
                return baseFields;
        }
    }
    determineUsage(artifact) {
        const type = this.getReadableType(artifact.sys_class_name);
        return `This ${type} is used in ServiceNow for ${this.inferPurpose(artifact)}`;
    }
    async findDependencies(artifact) {
        // This would query ServiceNow for actual dependencies
        return [];
    }
    assessImpact(artifact) {
        switch (artifact.sys_class_name) {
            case 'sys_hub_flow':
                return 'High - Flow modifications can affect business processes';
            case 'sp_widget':
                return 'Medium - Widget changes affect user interface';
            case 'sys_script_include':
                return 'High - Script changes can affect multiple applications';
            default:
                return 'Medium - Standard ServiceNow artifact';
        }
    }
    getCommonModifications(type) {
        const modifications = {
            'sys_hub_flow': [
                'Add email notification steps',
                'Modify approval criteria',
                'Add task creation',
                'Update timeout settings',
            ],
            'sp_widget': [
                'Update styling and colors',
                'Add new data fields',
                'Improve mobile responsiveness',
                'Add interactive features',
            ],
            'sys_script_include': [
                'Add error handling',
                'Optimize performance',
                'Add logging',
                'Update API calls',
            ],
        };
        return modifications[type] || ['General configuration updates'];
    }
    async findRelatedArtifacts(artifact) {
        // This would query ServiceNow for related artifacts
        return [];
    }
    async findUsage(artifact) {
        // This would query ServiceNow for usage patterns
        return [];
    }
    getReadableType(sysClassName) {
        const typeMap = {
            'sp_widget': 'Service Portal Widget',
            'sys_hub_flow': 'Flow Designer Flow',
            'sys_script_include': 'Script Include',
            'sys_app_application': 'Scoped Application',
            'sys_script': 'Business Rule',
            'sys_ui_script': 'UI Script',
        };
        return typeMap[sysClassName] || sysClassName;
    }
    inferPurpose(artifact) {
        const name = (artifact.name || artifact.title || '').toLowerCase();
        if (name.includes('incident'))
            return 'incident management';
        if (name.includes('approval'))
            return 'approval processes';
        if (name.includes('request'))
            return 'request management';
        if (name.includes('user'))
            return 'user management';
        if (name.includes('dashboard'))
            return 'data visualization';
        return 'business process automation';
    }
    getModificationSuggestions(artifact) {
        return this.getCommonModifications(artifact.sys_class_name);
    }
    extractKeyFunctions(artifact) {
        switch (artifact.sys_class_name) {
            case 'sys_hub_flow':
                return ['- Automates business processes', '- Handles approvals and notifications', '- Integrates with ServiceNow tables'];
            case 'sp_widget':
                return ['- Displays data in Service Portal', '- Provides user interaction', '- Integrates with ServiceNow data'];
            default:
                return ['- Provides ServiceNow functionality'];
        }
    }
    estimateSize(artifact) {
        let totalSize = 0;
        Object.values(artifact).forEach(value => {
            if (typeof value === 'string') {
                totalSize += value.length;
            }
        });
        if (totalSize < 1000)
            return 'Small';
        if (totalSize < 10000)
            return 'Medium';
        return 'Large';
    }
    async storeInMemory(artifact) {
        await fs_1.promises.mkdir(this.memoryPath, { recursive: true });
        const filePath = (0, path_1.join)(this.memoryPath, `${artifact.meta.sys_id}.json`);
        await fs_1.promises.writeFile(filePath, JSON.stringify(artifact, null, 2));
        this.logger.info('Artifact indexed and stored in memory', {
            sys_id: artifact.meta.sys_id,
            name: artifact.meta.name,
            type: artifact.meta.type,
        });
    }
    async loadFromMemory(sys_id) {
        try {
            const filePath = (0, path_1.join)(this.memoryPath, `${sys_id}.json`);
            const content = await fs_1.promises.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            return null;
        }
    }
    async searchMemory(query) {
        try {
            const files = await fs_1.promises.readdir(this.memoryPath);
            const results = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs_1.promises.readFile((0, path_1.join)(this.memoryPath, file), 'utf8');
                    const artifact = JSON.parse(content);
                    if (this.matchesQuery(artifact, query)) {
                        results.push(artifact);
                    }
                }
            }
            return results;
        }
        catch (error) {
            this.logger.error('Memory search failed', error);
            return [];
        }
    }
    matchesQuery(artifact, query) {
        const searchTerms = query.toLowerCase().split(' ');
        const artifactTerms = artifact.searchTerms.join(' ').toLowerCase();
        const summaryTerms = artifact.claudeSummary.toLowerCase();
        return searchTerms.some(term => artifactTerms.includes(term) || summaryTerms.includes(term));
    }
}
exports.ServiceNowArtifactIndexer = ServiceNowArtifactIndexer;
//# sourceMappingURL=servicenow-artifact-indexer.js.map