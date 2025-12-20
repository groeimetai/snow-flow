import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  objective: string;
  provider: { id: string; model: string; baseURL?: string };
  mcp: { cmd: string; args?: string[] };
  messages: SessionMessage[];
  toolEvents?: { name: string; when: string; argsPreview?: string; resultPreview?: string }[];
  summary?: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sessionsDir(): string {
  const dir = path.join(os.homedir(), '.snow-flow', 'sessions');
  ensureDir(dir);
  return dir;
}

export function createSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sessionPath(id: string): string {
  return path.join(sessionsDir(), `${id}.json`);
}

export function startSession(rec: Omit<SessionRecord, 'messages' | 'toolEvents'> & { messages?: SessionMessage[] }): SessionRecord {
  const full: SessionRecord = { ...rec, messages: rec.messages ?? [], toolEvents: [] } as SessionRecord;
  fs.writeFileSync(sessionPath(rec.id), JSON.stringify(full, null, 2), 'utf8');
  return full;
}

export function readSession(id: string): SessionRecord | undefined {
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as SessionRecord;
}

export function listSessions(): { id: string; startedAt: string; objective: string }[] {
  const dir = sessionsDir();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as SessionRecord;
    return { id: rec.id, startedAt: rec.startedAt, objective: rec.objective };
  }).sort((a,b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function appendMessage(id: string, msg: SessionMessage): void {
  const rec = readSession(id);
  if (!rec) return;
  rec.messages.push(msg);
  fs.writeFileSync(sessionPath(id), JSON.stringify(rec, null, 2), 'utf8');
}

export function appendToolEvent(id: string, ev: { name: string; argsPreview?: string; resultPreview?: string }): void {
  const rec = readSession(id);
  if (!rec) return;
  const item = { name: ev.name, when: new Date().toISOString(), argsPreview: ev.argsPreview, resultPreview: ev.resultPreview };
  (rec.toolEvents = rec.toolEvents || []).push(item);
  fs.writeFileSync(sessionPath(id), JSON.stringify(rec, null, 2), 'utf8');
}

export function endSession(id: string, summary?: string): void {
  const rec = readSession(id);
  if (!rec) return;
  rec.endedAt = new Date().toISOString();
  if (summary) rec.summary = summary;
  fs.writeFileSync(sessionPath(id), JSON.stringify(rec, null, 2), 'utf8');
}

