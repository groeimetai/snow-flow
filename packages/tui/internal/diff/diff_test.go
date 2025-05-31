package diff

import (
	"fmt"
	"testing"

	"github.com/charmbracelet/lipgloss"
	"github.com/stretchr/testify/assert"
)

// TestApplyHighlighting tests the applyHighlighting function with various ANSI sequences
func TestApplyHighlighting(t *testing.T) {
	t.Parallel()

	// Mock theme colors for testing
	mockHighlightBg := lipgloss.AdaptiveColor{
		Dark:  "#FF0000", // Red background for highlighting
		Light: "#FF0000",
	}

	// Test cases
	tests := []struct {
		name           string
		content        string
		segments       []Segment
		segmentType    LineType
		expectContains string
	}{
		{
			name:        "Simple text with no ANSI",
			content:     "This is a test",
			segments:    []Segment{{Start: 0, End: 4, Type: LineAdded}},
			segmentType: LineAdded,
			// Should contain full reset sequence after highlighting
			expectContains: "\x1b[0m",
		},
		{
			name:        "Text with existing ANSI foreground",
			content:     "This \x1b[32mis\x1b[0m a test", // "is" in green
			segments:    []Segment{{Start: 5, End: 7, Type: LineAdded}},
			segmentType: LineAdded,
			// Should contain full reset sequence after highlighting
			expectContains: "\x1b[0m",
		},
		{
			name:        "Text with existing ANSI background",
			content:     "This \x1b[42mis\x1b[0m a test", // "is" with green background
			segments:    []Segment{{Start: 5, End: 7, Type: LineAdded}},
			segmentType: LineAdded,
			// Should contain full reset sequence after highlighting
			expectContains: "\x1b[0m",
		},
		{
			name:        "Text with complex ANSI styling",
			content:     "This \x1b[1;32;45mis\x1b[0m a test", // "is" bold green on magenta
			segments:    []Segment{{Start: 5, End: 7, Type: LineAdded}},
			segmentType: LineAdded,
			// Should contain full reset sequence after highlighting
			expectContains: "\x1b[0m",
		},
	}

	for _, tc := range tests {
		tc := tc // Capture range variable for parallel testing
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			result := applyHighlighting(tc.content, tc.segments, tc.segmentType, mockHighlightBg)
			
			// Verify the result contains the expected sequence
			assert.Contains(t, result, tc.expectContains, 
				"Result should contain full reset sequence")
			
			// Print the result for manual inspection if needed
			if t.Failed() {
				fmt.Printf("Original: %q\nResult: %q\n", tc.content, result)
			}
		})
	}
}

// TestApplyHighlightingWithMultipleSegments tests highlighting multiple segments
func TestApplyHighlightingWithMultipleSegments(t *testing.T) {
	t.Parallel()

	// Mock theme colors for testing
	mockHighlightBg := lipgloss.AdaptiveColor{
		Dark:  "#FF0000", // Red background for highlighting
		Light: "#FF0000",
	}

	content := "This is a test with multiple segments to highlight"
	segments := []Segment{
		{Start: 0, End: 4, Type: LineAdded},   // "This"
		{Start: 8, End: 9, Type: LineAdded},   // "a"
		{Start: 15, End: 23, Type: LineAdded}, // "multiple"
	}

	result := applyHighlighting(content, segments, LineAdded, mockHighlightBg)
	
	// Verify the result contains the full reset sequence
	assert.Contains(t, result, "\x1b[0m", 
		"Result should contain full reset sequence")
}