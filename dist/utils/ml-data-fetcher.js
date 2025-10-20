"use strict";
/**
 * Smart ML Data Fetcher
 * Handles intelligent data fetching for ML training with batching and field discovery
 * Prevents token limit errors and optimizes data retrieval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLDataFetcher = void 0;
const logger_js_1 = require("./logger.js");
const logger = new logger_js_1.Logger('MLDataFetcher');
class MLDataFetcher {
    constructor(operationsMCP) {
        this.operationsMCP = operationsMCP;
    }
    /**
     * Smart fetch with automatic field discovery and batching
     */
    async smartFetch(options) {
        const { table, query = '', totalSamples = 1000, batchSize = 100, fields, discoverFields = true, includeContent = true } = options;
        logger.info(`🧠 Smart ML data fetch for ${table} - Target: ${totalSamples} samples`);
        // Step 1: Get total count
        const countResult = await this.getRecordCount(table, query);
        logger.info(`📊 Total available records: ${countResult}`);
        // Step 2: Discover fields if needed
        let fieldsToFetch = fields;
        if (!fieldsToFetch && discoverFields) {
            const discovery = await this.discoverFields(table, query);
            fieldsToFetch = discovery.recommendedFields;
            logger.info(`🔍 Discovered ${discovery.allFields.length} fields, using ${fieldsToFetch.length} for ML`);
        }
        // Step 3: Calculate optimal batching strategy
        const actualTotal = Math.min(totalSamples, countResult);
        const optimalBatchSize = this.calculateOptimalBatchSize(actualTotal, batchSize, fieldsToFetch?.length || 10);
        const numBatches = Math.ceil(actualTotal / optimalBatchSize);
        logger.info(`📦 Fetching ${actualTotal} records in ${numBatches} batches of ${optimalBatchSize}`);
        // Step 4: Fetch data in batches
        const allData = [];
        for (let batch = 0; batch < numBatches; batch++) {
            const offset = batch * optimalBatchSize;
            const limit = Math.min(optimalBatchSize, actualTotal - offset);
            logger.info(`  Batch ${batch + 1}/${numBatches}: Fetching ${limit} records (offset: ${offset})`);
            try {
                const batchData = await this.fetchBatch(table, query, limit, offset, fieldsToFetch, includeContent);
                allData.push(...batchData);
                // Small delay between batches to avoid overwhelming the API
                if (batch < numBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms to 200ms
                }
            }
            catch (error) {
                if (error.message?.includes('exceeds maximum allowed tokens')) {
                    // Reduce batch size and retry
                    logger.warn(`⚠️ Token limit hit, reducing batch size and retrying...`);
                    const smallerBatchSize = Math.floor(optimalBatchSize / 2);
                    return this.smartFetch({
                        ...options,
                        batchSize: smallerBatchSize
                    });
                }
                throw error;
            }
        }
        return {
            data: allData,
            totalFetched: allData.length,
            batchesProcessed: numBatches,
            fields: fieldsToFetch || []
        };
    }
    /**
     * Get total count of records matching query
     */
    async getRecordCount(table, query) {
        try {
            const result = await this.operationsMCP.handleTool('snow_query_table', {
                table,
                query,
                limit: 1,
                include_content: false // Count only, no data
            });
            // Extract count from result
            if (result?.content?.[0]?.text) {
                const text = result.content[0].text;
                const match = text.match(/Found (\d+) .* records/);
                if (match) {
                    return parseInt(match[1], 10);
                }
            }
            return 0;
        }
        catch (error) {
            logger.error('Failed to get record count:', error);
            return 0;
        }
    }
    /**
     * Discover available fields by sampling a few records
     */
    async discoverFields(table, query) {
        logger.info('🔍 Discovering fields from sample records...');
        try {
            // Fetch just 3 records with all fields to discover schema
            const result = await this.operationsMCP.handleTool('snow_query_table', {
                table,
                query,
                limit: 3,
                include_content: true
                // No fields specified = get all fields
            });
            const sampleData = this.extractDataFromResult(result);
            if (sampleData.length === 0) {
                logger.warn('No sample data available for field discovery');
                return {
                    allFields: [],
                    recommendedFields: this.getDefaultFields(table),
                    sampleData: []
                };
            }
            // Extract all field names from sample
            const allFields = Object.keys(sampleData[0] || {});
            // Recommend fields for ML (exclude system fields and large text fields)
            const recommendedFields = this.selectMLFields(allFields, sampleData, table);
            return {
                allFields,
                recommendedFields,
                sampleData
            };
        }
        catch (error) {
            logger.error('Field discovery failed:', error);
            return {
                allFields: [],
                recommendedFields: this.getDefaultFields(table),
                sampleData: []
            };
        }
    }
    /**
     * Fetch a single batch of data
     */
    async fetchBatch(table, query, limit, offset, fields, includeContent = true) {
        try {
            // ServiceNow uses sysparm_offset for pagination, not ORDERBY syntax
            // The query remains unchanged, offset is handled by the tool
            const result = await this.operationsMCP.handleTool('snow_query_table', {
                table,
                query: query || '',
                limit,
                offset, // Pass offset directly - the tool should handle sysparm_offset
                fields,
                include_content: includeContent
            });
            return this.extractDataFromResult(result);
        }
        catch (error) {
            logger.error(`Failed to fetch batch (offset: ${offset}, limit: ${limit}):`, error);
            // If offset isn't supported, try without it for first batch
            if (offset === 0) {
                try {
                    const fallbackResult = await this.operationsMCP.handleTool('snow_query_table', {
                        table,
                        query: query || '',
                        limit,
                        fields,
                        include_content: includeContent
                    });
                    return this.extractDataFromResult(fallbackResult);
                }
                catch (fallbackError) {
                    logger.error('Fallback batch fetch also failed:', fallbackError);
                }
            }
            return [];
        }
    }
    /**
     * Extract data from MCP tool result - More robust parsing
     */
    extractDataFromResult(result) {
        if (!result?.content?.[0]?.text) {
            return [];
        }
        try {
            const text = result.content[0].text;
            // Method 1: Direct JSON parsing
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
                if (parsed.result && Array.isArray(parsed.result)) {
                    return parsed.result;
                }
                if (parsed.data && Array.isArray(parsed.data)) {
                    return parsed.data;
                }
            }
            catch (jsonError) {
                // Not pure JSON, try other methods
            }
            // Method 2: Extract JSON array from text
            const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonArrayMatch) {
                try {
                    return JSON.parse(jsonArrayMatch[0]);
                }
                catch (e) {
                    // Continue to next method
                }
            }
            // Method 3: Extract individual JSON objects
            const jsonObjects = [];
            const objectMatches = text.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            for (const match of objectMatches) {
                try {
                    const obj = JSON.parse(match[0]);
                    if (obj && typeof obj === 'object') {
                        jsonObjects.push(obj);
                    }
                }
                catch (e) {
                    // Skip invalid JSON
                }
            }
            if (jsonObjects.length > 0) {
                return jsonObjects;
            }
            // Method 4: Parse formatted text output (fallback)
            const lines = text.split('\n');
            const data = [];
            let currentRecord = null;
            for (const line of lines) {
                // Detect new record
                if (line.match(/^(Record \d+|\d+\.|#{1,3}|-)/) ||
                    (line.includes('sys_id:') && currentRecord)) {
                    if (currentRecord && Object.keys(currentRecord).length > 0) {
                        data.push(currentRecord);
                    }
                    currentRecord = {};
                }
                // Extract key-value pairs
                if (currentRecord !== null) {
                    const kvMatch = line.match(/^\s*[-*]?\s*([\w_]+)\s*[:=]\s*(.+)$/);
                    if (kvMatch) {
                        const key = kvMatch[1].trim();
                        const value = kvMatch[2].trim();
                        if (key && value && value !== 'null' && value !== 'undefined') {
                            currentRecord[key] = value;
                        }
                    }
                }
            }
            if (currentRecord && Object.keys(currentRecord).length > 0) {
                data.push(currentRecord);
            }
            return data;
        }
        catch (error) {
            logger.error('Failed to extract data from result:', error);
            return [];
        }
    }
    /**
     * Calculate optimal batch size based on data characteristics
     */
    calculateOptimalBatchSize(totalRecords, requestedBatchSize, numFields) {
        // More conservative token estimation for ServiceNow data
        const avgTokensPerField = 15; // ServiceNow fields can be verbose
        const systemFieldOverhead = 100; // System fields add overhead
        const tokensPerRecord = (numFields * avgTokensPerField) + systemFieldOverhead;
        const maxTokensPerBatch = 15000; // More conservative limit for safety
        // Calculate max records per batch based on token limit
        const maxRecordsPerBatch = Math.floor(maxTokensPerBatch / tokensPerRecord);
        // Use the smaller of requested batch size and calculated max
        const optimalSize = Math.min(requestedBatchSize, maxRecordsPerBatch);
        // For ML training, we want reasonable batch sizes (20-100 typically)
        const minBatchSize = Math.min(20, totalRecords);
        const maxBatchSize = Math.min(100, totalRecords);
        return Math.max(minBatchSize, Math.min(optimalSize, maxBatchSize));
    }
    /**
     * Select appropriate fields for ML training
     */
    selectMLFields(allFields, sampleData, table) {
        const excluded = new Set([
            'sys_id', 'sys_created_on', 'sys_created_by', 'sys_updated_on', 'sys_updated_by',
            'sys_mod_count', 'sys_tags', 'sys_package', 'sys_policy', 'sys_scope',
            'sys_domain', 'sys_domain_path', 'sys_class_name'
        ]);
        const mlFields = allFields.filter(field => {
            // Exclude system fields
            if (excluded.has(field))
                return false;
            // Check if field has useful data in samples
            const hasData = sampleData.some(record => {
                const value = record[field];
                return value && value !== 'null' && value !== '';
            });
            return hasData;
        });
        // Always include key fields for the table type
        const keyFields = this.getKeyFields(table);
        const combinedFields = [...new Set([...keyFields, ...mlFields])];
        // Limit to 20 most relevant fields to avoid token issues
        return combinedFields.slice(0, 20);
    }
    /**
     * Get default fields for a table type
     */
    getDefaultFields(table) {
        const fieldMap = {
            incident: [
                'number', 'short_description', 'description', 'category', 'subcategory',
                'priority', 'urgency', 'impact', 'state', 'assignment_group',
                'assigned_to', 'caller_id', 'opened_at', 'resolved_at'
            ],
            change_request: [
                'number', 'short_description', 'description', 'type', 'category',
                'priority', 'risk', 'impact', 'state', 'assignment_group',
                'assigned_to', 'requested_by', 'start_date', 'end_date'
            ],
            problem: [
                'number', 'short_description', 'description', 'category', 'subcategory',
                'priority', 'urgency', 'impact', 'state', 'assignment_group',
                'assigned_to', 'opened_at', 'known_error'
            ],
            sc_request: [
                'number', 'short_description', 'description', 'request_state', 'approval',
                'requested_for', 'requested_by', 'assignment_group', 'assigned_to',
                'opened_at', 'closed_at'
            ]
        };
        return fieldMap[table] || ['number', 'short_description', 'state', 'priority'];
    }
    /**
     * Get key fields that should always be included
     */
    getKeyFields(table) {
        const keyFieldMap = {
            incident: ['number', 'short_description', 'category', 'priority', 'state'],
            change_request: ['number', 'short_description', 'type', 'risk', 'state'],
            problem: ['number', 'short_description', 'category', 'priority', 'state'],
            sc_request: ['number', 'short_description', 'request_state', 'approval']
        };
        return keyFieldMap[table] || ['number', 'short_description', 'state'];
    }
}
exports.MLDataFetcher = MLDataFetcher;
//# sourceMappingURL=ml-data-fetcher.js.map