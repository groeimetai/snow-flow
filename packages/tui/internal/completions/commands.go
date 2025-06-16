package completions

import (
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/lithammer/fuzzysearch/fuzzy"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/commands"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/theme"
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

func (c *CommandCompletionProvider) GetEmptyMessage() string {
	return "no matching commands"
}

func getCommandCompletionItem(cmd commands.Command, space int) dialog.CompletionItemI {
	t := theme.CurrentTheme()
	spacer := strings.Repeat(" ", space)
	title := "  /" + cmd.Name + lipgloss.NewStyle().Foreground(t.TextMuted()).Render(spacer+cmd.Description)
	value := "/" + cmd.Name
	return dialog.NewCompletionItem(dialog.CompletionItem{
		Title: title,
		Value: value,
	})
}

func (c *CommandCompletionProvider) GetChildEntries(query string) ([]dialog.CompletionItemI, error) {
	space := 1
	for _, cmd := range c.app.Commands {
		if lipgloss.Width(cmd.Name) > space {
			space = lipgloss.Width(cmd.Name)
		}
	}
	space += 2

	if query == "" {
		// If no query, return all commands
		items := []dialog.CompletionItemI{}
		for _, cmd := range c.app.Commands {
			space := space - lipgloss.Width(cmd.Name)
			items = append(items, getCommandCompletionItem(cmd, space))
		}
		return items, nil
	}

	// Use fuzzy matching for commands
	var commandNames []string
	commandMap := make(map[string]dialog.CompletionItemI)

	for _, cmd := range c.app.Commands {
		space := space - lipgloss.Width(cmd.Name)
		commandNames = append(commandNames, cmd.Name)
		commandMap[cmd.Name] = getCommandCompletionItem(cmd, space)
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
