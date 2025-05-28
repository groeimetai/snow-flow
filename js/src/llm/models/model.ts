export interface ModelInfo {
  cost: {
    input: number;
    inputCached: number;
    output: number;
    outputCached: number;
  };
  contextWindow: number;
  maxTokens: number;
  attachment: boolean;
}
