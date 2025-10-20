/**
 * Chunking Manager for Large ServiceNow Artifacts
 * Handles scripts >30k characters that exceed API token limits
 */
export interface ChunkingStrategy {
    maxChunkSize: number;
    overlapSize: number;
    chunkType: 'lines' | 'functions' | 'blocks';
}
export interface ScriptChunk {
    index: number;
    content: string;
    startLine: number;
    endLine: number;
    type: 'complete' | 'partial_start' | 'partial_middle' | 'partial_end';
    hasContext: boolean;
}
export declare class ChunkingManager {
    /**
     * Determine if script needs chunking
     */
    static needsChunking(script: string, maxSize?: number): boolean;
    /**
     * Split large script into manageable chunks
     */
    static chunkScript(script: string, strategy?: ChunkingStrategy): ScriptChunk[];
    /**
     * Generate instructions for manual large script handling
     */
    static generateManualInstructions(scriptName: string, scriptSize: number, chunks: ScriptChunk[]): string;
    /**
     * Attempt smart chunked update for large scripts
     */
    static attemptChunkedUpdate(client: any, table: string, sys_id: string, field: string, script: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=chunking-manager.d.ts.map