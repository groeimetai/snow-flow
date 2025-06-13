package completions

import (
	"sort"

	"github.com/lithammer/fuzzysearch/fuzzy"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/dialog"
)

type CommandCompletionProvider struct {
	app *app.App
}

func NewCommandCompletionProvider(app *app.App) dialog.CompletionProvider {
	return &CommandCompletionProvider{app: app}
}

func (c *CommandCompletionProvider) GetId() string {
	return "commands"
}

func (c *CommandCompletionProvider) GetEntry() dialog.CompletionItemI {
	return dialog.NewCompletionItem(dialog.CompletionItem{
		Title: "Commands",
		Value: "commands",
	})
}

func (c *CommandCompletionProvider) GetChildEntries(query string) ([]dialog.CompletionItemI, error) {
	if query == "" {
		// If no query, return all commands
		items := []dialog.CompletionItemI{}
		for _, cmd := range c.app.Commands {
			items = append(items, dialog.NewCompletionItem(dialog.CompletionItem{
				Title: "  /" + cmd.Name,
				Value: "/" + cmd.Name,
			}))
		}
		return items, nil
	}

	// Use fuzzy matching for commands
	var commandNames []string
	commandMap := make(map[string]dialog.CompletionItemI)

	for _, cmd := range c.app.Commands {
		commandNames = append(commandNames, cmd.Name)
		commandMap[cmd.Name] = dialog.NewCompletionItem(dialog.CompletionItem{
			Title: "  /" + cmd.Name,
			Value: "/" + cmd.Name,
		})
	}

	// Find fuzzy matches
	matches := fuzzy.RankFind(query, commandNames)

	// Sort by score (best matches first)
	sort.Sort(matches)

	// Convert matches to completion items
	items := []dialog.CompletionItemI{}
	for _, match := range matches {
		if item, ok := commandMap[match.Target]; ok {
			items = append(items, item)
		}
	}

	return items, nil
}

