import { Database } from "bun:sqlite"
import path from "path"
import { Global } from "../global"
import { Config } from "../config/config"
import { Log } from "../util/log"
import { Token } from "../util/token"

export namespace ContextDB {
  const log = Log.create({ service: "context-db" })

  let instance: Database | undefined
  let initPromise: Promise<Database | undefined> | undefined
  const DB_PATH = path.join(Global.Path.data, "context.db")

  export async function get(): Promise<Database | undefined> {
    if (instance) return instance
    if (initPromise) return initPromise

    initPromise = (async () => {
      const config = await Config.get()
      if (config.contextdb?.enabled === false) return undefined

      const db = new Database(DB_PATH)
      db.exec("PRAGMA journal_mode = WAL")
      db.exec("PRAGMA busy_timeout = 5000")
      migrate(db)
      instance = db
      return db
    })()

    return initPromise
  }

  function migrate(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS compaction_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        directory TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        files_mentioned TEXT DEFAULT '',
        tools_used TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_metadata (
        session_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        directory TEXT NOT NULL,
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        compaction_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tool_output_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        output_summary TEXT NOT NULL,
        output_path TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        source_session_id TEXT,
        created_at INTEGER NOT NULL,
        accessed_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS context_trajectory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        tokens_used INTEGER,
        relevance_score REAL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_compaction_project ON compaction_summaries(project_id);
      CREATE INDEX IF NOT EXISTS idx_compaction_session ON compaction_summaries(session_id);
      CREATE INDEX IF NOT EXISTS idx_tool_cache_hash ON tool_output_cache(input_hash);
      CREATE INDEX IF NOT EXISTS idx_memory_project ON memory_entries(project_id, category);
      CREATE INDEX IF NOT EXISTS idx_trajectory_session ON context_trajectory(session_id);
    `)

    // FTS5 tables — external content backed by regular tables
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS compaction_fts USING fts5(
        summary_text,
        files_mentioned,
        content=compaction_summaries,
        content_rowid=id
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS tool_output_fts USING fts5(
        output_summary,
        tool_name,
        content=tool_output_cache,
        content_rowid=id
      );
    `)

    // Sync triggers for compaction_summaries → compaction_fts
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS compaction_ai AFTER INSERT ON compaction_summaries BEGIN
        INSERT INTO compaction_fts(rowid, summary_text, files_mentioned)
        VALUES (new.id, new.summary_text, new.files_mentioned);
      END;

      CREATE TRIGGER IF NOT EXISTS compaction_ad AFTER DELETE ON compaction_summaries BEGIN
        INSERT INTO compaction_fts(compaction_fts, rowid, summary_text, files_mentioned)
        VALUES('delete', old.id, old.summary_text, COALESCE(old.files_mentioned, ''));
      END;
    `)

    // Sync triggers for tool_output_cache → tool_output_fts
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS tool_cache_ai AFTER INSERT ON tool_output_cache BEGIN
        INSERT INTO tool_output_fts(rowid, output_summary, tool_name)
        VALUES (new.id, new.output_summary, new.tool_name);
      END;

      CREATE TRIGGER IF NOT EXISTS tool_cache_ad AFTER DELETE ON tool_output_cache BEGIN
        INSERT INTO tool_output_fts(tool_output_fts, rowid, output_summary, tool_name)
        VALUES('delete', old.id, old.output_summary, COALESCE(old.tool_name, ''));
      END;
    `)
  }

  // ---------------------------------------------------------------------------
  // FTS5 query sanitization
  // ---------------------------------------------------------------------------

  function sanitizeQuery(raw: string): string {
    return raw
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 12)
      .join(" ")
  }

  // ---------------------------------------------------------------------------
  // Compaction summaries
  // ---------------------------------------------------------------------------

  export interface SummaryInput {
    sessionID: string
    projectID: string
    directory: string
    summaryText: string
    filesMentioned?: string
    toolsUsed?: string
  }

  export function storeSummary(input: SummaryInput) {
    const db = instance
    if (!db) return
    db.prepare(
      `INSERT INTO compaction_summaries (session_id, project_id, directory, summary_text, files_mentioned, tools_used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.sessionID,
      input.projectID,
      input.directory,
      input.summaryText,
      input.filesMentioned ?? "",
      input.toolsUsed ?? "",
      Date.now(),
    )

    db.prepare(
      `INSERT INTO session_metadata (session_id, project_id, directory, created_at, updated_at, compaction_count)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(session_id) DO UPDATE SET
         updated_at = excluded.updated_at,
         compaction_count = compaction_count + 1`,
    ).run(input.sessionID, input.projectID, input.directory, Date.now(), Date.now())

    log.info("stored compaction summary", { sessionID: input.sessionID })
  }

  export interface SearchResult {
    sessionID: string
    summaryText: string
    filesMentioned: string
    createdAt: number
    rank: number
  }

  export function searchSummaries(input: {
    query: string
    projectID: string
    excludeSessionID?: string
    limit?: number
    maxTokens?: number
  }): SearchResult[] {
    const db = instance
    if (!db) return []

    const q = sanitizeQuery(input.query)
    if (!q) return []

    const limit = input.limit ?? 3

    type Row = { session_id: string; summary_text: string; files_mentioned: string; created_at: number; rank: number }

    const rows: Row[] = input.excludeSessionID
      ? (db
          .prepare(
            `SELECT cs.session_id, cs.summary_text, cs.files_mentioned, cs.created_at, rank
             FROM compaction_fts
             JOIN compaction_summaries cs ON compaction_fts.rowid = cs.id
             WHERE compaction_fts MATCH ?1
               AND cs.project_id = ?2
               AND cs.session_id != ?3
             ORDER BY rank
             LIMIT ?4`,
          )
          .all(q, input.projectID, input.excludeSessionID, limit) as Row[])
      : (db
          .prepare(
            `SELECT cs.session_id, cs.summary_text, cs.files_mentioned, cs.created_at, rank
             FROM compaction_fts
             JOIN compaction_summaries cs ON compaction_fts.rowid = cs.id
             WHERE compaction_fts MATCH ?1
               AND cs.project_id = ?2
             ORDER BY rank
             LIMIT ?3`,
          )
          .all(q, input.projectID, limit) as Row[])

    const results: SearchResult[] = []
    let totalTokens = 0

    for (const r of rows) {
      const tokens = Token.estimate(r.summary_text)
      if (input.maxTokens && totalTokens + tokens > input.maxTokens) break
      totalTokens += tokens
      results.push({
        sessionID: r.session_id,
        summaryText: r.summary_text,
        filesMentioned: r.files_mentioned,
        createdAt: r.created_at,
        rank: r.rank,
      })
    }
    return results
  }

  // ---------------------------------------------------------------------------
  // Cross-session context retrieval (for prompt assembly)
  // ---------------------------------------------------------------------------

  export async function retrieveContext(input: {
    sessionID: string
    projectID: string
    userQuery: string
  }): Promise<string[]> {
    const config = await Config.get()
    if (config.contextdb?.cross_session_retrieval === false) return []

    const db = await get()
    if (!db) return []

    const results = searchSummaries({
      query: input.userQuery,
      projectID: input.projectID,
      excludeSessionID: input.sessionID,
      limit: 3,
      maxTokens: 10_000,
    })

    if (results.length === 0) return []

    logTrajectory({
      sessionID: input.sessionID,
      sourceType: "cross-session",
      tokensUsed: results.reduce((sum, r) => sum + Token.estimate(r.summaryText), 0),
    })

    const block = results.map((r) => r.summaryText).join("\n---\n")
    return [`<prior-session-context>\n${block}\n</prior-session-context>`]
  }

  // ---------------------------------------------------------------------------
  // Tool output cache
  // ---------------------------------------------------------------------------

  export function storeToolOutput(input: {
    sessionID: string
    toolName: string
    inputHash: string
    outputSummary: string
    outputPath?: string
  }) {
    const db = instance
    if (!db) return
    db.prepare(
      `INSERT INTO tool_output_cache (session_id, tool_name, input_hash, output_summary, output_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(input.sessionID, input.toolName, input.inputHash, input.outputSummary, input.outputPath ?? null, Date.now())
  }

  export function findToolOutput(inputHash: string): { outputSummary: string; outputPath: string | null } | undefined {
    const db = instance
    if (!db) return undefined
    const row = db
      .prepare(
        `SELECT output_summary, output_path FROM tool_output_cache
         WHERE input_hash = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(inputHash) as { output_summary: string; output_path: string | null } | null
    if (!row) return undefined
    return { outputSummary: row.output_summary, outputPath: row.output_path }
  }

  // ---------------------------------------------------------------------------
  // Memory entries
  // ---------------------------------------------------------------------------

  export function storeMemory(input: {
    id: string
    projectID: string
    category: string
    content: string
    sourceSessionID?: string
  }) {
    const db = instance
    if (!db) return
    const now = Date.now()
    db.prepare(
      `INSERT OR REPLACE INTO memory_entries (id, project_id, category, content, source_session_id, created_at, accessed_at, access_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(input.id, input.projectID, input.category, input.content, input.sourceSessionID ?? null, now, now)
  }

  export function getMemories(
    projectID: string,
    category?: string,
  ): Array<{ id: string; category: string; content: string; accessCount: number }> {
    const db = instance
    if (!db) return []

    const rows = category
      ? db
          .prepare(
            `SELECT id, category, content, access_count FROM memory_entries
             WHERE project_id = ? AND category = ?
             ORDER BY accessed_at DESC`,
          )
          .all(projectID, category)
      : db
          .prepare(
            `SELECT id, category, content, access_count FROM memory_entries
             WHERE project_id = ?
             ORDER BY accessed_at DESC`,
          )
          .all(projectID)

    return (rows as Array<{ id: string; category: string; content: string; access_count: number }>).map((r) => ({
      id: r.id,
      category: r.category,
      content: r.content,
      accessCount: r.access_count,
    }))
  }

  // ---------------------------------------------------------------------------
  // Context trajectory (debugging / observability)
  // ---------------------------------------------------------------------------

  export function logTrajectory(input: {
    sessionID: string
    sourceType: string
    sourceID?: string
    tokensUsed?: number
    relevanceScore?: number
  }) {
    const db = instance
    if (!db) return
    db.prepare(
      `INSERT INTO context_trajectory (session_id, source_type, source_id, tokens_used, relevance_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      input.sessionID,
      input.sourceType,
      input.sourceID ?? null,
      input.tokensUsed ?? null,
      input.relevanceScore ?? null,
      Date.now(),
    )
  }

  // ---------------------------------------------------------------------------
  // File reference extraction (helper for compaction integration)
  // ---------------------------------------------------------------------------

  export function extractFileReferences(text: string): string {
    const matches = text.match(/(?:^|\s)((?:\/|\.\.?\/|src\/|packages\/)\S+\.\w{1,10})/gm)
    if (!matches) return ""
    const unique = [...new Set(matches.map((m) => m.trim()))]
    return unique.join(" ")
  }

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

  export function cleanup(maxAgeDays = 90) {
    const db = instance
    if (!db) return
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    db.prepare("DELETE FROM compaction_summaries WHERE created_at < ?").run(cutoff)
    db.prepare("DELETE FROM tool_output_cache WHERE created_at < ?").run(cutoff)
    db.prepare("DELETE FROM context_trajectory WHERE created_at < ?").run(cutoff)
    log.info("cleaned up old context data", { maxAgeDays })
  }

  export function close() {
    instance?.close()
    instance = undefined
    initPromise = undefined
  }
}
