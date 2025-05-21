package format

import (
	"encoding/json"
	"fmt"
)

// OutputFormat represents the format for non-interactive mode output
type OutputFormat string

const (
	// TextFormat is plain text output (default)
	TextFormat OutputFormat = "text"

	// JSONFormat is output wrapped in a JSON object
	JSONFormat OutputFormat = "json"
)

// IsValid checks if the output format is valid
func (f OutputFormat) IsValid() bool {
	return f == TextFormat || f == JSONFormat
}

// String returns the string representation of the output format
func (f OutputFormat) String() string {
	return string(f)
}

// FormatOutput formats the given content according to the specified format
func FormatOutput(content string, format OutputFormat) (string, error) {
	switch format {
	case TextFormat:
		return content, nil
	case JSONFormat:
		jsonData := map[string]string{
			"response": content,
		}
		jsonBytes, err := json.MarshalIndent(jsonData, "", "  ")
		if err != nil {
			return "", fmt.Errorf("failed to marshal JSON: %w", err)
		}
		return string(jsonBytes), nil
	default:
		return "", fmt.Errorf("unsupported output format: %s", format)
	}
}
