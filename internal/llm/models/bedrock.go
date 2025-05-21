package models

const (
	ProviderBedrock ModelProvider = "bedrock"

	// Models
	BedrockClaude37Sonnet ModelID = "bedrock.claude-3.7-sonnet"
)

var BedrockModels = map[ModelID]Model{
	BedrockClaude37Sonnet: {
		ID:                  BedrockClaude37Sonnet,
		Name:                "Bedrock: Claude 3.7 Sonnet",
		Provider:            ProviderBedrock,
		APIModel:            "anthropic.claude-3-7-sonnet-20250219-v1:0",
		CostPer1MIn:         3.0,
		CostPer1MInCached:   3.75,
		CostPer1MOutCached:  0.30,
		CostPer1MOut:        15.0,
		ContextWindow:       200_000,
		DefaultMaxTokens:    50_000,
		CanReason:           true,
		SupportsAttachments: true,
	},
}
