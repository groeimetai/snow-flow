/**
 * ServiceNow Artifact Indexer
 * Intelligent indexing system for large ServiceNow artifacts
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export interface ServiceNowArtifact {
  sys_id: string;
  name?: string;
  title?: string;
  table: string;
  sys_class_name: string;
  sys_updated_on: string;
  [key: string]: any;
}

export interface FlowArtifact extends ServiceNowArtifact {
  flow_definition: string;
  trigger_conditions?: string;
  active: boolean;
  description?: string;
}

export interface WidgetArtifact extends ServiceNowArtifact {
  template?: string;
  css?: string;
  client_script?: string;
  server_script?: string;
  option_schema?: string;
}

export interface IndexedArtifact {
  meta: {
    sys_id: string;
    name: string;
    type: string;
    last_updated: string;
    size_estimate: string;
  };
  structure: ArtifactStructure;
  context: ArtifactContext;
  relationships: ArtifactRelationships;
  claudeSummary: string;
  modificationPoints: ModificationPoint[];
  searchTerms: string[];
  editHistory: EditHistory[];
}

export interface ArtifactStructure {
  type: string;
  components: any;
  complexity: 'low' | 'medium' | 'high';
  editableFields: string[];
}

export interface ArtifactContext {
  usage: string;
  dependencies: string[];
  impact: string;
  commonModifications: string[];
}

export interface ArtifactRelationships {
  relatedArtifacts: string[];
  dependencies: string[];
  usage: string[];
}

export interface ModificationPoint {
  location: string;
  type: string;
  description: string;
  examples: string[];
}

export interface EditHistory {
  date: string;
  change: string;
  by: string;
}

export class ServiceNowArtifactIndexer {
  private logger: Logger;
  private memoryPath: string;

  constructor(memoryPath: string = join(process.cwd(), 'memory', 'servicenow_artifacts')) {
    this.logger = new Logger('ServiceNowArtifactIndexer');
    this.memoryPath = memoryPath;
  }

  async intelligentlyIndex(artifact: ServiceNowArtifact): Promise<IndexedArtifact> {
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

    const indexed: IndexedArtifact = {
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

  private async decomposeArtifact(artifact: ServiceNowArtifact): Promise<ArtifactStructure> {
    switch (artifact.sys_class_name) {
      case 'sp_widget':
        return this.decomposeWidget(artifact as WidgetArtifact);
      case 'sys_hub_flow':
        return this.decomposeFlow(artifact as FlowArtifact);
      case 'sys_script_include':
        return this.decomposeScript(artifact);
      case 'sys_app_application':
        return this.decomposeApplication(artifact);
      default:
        return this.decomposeGeneric(artifact);
    }
  }

  private async decomposeWidget(widget: WidgetArtifact): Promise<ArtifactStructure> {
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

  private async decomposeFlow(flow: FlowArtifact): Promise<ArtifactStructure> {
    const flowDefinition = this.parseFlowDefinition(flow.flow_definition);
    
    const components = {
      trigger: {
        type: flowDefinition.trigger?.type || 'unknown',
        table: flowDefinition.trigger?.table || 'unknown',
        conditions: flowDefinition.trigger?.conditions || 'none',
        description: this.describeTrigger(flowDefinition.trigger),
      },
      steps: flowDefinition.steps?.map((step: any) => ({
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

  private async decomposeScript(script: ServiceNowArtifact): Promise<ArtifactStructure> {
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

  private async decomposeApplication(app: ServiceNowArtifact): Promise<ArtifactStructure> {
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

  private async decomposeGeneric(artifact: ServiceNowArtifact): Promise<ArtifactStructure> {
    return {
      type: 'generic',
      components: {
        fields: Object.keys(artifact).filter(key => !key.startsWith('sys_')),
      },
      complexity: 'low',
      editableFields: ['name', 'description'],
    };
  }

  private async extractContext(artifact: ServiceNowArtifact): Promise<ArtifactContext> {
    return {
      usage: this.determineUsage(artifact),
      dependencies: await this.findDependencies(artifact),
      impact: this.assessImpact(artifact),
      commonModifications: this.getCommonModifications(artifact.sys_class_name),
    };
  }

  private async mapRelationships(artifact: ServiceNowArtifact): Promise<ArtifactRelationships> {
    return {
      relatedArtifacts: await this.findRelatedArtifacts(artifact),
      dependencies: await this.findDependencies(artifact),
      usage: await this.findUsage(artifact),
    };
  }

  private async createClaudeSummary(artifact: ServiceNowArtifact): Promise<string> {
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

  private async identifyModificationPoints(artifact: ServiceNowArtifact): Promise<ModificationPoint[]> {
    const points: ModificationPoint[] = [];

    switch (artifact.sys_class_name) {
      case 'sys_hub_flow':
        points.push(
          {
            location: 'after_approval_step',
            type: 'insert_activity',
            description: 'Perfect place to add email notifications, task creation, or additional approvals',
            examples: [
              'Add email notification to manager',
              'Create task for procurement team',
              'Add second-level approval for high amounts',
            ],
          },
          {
            location: 'approval_step_config',
            type: 'modify_settings',
            description: 'Modify approval criteria, timeout, and assignees',
            examples: [
              'Change approval threshold',
              'Modify timeout duration',
              'Update approval group',
            ],
          }
        );
        break;

      case 'sp_widget':
        points.push(
          {
            location: 'template_structure',
            type: 'modify_html',
            description: 'Modify the widget layout and structure',
            examples: [
              'Add new data fields',
              'Change color scheme',
              'Add interactive elements',
            ],
          },
          {
            location: 'client_script_functions',
            type: 'modify_javascript',
            description: 'Modify client-side behavior and interactions',
            examples: [
              'Add click handlers',
              'Implement real-time updates',
              'Add form validation',
            ],
          }
        );
        break;
    }

    return points;
  }

  private async generateSearchTerms(artifact: ServiceNowArtifact): Promise<string[]> {
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

  private parseFlowDefinition(flowDefinition: string): any {
    try {
      return JSON.parse(flowDefinition);
    } catch {
      // If not JSON, return a basic structure
      return {
        trigger: { type: 'unknown', table: 'unknown', conditions: 'unknown' },
        steps: [],
        variables: [],
      };
    }
  }

  private assessHTMLComplexity(html: string): 'low' | 'medium' | 'high' {
    const elementCount = (html.match(/<[^>]+>/g) || []).length;
    if (elementCount < 10) return 'low';
    if (elementCount < 50) return 'medium';
    return 'high';
  }

  private assessCSSComplexity(css: string): 'low' | 'medium' | 'high' {
    const ruleCount = (css.match(/\{[^}]+\}/g) || []).length;
    if (ruleCount < 5) return 'low';
    if (ruleCount < 20) return 'medium';
    return 'high';
  }

  private assessJSComplexity(js: string): 'low' | 'medium' | 'high' {
    const functionCount = (js.match(/function\s+\w+/g) || []).length;
    const lines = js.split('\n').length;
    
    if (functionCount < 3 && lines < 50) return 'low';
    if (functionCount < 10 && lines < 200) return 'medium';
    return 'high';
  }

  private assessOverallComplexity(components: any): 'low' | 'medium' | 'high' {
    const complexities = Object.values(components)
      .map((comp: any) => comp.complexity)
      .filter(c => c !== 'none');
    
    if (complexities.includes('high')) return 'high';
    if (complexities.includes('medium')) return 'medium';
    return 'low';
  }

  private assessFlowComplexity(components: any): 'low' | 'medium' | 'high' {
    const stepCount = components.steps?.length || 0;
    if (stepCount < 3) return 'low';
    if (stepCount < 10) return 'medium';
    return 'high';
  }

  private assessScriptComplexity(components: any): 'low' | 'medium' | 'high' {
    const functionCount = components.functions?.length || 0;
    if (functionCount < 3) return 'low';
    if (functionCount < 10) return 'medium';
    return 'high';
  }

  private extractHTMLFeatures(html: string): string[] {
    const features = [];
    if (html.includes('ng-')) features.push('AngularJS');
    if (html.includes('bootstrap')) features.push('Bootstrap');
    if (html.includes('table')) features.push('Table');
    if (html.includes('form')) features.push('Form');
    if (html.includes('chart')) features.push('Chart');
    return features;
  }

  private extractJSFunctions(js: string): string[] {
    const matches = js.match(/function\s+(\w+)/g) || [];
    return matches.map(match => match.replace('function ', ''));
  }

  private extractJSVariables(js: string): string[] {
    const matches = js.match(/var\s+(\w+)/g) || [];
    return matches.map(match => match.replace('var ', ''));
  }

  private extractServiceNowAPIs(js: string): string[] {
    const apis = [];
    if (js.includes('GlideRecord')) apis.push('GlideRecord');
    if (js.includes('GlideSystem')) apis.push('GlideSystem');
    if (js.includes('GlideUser')) apis.push('GlideUser');
    if (js.includes('GlideDateTime')) apis.push('GlideDateTime');
    return apis;
  }

  private extractDependencies(js: string): string[] {
    const deps = [];
    const includeMatches = js.match(/gs\.include\(['"]([^'"]+)['"]\)/g) || [];
    deps.push(...includeMatches.map(match => match.match(/['"]([^'"]+)['"]/)?.[1] || ''));
    return deps.filter(dep => dep.length > 0);
  }

  private parseOptionSchema(schema: string): any {
    try {
      return JSON.parse(schema);
    } catch {
      return null;
    }
  }

  private describeTrigger(trigger: any): string {
    if (!trigger) return 'Unknown trigger';
    return `Triggers on ${trigger.table} when ${trigger.type}`;
  }

  private generateStepDescription(step: any): string {
    return `${step.type} step: ${step.name}`;
  }

  private identifyEditableFields(step: any): string[] {
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

  private determineUsage(artifact: ServiceNowArtifact): string {
    const type = this.getReadableType(artifact.sys_class_name);
    return `This ${type} is used in ServiceNow for ${this.inferPurpose(artifact)}`;
  }

  private async findDependencies(artifact: ServiceNowArtifact): Promise<string[]> {
    // This would query ServiceNow for actual dependencies
    return [];
  }

  private assessImpact(artifact: ServiceNowArtifact): string {
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

  private getCommonModifications(type: string): string[] {
    const modifications: Record<string, string[]> = {
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

  private async findRelatedArtifacts(artifact: ServiceNowArtifact): Promise<string[]> {
    // This would query ServiceNow for related artifacts
    return [];
  }

  private async findUsage(artifact: ServiceNowArtifact): Promise<string[]> {
    // This would query ServiceNow for usage patterns
    return [];
  }

  private getReadableType(sysClassName: string): string {
    const typeMap: Record<string, string> = {
      'sp_widget': 'Service Portal Widget',
      'sys_hub_flow': 'Flow Designer Flow',
      'sys_script_include': 'Script Include',
      'sys_app_application': 'Scoped Application',
      'sys_script': 'Business Rule',
      'sys_ui_script': 'UI Script',
    };

    return typeMap[sysClassName] || sysClassName;
  }

  private inferPurpose(artifact: ServiceNowArtifact): string {
    const name = (artifact.name || artifact.title || '').toLowerCase();
    
    if (name.includes('incident')) return 'incident management';
    if (name.includes('approval')) return 'approval processes';
    if (name.includes('request')) return 'request management';
    if (name.includes('user')) return 'user management';
    if (name.includes('dashboard')) return 'data visualization';
    
    return 'business process automation';
  }

  private getModificationSuggestions(artifact: ServiceNowArtifact): string[] {
    return this.getCommonModifications(artifact.sys_class_name);
  }

  private extractKeyFunctions(artifact: ServiceNowArtifact): string[] {
    switch (artifact.sys_class_name) {
      case 'sys_hub_flow':
        return ['- Automates business processes', '- Handles approvals and notifications', '- Integrates with ServiceNow tables'];
      case 'sp_widget':
        return ['- Displays data in Service Portal', '- Provides user interaction', '- Integrates with ServiceNow data'];
      default:
        return ['- Provides ServiceNow functionality'];
    }
  }

  private estimateSize(artifact: ServiceNowArtifact): string {
    let totalSize = 0;
    
    Object.values(artifact).forEach(value => {
      if (typeof value === 'string') {
        totalSize += value.length;
      }
    });

    if (totalSize < 1000) return 'Small';
    if (totalSize < 10000) return 'Medium';
    return 'Large';
  }

  private async storeInMemory(artifact: IndexedArtifact): Promise<void> {
    await fs.mkdir(this.memoryPath, { recursive: true });
    const filePath = join(this.memoryPath, `${artifact.meta.sys_id}.json`);
    await fs.writeFile(filePath, JSON.stringify(artifact, null, 2));
    
    this.logger.info('Artifact indexed and stored in memory', { 
      sys_id: artifact.meta.sys_id,
      name: artifact.meta.name,
      type: artifact.meta.type,
    });
  }

  async loadFromMemory(sys_id: string): Promise<IndexedArtifact | null> {
    try {
      const filePath = join(this.memoryPath, `${sys_id}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async searchMemory(query: string): Promise<IndexedArtifact[]> {
    try {
      const files = await fs.readdir(this.memoryPath);
      const results: IndexedArtifact[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(join(this.memoryPath, file), 'utf8');
          const artifact = JSON.parse(content);
          
          if (this.matchesQuery(artifact, query)) {
            results.push(artifact);
          }
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Memory search failed', error);
      return [];
    }
  }

  private matchesQuery(artifact: IndexedArtifact, query: string): boolean {
    const searchTerms = query.toLowerCase().split(' ');
    const artifactTerms = artifact.searchTerms.join(' ').toLowerCase();
    const summaryTerms = artifact.claudeSummary.toLowerCase();
    
    return searchTerms.some(term => 
      artifactTerms.includes(term) || summaryTerms.includes(term)
    );
  }
}