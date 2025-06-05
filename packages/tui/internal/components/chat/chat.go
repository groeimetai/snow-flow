package chat

import (
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

type SendMsg struct {
	Text        string
	Attachments []app.Attachment
}

func repo(width int) string {
	repo := "github.com/sst/opencode"
	t := theme.CurrentTheme()

	return styles.BaseStyle().
		Foreground(t.TextMuted()).
		Width(width).
		Render(repo)
}
