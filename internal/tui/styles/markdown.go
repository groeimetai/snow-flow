package styles

import (
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/glamour/ansi"
	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/tui/theme"
)

const defaultMargin = 1

// Helper functions for style pointers
func boolPtr(b bool) *bool       { return &b }
func stringPtr(s string) *string { return &s }
func uintPtr(u uint) *uint       { return &u }

// returns a glamour TermRenderer configured with the current theme
func GetMarkdownRenderer(width int) *glamour.TermRenderer {
	r, _ := glamour.NewTermRenderer(
		glamour.WithStyles(generateMarkdownStyleConfig()),
		glamour.WithWordWrap(width),
	)
	return r
}

// creates an ansi.StyleConfig for markdown rendering
// using adaptive colors from the provided theme.
func generateMarkdownStyleConfig() ansi.StyleConfig {
	t := theme.CurrentTheme()

	return ansi.StyleConfig{
		Document: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				BlockPrefix: "",
				BlockSuffix: "",
				Color:       stringPtr(adaptiveColorToString(t.MarkdownText())),
			},
			Margin: uintPtr(defaultMargin),
		},
		BlockQuote: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:  stringPtr(adaptiveColorToString(t.MarkdownBlockQuote())),
				Italic: boolPtr(true),
				Prefix: "┃ ",
			},
			Indent:      uintPtr(1),
			IndentToken: stringPtr(BaseStyle().Render(" ")),
		},
		List: ansi.StyleList{
			LevelIndent: defaultMargin,
			StyleBlock: ansi.StyleBlock{
				IndentToken: stringPtr(BaseStyle().Render(" ")),
				StylePrimitive: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.MarkdownText())),
				},
			},
		},
		Heading: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				BlockSuffix: "\n",
				Color:       stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:        boolPtr(true),
			},
		},
		H1: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Prefix: "# ",
				Color:  stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:   boolPtr(true),
			},
		},
		H2: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Prefix: "## ",
				Color:  stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:   boolPtr(true),
			},
		},
		H3: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Prefix: "### ",
				Color:  stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:   boolPtr(true),
			},
		},
		H4: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Prefix: "#### ",
				Color:  stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:   boolPtr(true),
			},
		},
		H5: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Prefix: "##### ",
				Color:  stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:   boolPtr(true),
			},
		},
		H6: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Prefix: "###### ",
				Color:  stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				Bold:   boolPtr(true),
			},
		},
		Strikethrough: ansi.StylePrimitive{
			CrossedOut: boolPtr(true),
			Color:      stringPtr(adaptiveColorToString(t.TextMuted())),
		},
		Emph: ansi.StylePrimitive{
			Color:  stringPtr(adaptiveColorToString(t.MarkdownEmph())),
			Italic: boolPtr(true),
		},
		Strong: ansi.StylePrimitive{
			Bold:  boolPtr(true),
			Color: stringPtr(adaptiveColorToString(t.MarkdownStrong())),
		},
		HorizontalRule: ansi.StylePrimitive{
			Color:  stringPtr(adaptiveColorToString(t.MarkdownHorizontalRule())),
			Format: "\n─────────────────────────────────────────\n",
		},
		Item: ansi.StylePrimitive{
			BlockPrefix: "• ",
			Color:       stringPtr(adaptiveColorToString(t.MarkdownListItem())),
		},
		Enumeration: ansi.StylePrimitive{
			BlockPrefix: ". ",
			Color:       stringPtr(adaptiveColorToString(t.MarkdownListEnumeration())),
		},
		Task: ansi.StyleTask{
			StylePrimitive: ansi.StylePrimitive{},
			Ticked:         "[✓] ",
			Unticked:       "[ ] ",
		},
		Link: ansi.StylePrimitive{
			Color:     stringPtr(adaptiveColorToString(t.MarkdownLink())),
			Underline: boolPtr(true),
		},
		LinkText: ansi.StylePrimitive{
			Color: stringPtr(adaptiveColorToString(t.MarkdownLinkText())),
			Bold:  boolPtr(true),
		},
		Image: ansi.StylePrimitive{
			Color:     stringPtr(adaptiveColorToString(t.MarkdownImage())),
			Underline: boolPtr(true),
			Format:    "🖼 {{.text}}",
		},
		ImageText: ansi.StylePrimitive{
			Color:  stringPtr(adaptiveColorToString(t.MarkdownImageText())),
			Format: "{{.text}}",
		},
		Code: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:  stringPtr(adaptiveColorToString(t.MarkdownCode())),
				Prefix: "",
				Suffix: "",
			},
		},
		CodeBlock: ansi.StyleCodeBlock{
			StyleBlock: ansi.StyleBlock{
				StylePrimitive: ansi.StylePrimitive{
					Prefix: " ",
					Color:  stringPtr(adaptiveColorToString(t.MarkdownCodeBlock())),
				},
			},
			Chroma: &ansi.Chroma{
				Text: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.MarkdownText())),
				},
				Error: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.Error())),
				},
				Comment: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxComment())),
				},
				CommentPreproc: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxKeyword())),
				},
				Keyword: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxKeyword())),
				},
				KeywordReserved: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxKeyword())),
				},
				KeywordNamespace: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxKeyword())),
				},
				KeywordType: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxType())),
				},
				Operator: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxOperator())),
				},
				Punctuation: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxPunctuation())),
				},
				Name: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxVariable())),
				},
				NameBuiltin: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxVariable())),
				},
				NameTag: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxKeyword())),
				},
				NameAttribute: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxFunction())),
				},
				NameClass: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxType())),
				},
				NameConstant: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxVariable())),
				},
				NameDecorator: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxFunction())),
				},
				NameFunction: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxFunction())),
				},
				LiteralNumber: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxNumber())),
				},
				LiteralString: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxString())),
				},
				LiteralStringEscape: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.SyntaxKeyword())),
				},
				GenericDeleted: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.DiffRemoved())),
				},
				GenericEmph: ansi.StylePrimitive{
					Color:  stringPtr(adaptiveColorToString(t.MarkdownEmph())),
					Italic: boolPtr(true),
				},
				GenericInserted: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.DiffAdded())),
				},
				GenericStrong: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.MarkdownStrong())),
					Bold:  boolPtr(true),
				},
				GenericSubheading: ansi.StylePrimitive{
					Color: stringPtr(adaptiveColorToString(t.MarkdownHeading())),
				},
			},
		},
		Table: ansi.StyleTable{
			StyleBlock: ansi.StyleBlock{
				StylePrimitive: ansi.StylePrimitive{
					BlockPrefix: "\n",
					BlockSuffix: "\n",
				},
			},
			CenterSeparator: stringPtr("┼"),
			ColumnSeparator: stringPtr("│"),
			RowSeparator:    stringPtr("─"),
		},
		DefinitionDescription: ansi.StylePrimitive{
			BlockPrefix: "\n ❯ ",
			Color:       stringPtr(adaptiveColorToString(t.MarkdownLinkText())),
		},
		Text: ansi.StylePrimitive{
			Color: stringPtr(adaptiveColorToString(t.MarkdownText())),
		},
		Paragraph: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color: stringPtr(adaptiveColorToString(t.MarkdownText())),
			},
		},
	}
}

// adaptiveColorToString converts a lipgloss.AdaptiveColor to the appropriate
// hex color string based on the current terminal background
func adaptiveColorToString(color lipgloss.AdaptiveColor) string {
	if lipgloss.HasDarkBackground() {
		return color.Dark
	}
	return color.Light
}
