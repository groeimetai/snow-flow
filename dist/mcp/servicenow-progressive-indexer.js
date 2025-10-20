#!/usr/bin/env node
"use strict";
/**
 * Progressive Indexing Strategy for ServiceNow Artifacts
 * Prevents overwhelming the system with too much data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowProgressiveIndexer = void 0;
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const logger_js_1 = require("../utils/logger.js");
class ServiceNowProgressiveIndexer {
    constructor() {
        this.indexedArtifacts = new Set();
        this.relevanceMap = new Map();
        this.currentContext = '';
        this.logger = new logger_js_1.Logger('ProgressiveIndexer');
        this.client = new servicenow_client_js_1.ServiceNowClient();
    }
    /**
     * Smart indexing based on current task context
     */
    async indexForContext(context, userInstruction) {
        this.currentContext = context;
        this.logger.info('Progressive indexing for context', { context, instruction: userInstruction });
        // Step 1: Extract key concepts from instruction
        const concepts = this.extractConcepts(userInstruction);
        // Step 2: Find most relevant artifacts (not everything!)
        const relevantArtifacts = await this.findRelevantArtifacts(concepts, {
            limit: 10, // Start with just 10 most relevant
            types: this.determineRelevantTypes(userInstruction)
        });
        // Step 3: Index only what's needed
        const indexingPlan = {
            immediate: relevantArtifacts.filter(a => a.relevance > 0.8),
            lazy: relevantArtifacts.filter(a => a.relevance > 0.5 && a.relevance <= 0.8),
            skip: relevantArtifacts.filter(a => a.relevance <= 0.5)
        };
        // Step 4: Progressive indexing
        await this.indexArtifacts(indexingPlan.immediate, 'immediate');
        // Lazy load others as needed
        this.scheduleLazyIndexing(indexingPlan.lazy);
        return {
            indexed_immediately: indexingPlan.immediate.length,
            scheduled_for_lazy: indexingPlan.lazy.length,
            skipped: indexingPlan.skip.length,
            strategy: this.getIndexingStrategy(concepts)
        };
    }
    /**
     * Extract key concepts from natural language
     */
    extractConcepts(instruction) {
        const concepts = [];
        const lower = instruction.toLowerCase();
        // Common ServiceNow concepts
        const conceptMap = {
            'incident': ['incident', 'ticket', 'issue', 'problem'],
            'widget': ['widget', 'ui', 'dashboard', 'interface', 'component'],
            'flow': ['flow', 'workflow', 'automation', 'process'],
            'approval': ['approval', 'approve', 'goedkeuring', 'review'],
            'script': ['script', 'code', 'function', 'api'],
            'table': ['table', 'data', 'record', 'database'],
            'integration': ['integration', 'connect', 'api', 'external'],
            'notification': ['notification', 'email', 'alert', 'message']
        };
        for (const [concept, keywords] of Object.entries(conceptMap)) {
            if (keywords.some(keyword => lower.includes(keyword))) {
                concepts.push(concept);
            }
        }
        return concepts;
    }
    /**
     * Determine which artifact types are relevant
     */
    determineRelevantTypes(instruction) {
        const types = [];
        const lower = instruction.toLowerCase();
        if (lower.includes('widget') || lower.includes('dashboard') || lower.includes('ui')) {
            types.push('widget', 'client_script', 'ui_script');
        }
        if (lower.includes('flow') || lower.includes('workflow') || lower.includes('automation')) {
            types.push('flow', 'script_include', 'business_rule');
        }
        if (lower.includes('script') || lower.includes('api') || lower.includes('function')) {
            types.push('script_include', 'business_rule');
        }
        if (lower.includes('table') || lower.includes('data') || lower.includes('record')) {
            types.push('table', 'business_rule');
        }
        // Default to common types if nothing specific found
        if (types.length === 0) {
            types.push('widget', 'flow', 'script_include');
        }
        return [...new Set(types)]; // Remove duplicates
    }
    /**
     * Find artifacts relevant to concepts
     */
    async findRelevantArtifacts(concepts, options) {
        const artifacts = [];
        // Build smart query based on concepts
        const searchQueries = concepts.map(concept => {
            switch (concept) {
                case 'incident':
                    return 'nameLIKEincident^ORdescriptionLIKEincident^ORtableLIKEincident';
                case 'widget':
                    return 'sys_class_name=sp_widget^ORcategoryLIKEdashboard';
                case 'flow':
                    return 'sys_class_name=sys_hub_flow^ORnameLIKEflow^ORnameLIKEworkflow';
                case 'approval':
                    return 'nameLIKEapproval^ORdescriptionLIKEapproval^ORscriptLIKEapproval';
                default:
                    return `nameLIKE${concept}^ORdescriptionLIKE${concept}`;
            }
        });
        // Search each type with relevance scoring
        for (const type of options.types) {
            const results = await this.searchArtifactsByType(type, searchQueries, options.limit);
            // Score each result
            results.forEach((artifact) => {
                artifact.relevance = this.calculateRelevance(artifact, concepts);
                artifacts.push(artifact);
            });
        }
        // Sort by relevance and limit
        return artifacts
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, options.limit);
    }
    /**
     * Calculate relevance score
     */
    calculateRelevance(artifact, concepts) {
        let score = 0;
        const name = (artifact.name || '').toLowerCase();
        const description = (artifact.description || '').toLowerCase();
        const content = (artifact.script || artifact.template || '').toLowerCase();
        // Name matches are most important
        concepts.forEach(concept => {
            if (name.includes(concept))
                score += 0.4;
            if (description.includes(concept))
                score += 0.2;
            if (content.includes(concept))
                score += 0.1;
        });
        // Recent artifacts are more relevant
        const lastUpdated = new Date(artifact.sys_updated_on || artifact.sys_created_on);
        const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7)
            score += 0.2;
        else if (daysSinceUpdate < 30)
            score += 0.1;
        // Popular artifacts (based on past usage)
        const relevance = this.relevanceMap.get(artifact.sys_id);
        if (relevance) {
            score += Math.min(relevance.access_count * 0.05, 0.2);
        }
        return Math.min(score, 1.0);
    }
    /**
     * Search artifacts by type
     */
    async searchArtifactsByType(type, queries, limit) {
        const tableMap = {
            'widget': 'sp_widget',
            'flow': 'sys_hub_flow',
            'script_include': 'sys_script_include',
            'business_rule': 'sys_script',
            'table': 'sys_db_object',
            'client_script': 'sys_ui_script',
            'ui_script': 'sys_ui_script'
        };
        const table = tableMap[type];
        if (!table)
            return [];
        try {
            const query = queries.join('^OR');
            const response = await this.client.searchRecords(table, query, limit);
            return response.success ? response.data.result : [];
        }
        catch (error) {
            this.logger.error(`Failed to search ${type}`, error);
            return [];
        }
    }
    /**
     * Index artifacts immediately
     */
    async indexArtifacts(artifacts, priority) {
        this.logger.info(`Indexing ${artifacts.length} artifacts with ${priority} priority`);
        for (const artifact of artifacts) {
            if (!this.indexedArtifacts.has(artifact.sys_id)) {
                // Index in Neo4j
                await this.indexInGraph(artifact);
                // Track indexing
                this.indexedArtifacts.add(artifact.sys_id);
                this.updateRelevance(artifact.sys_id, artifact.relevance);
            }
        }
    }
    /**
     * Schedule lazy indexing
     */
    scheduleLazyIndexing(artifacts) {
        // Index these when Claude actually needs them
        artifacts.forEach(artifact => {
            this.relevanceMap.set(artifact.sys_id, {
                artifact_id: artifact.sys_id,
                relevance_score: artifact.relevance,
                last_accessed: new Date(),
                access_count: 0,
                related_to_current_task: true
            });
        });
    }
    /**
     * Index artifact in Neo4j graph
     */
    async indexInGraph(artifact) {
        // This would call the Neo4j MCP
        this.logger.info(`Indexing ${artifact.name} in graph database`);
        // Implementation would use snow_graph_index_artifact
    }
    /**
     * Update relevance tracking
     */
    updateRelevance(artifactId, score) {
        const existing = this.relevanceMap.get(artifactId);
        if (existing) {
            existing.relevance_score = score;
            existing.last_accessed = new Date();
            existing.access_count++;
        }
        else {
            this.relevanceMap.set(artifactId, {
                artifact_id: artifactId,
                relevance_score: score,
                last_accessed: new Date(),
                access_count: 1,
                related_to_current_task: true
            });
        }
    }
    /**
     * Get indexing strategy based on context
     */
    getIndexingStrategy(concepts) {
        // Simple tasks need less indexing
        if (concepts.length <= 2) {
            return {
                mode: 'lazy',
                maxInitialArtifacts: 5,
                relevanceThreshold: 0.8,
                contextWindow: 10
            };
        }
        // Complex tasks need more context
        if (concepts.length > 5) {
            return {
                mode: 'eager',
                maxInitialArtifacts: 20,
                relevanceThreshold: 0.5,
                contextWindow: 50
            };
        }
        // Default progressive strategy
        return {
            mode: 'progressive',
            maxInitialArtifacts: 10,
            relevanceThreshold: 0.7,
            contextWindow: 25
        };
    }
    /**
     * Clean up old irrelevant artifacts
     */
    async cleanupIrrelevantArtifacts() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        let cleaned = 0;
        for (const [id, relevance] of this.relevanceMap.entries()) {
            if (relevance.last_accessed < thirtyDaysAgo &&
                relevance.access_count < 2 &&
                relevance.relevance_score < 0.5) {
                this.relevanceMap.delete(id);
                this.indexedArtifacts.delete(id);
                cleaned++;
            }
        }
        this.logger.info(`Cleaned up ${cleaned} irrelevant artifacts`);
        return cleaned;
    }
    /**
     * Get indexing statistics
     */
    getIndexingStats() {
        const stats = {
            total_indexed: this.indexedArtifacts.size,
            total_tracked: this.relevanceMap.size,
            current_context: this.currentContext,
            relevance_distribution: {
                high: 0,
                medium: 0,
                low: 0
            }
        };
        for (const relevance of this.relevanceMap.values()) {
            if (relevance.relevance_score > 0.8)
                stats.relevance_distribution.high++;
            else if (relevance.relevance_score > 0.5)
                stats.relevance_distribution.medium++;
            else
                stats.relevance_distribution.low++;
        }
        return stats;
    }
}
exports.ServiceNowProgressiveIndexer = ServiceNowProgressiveIndexer;
//# sourceMappingURL=servicenow-progressive-indexer.js.map