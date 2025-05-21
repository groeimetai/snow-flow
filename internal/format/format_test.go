package format

import (
	"testing"
)

func TestOutputFormat_IsValid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		format OutputFormat
		want   bool
	}{
		{
			name:   "text format",
			format: TextFormat,
			want:   true,
		},
		{
			name:   "json format",
			format: JSONFormat,
			want:   true,
		},
		{
			name:   "invalid format",
			format: "invalid",
			want:   false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := tt.format.IsValid(); got != tt.want {
				t.Errorf("OutputFormat.IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFormatOutput(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		content string
		format  OutputFormat
		want    string
		wantErr bool
	}{
		{
			name:    "text format",
			content: "test content",
			format:  TextFormat,
			want:    "test content",
			wantErr: false,
		},
		{
			name:    "json format",
			content: "test content",
			format:  JSONFormat,
			want:    "{\n  \"response\": \"test content\"\n}",
			wantErr: false,
		},
		{
			name:    "invalid format",
			content: "test content",
			format:  "invalid",
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := FormatOutput(tt.content, tt.format)
			if (err != nil) != tt.wantErr {
				t.Errorf("FormatOutput() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("FormatOutput() = %v, want %v", got, tt.want)
			}
		})
	}
}
