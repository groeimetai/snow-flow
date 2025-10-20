"use strict";
/**
 * MCP Memory Manager
 * Shared memory integration for all MCP servers to coordinate with agents
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPMemoryManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_js_1 = require("../../utils/logger.js");
class MCPMemoryManager {
    constructor() {
        this.logger = new logger_js_1.Logger('MCPMemoryManager');
        // Create memory directory if it doesn't exist
        const memoryDir = path.join(process.cwd(), '.snow-flow', 'memory');
        if (!fs.existsSync(memoryDir)) {
            fs.mkdirSync(memoryDir, { recursive: true });
        }
        // Initialize database
        this.db = new better_sqlite3_1.default(path.join(memoryDir, 'mcp-coordination.db'));
        this.initializeDatabase();
    }
    static getInstance() {
        if (!MCPMemoryManager.instance) {
            MCPMemoryManager.instance = new MCPMemoryManager();
        }
        return MCPMemoryManager.instance;
    }
    initializeDatabase() {
        this.logger.info('Initializing MCP coordination database');
        this.db.exec(`
      -- Agent coordination and communication
      CREATE TABLE IF NOT EXISTS agent_coordination (
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        status TEXT NOT NULL,
        assigned_tasks TEXT,
        progress_percentage INTEGER DEFAULT 0,
        last_activity TEXT NOT NULL,
        current_tool TEXT,
        error_state TEXT,
        PRIMARY KEY (session_id, agent_id)
      );

      -- ServiceNow artifact tracking
      CREATE TABLE IF NOT EXISTS servicenow_artifacts (
        sys_id TEXT PRIMARY KEY,
        artifact_type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_by_agent TEXT NOT NULL,
        session_id TEXT NOT NULL,
        deployment_status TEXT NOT NULL,
        update_set_id TEXT,
        dependencies TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Inter-agent communication
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        message_type TEXT NOT NULL,
        content TEXT NOT NULL,
        artifact_reference TEXT,
        timestamp TEXT NOT NULL,
        processed INTEGER DEFAULT 0
      );

      -- Shared context between agents
      CREATE TABLE IF NOT EXISTS shared_context (
        session_id TEXT NOT NULL,
        context_key TEXT NOT NULL,
        context_value TEXT NOT NULL,
        created_by_agent TEXT NOT NULL,
        expires_at TEXT,
        access_permissions TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (session_id, context_key)
      );

      -- Deployment tracking
      CREATE TABLE IF NOT EXISTS deployment_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        artifact_sys_id TEXT NOT NULL,
        deployment_type TEXT NOT NULL,
        success INTEGER NOT NULL,
        deployment_time TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        error_details TEXT,
        rollback_available INTEGER DEFAULT 0
      );

      -- Agent dependencies and handoffs
      CREATE TABLE IF NOT EXISTS agent_dependencies (
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        depends_on_agent TEXT NOT NULL,
        dependency_type TEXT NOT NULL,
        artifact_reference TEXT,
        status TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        satisfied_at TEXT,
        PRIMARY KEY (session_id, agent_id, depends_on_agent)
      );

      -- Performance metrics
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        operation_name TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error_message TEXT,
        timestamp TEXT NOT NULL
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_artifacts_session ON servicenow_artifacts(session_id);
      CREATE INDEX IF NOT EXISTS idx_coordination_session ON agent_coordination(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON agent_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_context_session ON shared_context(session_id);
    `);
    }
    // Read session context
    async getSessionContext(session_id) {
        try {
            const contexts = this.db.prepare(`
        SELECT * FROM shared_context 
        WHERE session_id = ? 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).all(session_id);
            const result = {};
            for (const context of contexts) {
                try {
                    result[context.context_key] = JSON.parse(context.context_value);
                }
                catch {
                    result[context.context_key] = context.context_value;
                }
            }
            return result;
        }
        catch (error) {
            this.logger.error('Failed to get session context', error);
            return {};
        }
    }
    // Get active agents for session
    async getActiveAgents(session_id) {
        try {
            const agents = this.db.prepare(`
        SELECT * FROM agent_coordination 
        WHERE session_id = ? AND status IN ('active', 'spawned')
      `).all(session_id);
            return agents;
        }
        catch (error) {
            this.logger.error('Failed to get active agents', error);
            return [];
        }
    }
    // Store artifact information
    async storeArtifact(artifact) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO servicenow_artifacts 
        (sys_id, artifact_type, name, description, created_by_agent, session_id, 
         deployment_status, update_set_id, dependencies, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(artifact.sys_id, artifact.artifact_type, artifact.name, artifact.description || null, artifact.created_by_agent, artifact.session_id, artifact.deployment_status, artifact.update_set_id || null, artifact.dependencies || null, artifact.metadata || null);
            this.logger.debug(`Stored artifact ${artifact.name} (${artifact.sys_id})`);
        }
        catch (error) {
            this.logger.error('Failed to store artifact', error);
            throw error;
        }
    }
    // Update shared context
    async updateSharedContext(context) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO shared_context 
        (session_id, context_key, context_value, created_by_agent, expires_at, access_permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(context.session_id, context.context_key, context.context_value, context.created_by_agent, context.expires_at ? context.expires_at.toISOString() : null, context.access_permissions || null);
            this.logger.debug(`Updated shared context: ${context.context_key}`);
        }
        catch (error) {
            this.logger.error('Failed to update shared context', error);
            throw error;
        }
    }
    // Update agent coordination status
    async updateAgentCoordination(coordination) {
        try {
            // Build dynamic update query based on provided fields
            const updates = [];
            const values = [];
            if (coordination.status !== undefined) {
                updates.push('status = ?');
                values.push(coordination.status);
            }
            if (coordination.progress_percentage !== undefined) {
                updates.push('progress_percentage = ?');
                values.push(coordination.progress_percentage);
            }
            if (coordination.current_tool !== undefined) {
                updates.push('current_tool = ?');
                values.push(coordination.current_tool);
            }
            if (coordination.error_state !== undefined) {
                updates.push('error_state = ?');
                values.push(coordination.error_state);
            }
            // Always update last_activity
            updates.push('last_activity = datetime("now")');
            // Add WHERE clause values
            values.push(coordination.agent_id, coordination.session_id);
            const stmt = this.db.prepare(`
        UPDATE agent_coordination 
        SET ${updates.join(', ')}
        WHERE agent_id = ? AND session_id = ?
      `);
            const result = stmt.run(...values);
            // If no rows updated, create new record
            if (result.changes === 0) {
                const insertStmt = this.db.prepare(`
          INSERT INTO agent_coordination 
          (session_id, agent_id, agent_type, status, progress_percentage, last_activity)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);
                insertStmt.run(coordination.session_id, coordination.agent_id, coordination.agent_type || 'unknown', coordination.status || 'active', coordination.progress_percentage || 0);
            }
            this.logger.debug(`Updated agent coordination for ${coordination.agent_id}`);
        }
        catch (error) {
            this.logger.error('Failed to update agent coordination', error);
            throw error;
        }
    }
    // Send message between agents
    async sendAgentMessage(message) {
        try {
            const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const stmt = this.db.prepare(`
        INSERT INTO agent_messages 
        (id, session_id, from_agent, to_agent, message_type, content, artifact_reference, timestamp, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)
      `);
            stmt.run(id, message.session_id, message.from_agent, message.to_agent, message.message_type, message.content, message.artifact_reference || null);
            this.logger.debug(`Sent message from ${message.from_agent} to ${message.to_agent}`);
        }
        catch (error) {
            this.logger.error('Failed to send agent message', error);
            throw error;
        }
    }
    // Check for pending messages
    async checkForMessages(agent_id, session_id) {
        try {
            const messages = this.db.prepare(`
        SELECT * FROM agent_messages 
        WHERE session_id = ? AND to_agent = ? AND processed = 0
        ORDER BY timestamp ASC
      `).all(session_id, agent_id);
            // Mark messages as processed
            if (messages.length > 0) {
                const ids = messages.map((m) => m.id);
                const placeholders = ids.map(() => '?').join(',');
                this.db.prepare(`
          UPDATE agent_messages 
          SET processed = 1 
          WHERE id IN (${placeholders})
        `).run(...ids);
            }
            return messages;
        }
        catch (error) {
            this.logger.error('Failed to check for messages', error);
            return [];
        }
    }
    // Track performance metrics
    async trackPerformance(metric) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO performance_metrics 
        (session_id, agent_id, operation_name, duration_ms, success, error_message, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);
            stmt.run(metric.session_id, metric.agent_id, metric.operation_name, metric.duration_ms, metric.success ? 1 : 0, metric.error_message || null);
            this.logger.debug(`Tracked performance: ${metric.operation_name} (${metric.duration_ms}ms)`);
        }
        catch (error) {
            this.logger.error('Failed to track performance', error);
        }
    }
    // Record deployment
    async recordDeployment(session_id, artifact_sys_id, deployment_type, success, agent_id, error_details) {
        try {
            const id = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const stmt = this.db.prepare(`
        INSERT INTO deployment_history 
        (id, session_id, artifact_sys_id, deployment_type, success, deployment_time, agent_id, error_details, rollback_available)
        VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
      `);
            stmt.run(id, session_id, artifact_sys_id, deployment_type, success ? 1 : 0, agent_id, error_details || null, success ? 1 : 0);
            this.logger.debug(`Recorded deployment: ${deployment_type} for ${artifact_sys_id}`);
        }
        catch (error) {
            this.logger.error('Failed to record deployment', error);
            throw error;
        }
    }
    // Get artifact by sys_id
    async getArtifact(sys_id) {
        try {
            const artifact = this.db.prepare(`
        SELECT * FROM servicenow_artifacts WHERE sys_id = ?
      `).get(sys_id);
            return artifact;
        }
        catch (error) {
            this.logger.error('Failed to get artifact', error);
            return null;
        }
    }
    // Get all artifacts for session
    async getSessionArtifacts(session_id) {
        try {
            const artifacts = this.db.prepare(`
        SELECT * FROM servicenow_artifacts 
        WHERE session_id = ? 
        ORDER BY created_at DESC
      `).all(session_id);
            return artifacts;
        }
        catch (error) {
            this.logger.error('Failed to get session artifacts', error);
            return [];
        }
    }
    // Clear session data (for cleanup)
    async clearSession(session_id) {
        try {
            this.logger.info(`Clearing session data for ${session_id}`);
            // Clear all session-related data
            this.db.prepare('DELETE FROM agent_coordination WHERE session_id = ?').run(session_id);
            this.db.prepare('DELETE FROM agent_messages WHERE session_id = ?').run(session_id);
            this.db.prepare('DELETE FROM shared_context WHERE session_id = ?').run(session_id);
            this.db.prepare('DELETE FROM agent_dependencies WHERE session_id = ?').run(session_id);
            this.db.prepare('DELETE FROM performance_metrics WHERE session_id = ?').run(session_id);
            this.logger.info(`Cleared session data for ${session_id}`);
        }
        catch (error) {
            this.logger.error('Failed to clear session', error);
            throw error;
        }
    }
    // Generic query method for custom queries
    async query(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            return stmt.all(...params);
        }
        catch (error) {
            this.logger.error('Query failed', { sql, error });
            throw error;
        }
    }
    // Close database connection
    close() {
        this.db.close();
    }
}
exports.MCPMemoryManager = MCPMemoryManager;
//# sourceMappingURL=mcp-memory-manager.js.map