/**
 * Chunking Manager for Large ServiceNow Artifacts
 * Handles scripts >30k characters that exceed API token limits
 */

export interface ChunkingStrategy {
  maxChunkSize: number;
  overlapSize: number;  // Overlap between chunks to maintain context
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

export class ChunkingManager {
  
  /**
   * Determine if script needs chunking
   */
  static needsChunking(script: string, maxSize: number = 5000000): boolean {
    // 5MB = ServiceNow's actual response limit
    return script.length > maxSize;
  }

  /**
   * Split large script into manageable chunks
   */
  static chunkScript(script: string, strategy: ChunkingStrategy = {
    maxChunkSize: 2500000, // 2.5MB chunks
    overlapSize: 500,
    chunkType: 'functions'
  }): ScriptChunk[] {
    const lines = script.split('\n');
    const chunks: ScriptChunk[] = [];
    
    if (!this.needsChunking(script)) {
      return [{
        index: 0,
        content: script,
        startLine: 1,
        endLine: lines.length,
        type: 'complete',
        hasContext: true
      }];
    }

    let currentChunk = '';
    let currentStartLine = 1;
    let chunkIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const potentialChunk = currentChunk + line + '\n';
      
      if (potentialChunk.length > strategy.maxChunkSize) {
        // Current chunk is full, save it
        if (currentChunk.trim()) {
          chunks.push({
            index: chunkIndex++,
            content: currentChunk.trim(),
            startLine: currentStartLine,
            endLine: i,
            type: chunkIndex === 0 ? 'partial_start' : 'partial_middle',
            hasContext: true
          });
        }
        
        // Start new chunk with overlap
        const overlapLines = Math.min(
          Math.floor(strategy.overlapSize / 50), // Assume ~50 chars per line
          10 // Max 10 lines overlap
        );
        
        const overlapStart = Math.max(0, i - overlapLines);
        currentChunk = lines.slice(overlapStart, i + 1).join('\n') + '\n';
        currentStartLine = overlapStart + 1;
      } else {
        currentChunk += line + '\n';
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        index: chunkIndex,
        content: currentChunk.trim(),
        startLine: currentStartLine,
        endLine: lines.length,
        type: 'partial_end',
        hasContext: true
      });
    }
    
    return chunks;
  }

  /**
   * Generate instructions for manual large script handling
   */
  static generateManualInstructions(scriptName: string, scriptSize: number, chunks: ScriptChunk[]): string {
    return `
🚨 LARGE SCRIPT DETECTED: ${scriptName} (${scriptSize.toLocaleString()} characters)

⚠️ This script exceeds API token limits and cannot be updated automatically.

🔧 MANUAL UPDATE REQUIRED:

1. **Navigate to ServiceNow**:
   - Go to Service Portal → Widgets
   - Find and edit your widget
   - Click on "Server Script" tab

2. **Copy the updated script**:
   - Script has been split into ${chunks.length} chunks below
   - Copy ALL chunks in order and paste into ServiceNow

3. **Chunks to copy**:
${chunks.map(chunk => `
   **Chunk ${chunk.index + 1}/${chunks.length}** (Lines ${chunk.startLine}-${chunk.endLine}):
   \`\`\`javascript
   ${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? '...\n[truncated for display]' : ''}
   \`\`\`
`).join('')}

4. **Validation**:
   - Ensure no syntax errors after pasting
   - Test widget functionality
   - Consider breaking into smaller Script Includes

💡 **Prevention for future**:
- Keep server scripts under 30,000 characters
- Use Script Includes for reusable functions
- Move complex logic to business rules where appropriate
`;
  }

  /**
   * Attempt smart chunked update for large scripts
   */
  static async attemptChunkedUpdate(
    client: any,
    table: string,
    sys_id: string,
    field: string,
    script: string
  ): Promise<{success: boolean, message: string}> {
    
    if (!this.needsChunking(script)) {
      // Not chunked, do normal update
      try {
        await client.updateRecord(table, sys_id, { [field]: script });
        return { success: true, message: 'Script updated successfully' };
      } catch (error) {
        return { success: false, message: `Update failed: ${error}` };
      }
    }

    // For large scripts, we can't actually chunk the API call
    // But we can provide intelligent guidance
    const chunks = this.chunkScript(script);
    const instructions = this.generateManualInstructions(field, script.length, chunks);
    
    return {
      success: false,
      message: `Script too large for automatic update. Manual steps required:\n${instructions}`
    };
  }
}