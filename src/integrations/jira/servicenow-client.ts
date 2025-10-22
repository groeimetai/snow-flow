/**
 * ServiceNow Client for Jira Integration
 *
 * Provides interface to ServiceNow operations for Jira sync.
 * Uses Snow-Flow core MCP tools when available.
 */

export interface ServiceNowRecord {
  sys_id: string;
  [key: string]: any;
}

export interface ServiceNowClient {
  /**
   * Query ServiceNow table
   */
  query(table: string, query: string): Promise<ServiceNowRecord[]>;

  /**
   * Create ServiceNow record
   */
  create(table: string, data: Record<string, any>): Promise<ServiceNowRecord>;

  /**
   * Update ServiceNow record
   */
  update(table: string, sysId: string, data: Record<string, any>): Promise<ServiceNowRecord>;

  /**
   * Add work note to record
   */
  addWorkNote(table: string, sysId: string, note: string): Promise<void>;

  /**
   * Lookup user by name or email
   */
  lookupUser(nameOrEmail: string): Promise<ServiceNowRecord | null>;
}

/**
 * ServiceNow Client Implementation
 *
 * Note: This requires Snow-Flow core to be installed and configured.
 * The implementation dynamically loads Snow-Flow MCP tools.
 */
export class ServiceNowClientImpl implements ServiceNowClient {
  private snowFlowCore: any;

  constructor() {
    this.loadSnowFlowCore();
  }

  /**
   * Load Snow-Flow core MCP tools
   */
  private async loadSnowFlowCore(): Promise<void> {
    try {
      // Dynamically import Snow-Flow core (peer dependency)
      // Note: This assumes Snow-Flow core exports MCP client
      // Implementation may need adjustment based on actual Snow-Flow core API
      const snowFlow = await import('snow-flow');
      this.snowFlowCore = snowFlow;
    } catch (error) {
      throw new Error(
        'Snow-Flow core not found. Please install snow-flow as peer dependency.\n' +
        'Run: npm install -g snow-flow'
      );
    }
  }

  /**
   * Query ServiceNow table
   */
  async query(table: string, query: string): Promise<ServiceNowRecord[]> {
    if (!this.snowFlowCore) {
      await this.loadSnowFlowCore();
    }

    try {
      // Use Snow-Flow MCP tool: snow_query_table
      // This is a placeholder - actual implementation depends on Snow-Flow core API
      const result = await this.executeMcpTool('snow_query_table', {
        table,
        query,
        fields: ['sys_id', '*'],
        limit: 1000
      });

      return result.records || [];
    } catch (error) {
      throw new Error(`Failed to query ServiceNow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create ServiceNow record
   */
  async create(table: string, data: Record<string, any>): Promise<ServiceNowRecord> {
    if (!this.snowFlowCore) {
      await this.loadSnowFlowCore();
    }

    try {
      // Use Snow-Flow MCP tool: snow_create_record or snow_deploy
      const result = await this.executeMcpTool('snow_create_record', {
        table,
        data
      });

      return result.record || { sys_id: result.sys_id, ...data };
    } catch (error) {
      throw new Error(`Failed to create ServiceNow record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update ServiceNow record
   */
  async update(table: string, sysId: string, data: Record<string, any>): Promise<ServiceNowRecord> {
    if (!this.snowFlowCore) {
      await this.loadSnowFlowCore();
    }

    try {
      // Use Snow-Flow MCP tool: snow_update or snow_update_record
      const result = await this.executeMcpTool('snow_update_record', {
        table,
        sys_id: sysId,
        data
      });

      return result.record || { sys_id: sysId, ...data };
    } catch (error) {
      throw new Error(`Failed to update ServiceNow record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add work note to record
   */
  async addWorkNote(table: string, sysId: string, note: string): Promise<void> {
    if (!this.snowFlowCore) {
      await this.loadSnowFlowCore();
    }

    try {
      // Add work note by updating work_notes field
      await this.executeMcpTool('snow_update_record', {
        table,
        sys_id: sysId,
        data: {
          work_notes: note
        }
      });
    } catch (error) {
      throw new Error(`Failed to add work note: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Lookup user by name or email
   */
  async lookupUser(nameOrEmail: string): Promise<ServiceNowRecord | null> {
    if (!this.snowFlowCore) {
      await this.loadSnowFlowCore();
    }

    try {
      // Query sys_user table
      const query = `nameSTARTSWITH${nameOrEmail}^ORemailSTARTSWITH${nameOrEmail}`;
      const result = await this.executeMcpTool('snow_query_table', {
        table: 'sys_user',
        query,
        fields: ['sys_id', 'name', 'email', 'user_name'],
        limit: 1
      });

      const users = result.records || [];
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.warn(`Failed to lookup user ${nameOrEmail}:`, error);
      return null;
    }
  }

  /**
   * Execute Snow-Flow MCP tool
   *
   * Note: This is a placeholder implementation.
   * Actual implementation depends on how Snow-Flow core exposes MCP tools.
   *
   * Options:
   * 1. Direct API calls to ServiceNow (requires credentials)
   * 2. IPC to Snow-Flow daemon
   * 3. MCP protocol over stdio/HTTP
   */
  private async executeMcpTool(toolName: string, params: any): Promise<any> {
    // IMPLEMENTATION NOTE:
    // This is where we need to integrate with Snow-Flow core.
    //
    // Possible approaches:
    // 1. Call Snow-Flow CLI: exec(`snow-flow mcp-call ${toolName} '${JSON.stringify(params)}'`)
    // 2. Use Snow-Flow as library: this.snowFlowCore.mcp.call(toolName, params)
    // 3. HTTP to Snow-Flow daemon: fetch('http://localhost:8080/mcp/call', ...)
    // 4. Direct ServiceNow REST calls (bypass Snow-Flow)
    //
    // For MVP, we'll use approach #4 with placeholder
    throw new Error(
      `ServiceNow integration not fully implemented yet.\n` +
      `TODO: Implement MCP tool execution for ${toolName}\n` +
      `This requires integration with Snow-Flow core MCP servers.\n\n` +
      `For now, you can:\n` +
      `1. Use dry-run mode to preview sync\n` +
      `2. Manually integrate with Snow-Flow core\n` +
      `3. Implement direct ServiceNow REST API calls`
    );
  }
}

/**
 * Mock ServiceNow client for testing/development
 */
export class MockServiceNowClient implements ServiceNowClient {
  private records: Map<string, Map<string, ServiceNowRecord>> = new Map();
  private idCounter = 1000;

  async query(table: string, query: string): Promise<ServiceNowRecord[]> {
    const tableRecords = this.records.get(table) || new Map();
    // Simple mock - return all records (ignoring query)
    return Array.from(tableRecords.values());
  }

  async create(table: string, data: Record<string, any>): Promise<ServiceNowRecord> {
    const sysId = `mock_${this.idCounter++}`;
    const record: ServiceNowRecord = { sys_id: sysId, ...data };

    if (!this.records.has(table)) {
      this.records.set(table, new Map());
    }
    this.records.get(table)!.set(sysId, record);

    return record;
  }

  async update(table: string, sysId: string, data: Record<string, any>): Promise<ServiceNowRecord> {
    const tableRecords = this.records.get(table);
    if (!tableRecords || !tableRecords.has(sysId)) {
      throw new Error(`Record not found: ${table}/${sysId}`);
    }

    const record = tableRecords.get(sysId)!;
    Object.assign(record, data);
    return record;
  }

  async addWorkNote(table: string, sysId: string, note: string): Promise<void> {
    // Mock implementation - just log
    console.log(`[MOCK] Add work note to ${table}/${sysId}: ${note}`);
  }

  async lookupUser(nameOrEmail: string): Promise<ServiceNowRecord | null> {
    // Mock implementation - return fake user
    return {
      sys_id: 'mock_user_123',
      name: nameOrEmail,
      email: `${nameOrEmail}@example.com`,
      user_name: nameOrEmail.toLowerCase().replace(/\s+/g, '.')
    };
  }
}
