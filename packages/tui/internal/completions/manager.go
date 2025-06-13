package completions

import (
	"strings"

	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/dialog"
)

type CompletionManager struct {
	providers map[string]dialog.CompletionProvider
}

func NewCompletionManager(app *app.App) *CompletionManager {
	return &CompletionManager{
		providers: map[string]dialog.CompletionProvider{
			"files":    NewFileAndFolderContextGroup(app),
			"commands": NewCommandCompletionProvider(app),
		},
	}
}

func (m *CompletionManager) GetProvider(input string) dialog.CompletionProvider {
	if strings.HasPrefix(input, "/") {
		return m.providers["commands"]
	}
	return m.providers["files"]
}

