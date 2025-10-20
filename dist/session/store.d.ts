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
    provider: {
        id: string;
        model: string;
        baseURL?: string;
    };
    mcp: {
        cmd: string;
        args?: string[];
    };
    messages: SessionMessage[];
    toolEvents?: {
        name: string;
        when: string;
        argsPreview?: string;
        resultPreview?: string;
    }[];
    summary?: string;
}
export declare function createSessionId(): string;
export declare function startSession(rec: Omit<SessionRecord, 'messages' | 'toolEvents'> & {
    messages?: SessionMessage[];
}): SessionRecord;
export declare function readSession(id: string): SessionRecord | undefined;
export declare function listSessions(): {
    id: string;
    startedAt: string;
    objective: string;
}[];
export declare function appendMessage(id: string, msg: SessionMessage): void;
export declare function appendToolEvent(id: string, ev: {
    name: string;
    argsPreview?: string;
    resultPreview?: string;
}): void;
export declare function endSession(id: string, summary?: string): void;
//# sourceMappingURL=store.d.ts.map