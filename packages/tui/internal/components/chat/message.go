package chat

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/sst/opencode/internal/components/diff"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/pkg/client"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

const (
	maxResultHeight = 10
)

func toMarkdown(content string, width int) string {
	r := styles.GetMarkdownRenderer(width)
	rendered, _ := r.Render(content)
	return strings.TrimSuffix(rendered, "\n")
}

func renderUserMessage(user string, msg client.MessageInfo, width int) string {
	t := theme.CurrentTheme()
	style := styles.BaseStyle().
		PaddingLeft(1).
		BorderLeft(true).
		Foreground(t.TextMuted()).
		BorderForeground(t.Secondary()).
		BorderStyle(lipgloss.ThickBorder())

	// var styledAttachments []string
	// attachmentStyles := baseStyle.
	// 	MarginLeft(1).
	// 	Background(t.TextMuted()).
	// 	Foreground(t.Text())
	// for _, attachment := range msg.BinaryContent() {
	// 	file := filepath.Base(attachment.Path)
	// 	var filename string
	// 	if len(file) > 10 {
	// 		filename = fmt.Sprintf(" %s %s...", styles.DocumentIcon, file[0:7])
	// 	} else {
	// 		filename = fmt.Sprintf(" %s %s", styles.DocumentIcon, file)
	// 	}
	// 	styledAttachments = append(styledAttachments, attachmentStyles.Render(filename))
	// }

	timestamp := time.UnixMilli(int64(msg.Metadata.Time.Created)).Local().Format("02 Jan 2006 03:04 PM")
	if time.Now().Format("02 Jan 2006") == timestamp[:11] {
		timestamp = timestamp[12:]
	}
	info := styles.BaseStyle().
		Foreground(t.TextMuted()).
		Render(fmt.Sprintf("%s (%s)", user, timestamp))

	content := ""
	// if len(styledAttachments) > 0 {
	// 	attachmentContent := baseStyle.Width(width).Render(lipgloss.JoinHorizontal(lipgloss.Left, styledAttachments...))
	// 	content = renderMessage(msg.Content().String(), true, isFocused, width, append(info, attachmentContent)...)
	// } else {
	for _, p := range msg.Parts {
		part, err := p.ValueByDiscriminator()
		if err != nil {
			continue //TODO: handle error?
		}

		switch part.(type) {
		case client.MessagePartText:
			textPart := part.(client.MessagePartText)
			text := toMarkdown(textPart.Text, width)
			content = style.Render(lipgloss.JoinVertical(lipgloss.Left, text, info))
		}
	}

	return styles.ForceReplaceBackgroundWithLipgloss(content, t.Background())
}

func renderAssistantMessage(
	msg client.MessageInfo,
	width int,
	showToolMessages bool,
	appInfo client.AppInfo,
) string {
	t := theme.CurrentTheme()
	style := styles.BaseStyle().
		PaddingLeft(1).
		BorderLeft(true).
		Foreground(t.TextMuted()).
		BorderForeground(t.Primary()).
		BorderStyle(lipgloss.ThickBorder())
	messages := []string{}

	timestamp := time.UnixMilli(int64(msg.Metadata.Time.Created)).Local().Format("02 Jan 2006 03:04 PM")
	if time.Now().Format("02 Jan 2006") == timestamp[:11] {
		timestamp = timestamp[12:]
	}
	modelName := msg.Metadata.Assistant.ModelID
	info := styles.BaseStyle().
		Foreground(t.TextMuted()).
		Render(fmt.Sprintf("%s (%s)", modelName, timestamp))

	for _, p := range msg.Parts {
		part, err := p.ValueByDiscriminator()
		if err != nil {
			continue //TODO: handle error?
		}

		switch part.(type) {
		// case client.MessagePartReasoning:
		// 	reasoningPart := part.(client.MessagePartReasoning)

		case client.MessagePartText:
			textPart := part.(client.MessagePartText)
			text := toMarkdown(textPart.Text, width)
			content := style.Render(lipgloss.JoinVertical(lipgloss.Left, text, info))
			message := styles.ForceReplaceBackgroundWithLipgloss(content, t.Background())
			messages = append(messages, message)

		case client.MessagePartToolInvocation:
			if !showToolMessages {
				continue
			}

			toolInvocationPart := part.(client.MessagePartToolInvocation)
			toolCall, _ := toolInvocationPart.ToolInvocation.AsMessageToolInvocationToolCall()
			var result *string
			resultPart, resultError := toolInvocationPart.ToolInvocation.AsMessageToolInvocationToolResult()
			if resultError == nil {
				result = &resultPart.Result
			}
			metadata := map[string]any{}
			if _, ok := msg.Metadata.Tool[toolCall.ToolCallId]; ok {
				metadata = msg.Metadata.Tool[toolCall.ToolCallId].(map[string]any)
			}
			message := renderToolInvocation(toolCall, result, metadata, appInfo, width)
			messages = append(messages, message)
		}
	}

	return strings.Join(messages, "\n\n")
}

func renderToolInvocation(toolCall client.MessageToolInvocationToolCall, result *string, metadata map[string]any, appInfo client.AppInfo, width int) string {
	t := theme.CurrentTheme()
	style := styles.BaseStyle().
		BorderLeft(true).
		PaddingLeft(1).
		Foreground(t.TextMuted()).
		BorderForeground(t.TextMuted()).
		BorderStyle(lipgloss.ThickBorder())

	toolName := renderToolName(toolCall.ToolName)
	toolArgs := ""
	toolArgsMap := make(map[string]any)
	if toolCall.Args != nil {
		value := *toolCall.Args
		m, ok := value.(map[string]any)
		if ok {
			toolArgsMap = m
			firstKey := ""
			for key := range toolArgsMap {
				firstKey = key
				break
			}
			toolArgs = renderArgs(&toolArgsMap, appInfo, firstKey)
		}
	}

	title := fmt.Sprintf("%s: %s", toolName, toolArgs)
	finished := result != nil
	body := styles.BaseStyle().Render("In progress...")
	if finished {
		body = *result
	}
	footer := ""
	if metadata["time"] != nil {
		timeMap := metadata["time"].(map[string]any)
		start := timeMap["start"].(float64)
		end := timeMap["end"].(float64)
		durationMs := end - start
		duration := time.Duration(durationMs * float64(time.Millisecond))
		roundedDuration := time.Duration(duration.Round(time.Millisecond))
		if durationMs > 1000 {
			roundedDuration = time.Duration(duration.Round(time.Second))
		}
		footer = styles.Muted().Render(fmt.Sprintf("%s", roundedDuration))
	}

	switch toolCall.ToolName {
	case "opencode_edit":
		filename := toolArgsMap["filePath"].(string)
		filename = strings.TrimPrefix(filename, appInfo.Path.Root+"/")
		title = fmt.Sprintf("%s: %s", toolName, filename)
		if finished && metadata["diff"] != nil {
			patch := metadata["diff"].(string)
			formattedDiff, _ := diff.FormatDiff(patch, diff.WithTotalWidth(width))
			body = strings.TrimSpace(formattedDiff)
			return style.Render(lipgloss.JoinVertical(lipgloss.Left,
				title,
				body,
				footer,
			))
		}
	case "opencode_read":
		toolArgs = renderArgs(&toolArgsMap, appInfo, "filePath")
		title = fmt.Sprintf("%s: %s", toolName, toolArgs)
		filename := toolArgsMap["filePath"].(string)
		ext := filepath.Ext(filename)
		if ext == "" {
			ext = ""
		} else {
			ext = strings.ToLower(ext[1:])
		}
		if finished {
			if metadata["preview"] != nil {
				body = metadata["preview"].(string)
			}
			body = fmt.Sprintf("```%s\n%s\n```", ext, truncateHeight(body, 10))
			body = toMarkdown(body, width)
		}
	case "opencode_bash":
		if finished && metadata["stdout"] != nil {
			description := toolArgsMap["description"].(string)
			title = fmt.Sprintf("%s: %s", toolName, description)
			command := toolArgsMap["command"].(string)
			stdout := metadata["stdout"].(string)
			body = fmt.Sprintf("```console\n$ %s\n%s```", command, stdout)
			body = toMarkdown(body, width)
		}
	case "opencode_todowrite":
		title = fmt.Sprintf("%s", toolName)
		if finished && metadata["todos"] != nil {
			body = ""
			todos := metadata["todos"].([]any)
			for _, todo := range todos {
				t := todo.(map[string]any)
				content := t["content"].(string)
				switch t["status"].(string) {
				case "completed":
					body += fmt.Sprintf("- [x] %s\n", content)
				// case "in-progress":
				// 	body += fmt.Sprintf("- [ ] _%s_\n", content)
				default:
					body += fmt.Sprintf("- [ ] %s\n", content)
				}
			}
			body = toMarkdown(body, width)
		}
	default:
		body = fmt.Sprintf("```txt\n%s\n```", truncateHeight(body, 10))
		body = toMarkdown(body, width)
	}

	if metadata["error"] != nil && metadata["message"] != nil {
		body = styles.BaseStyle().Foreground(t.Error()).Render(metadata["message"].(string))
	}

	content := style.Render(lipgloss.JoinVertical(lipgloss.Left,
		title,
		body,
		footer,
	))
	return styles.ForceReplaceBackgroundWithLipgloss(content, t.Background())
}

func renderToolName(name string) string {
	switch name {
	// case agent.AgentToolName:
	// 	return "Task"
	case "opencode_ls":
		return "List"
	case "opencode_todowrite":
		return "Update TODOs"
	default:
		normalizedName := name
		if strings.HasPrefix(name, "opencode_") {
			normalizedName = strings.TrimPrefix(name, "opencode_")
		}
		return cases.Title(language.Und).String(normalizedName)
	}
}

func renderToolAction(name string) string {
	switch name {
	// case agent.AgentToolName:
	// 	return "Preparing prompt..."
	case "opencode_bash":
		return "Building command..."
	case "opencode_edit":
		return "Preparing edit..."
	case "opencode_fetch":
		return "Writing fetch..."
	case "opencode_glob":
		return "Finding files..."
	case "opencode_grep":
		return "Searching content..."
	case "opencode_ls":
		return "Listing directory..."
	case "opencode_read":
		return "Reading file..."
	case "opencode_write":
		return "Preparing write..."
	case "opencode_patch":
		return "Preparing patch..."
	case "opencode_batch":
		return "Running batch operations..."
	}
	return "Working..."
}

func renderArgs(args *map[string]any, appInfo client.AppInfo, titleKey string) string {
	if args == nil || len(*args) == 0 {
		return ""
	}
	title := ""
	parts := []string{}
	for key, value := range *args {
		if key == "filePath" {
			value = strings.TrimPrefix(value.(string), appInfo.Path.Root+"/")
		}
		if key == titleKey {
			title = fmt.Sprintf("%s", value)
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%v", key, value))
	}
	if len(parts) == 0 {
		return title
	}
	return fmt.Sprintf("%s (%s)", title, strings.Join(parts, ", "))
}

func truncateHeight(content string, height int) string {
	lines := strings.Split(content, "\n")
	if len(lines) > height {
		return strings.Join(lines[:height], "\n")
	}
	return content
}
