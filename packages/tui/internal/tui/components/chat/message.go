package chat

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/diff"
	"github.com/sst/opencode/internal/tui/styles"
	"github.com/sst/opencode/internal/tui/theme"
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

func renderUserMessage(msg client.MessageInfo, width int) string {
	t := theme.CurrentTheme()
	style := styles.BaseStyle().
		BorderLeft(true).
		Foreground(t.TextMuted()).
		BorderForeground(t.Secondary()).
		BorderStyle(lipgloss.ThickBorder())

	baseStyle := styles.BaseStyle()
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

	// Add timestamp info
	timestamp := time.UnixMilli(int64(msg.Metadata.Time.Created)).Local().Format("02 Jan 2006 03:04 PM")
	username, _ := config.GetUsername()
	info := baseStyle.
		Foreground(t.TextMuted()).
		Render(fmt.Sprintf(" %s (%s)", username, timestamp))

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

func convertToMap(input *any) (map[string]any, bool) {
	if input == nil {
		return nil, false // Handle nil pointer
	}
	value := *input                 // Dereference the pointer to get the interface value
	m, ok := value.(map[string]any) // Type assertion
	return m, ok
}

func renderAssistantMessage(
	msg client.MessageInfo,
	width int,
	showToolMessages bool,
) string {
	t := theme.CurrentTheme()
	style := styles.BaseStyle().
		BorderLeft(true).
		Foreground(t.TextMuted()).
		BorderForeground(t.Primary()).
		BorderStyle(lipgloss.ThickBorder())
	toolStyle := styles.BaseStyle().
		BorderLeft(true).
		Foreground(t.TextMuted()).
		BorderForeground(t.TextMuted()).
		BorderStyle(lipgloss.ThickBorder())

	baseStyle := styles.BaseStyle()
	messages := []string{}

	// content := strings.TrimSpace(msg.Content().String())
	// thinking := msg.IsThinking()
	// thinkingContent := msg.ReasoningContent().Thinking
	// finished := msg.IsFinished()
	// finishData := msg.FinishPart()

	// Add timestamp info
	timestamp := time.UnixMilli(int64(msg.Metadata.Time.Created)).Local().Format("02 Jan 2006 03:04 PM")
	modelName := msg.Metadata.Assistant.ModelID
	info := baseStyle.
		Foreground(t.TextMuted()).
		Render(fmt.Sprintf(" %s (%s)", modelName, timestamp))

	for _, p := range msg.Parts {
		part, err := p.ValueByDiscriminator()
		if err != nil {
			continue //TODO: handle error?
		}

		switch part.(type) {
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
			toolInvocation, _ := toolInvocationPart.ToolInvocation.ValueByDiscriminator()
			switch toolInvocation.(type) {
			case client.MessageToolInvocationToolCall:
				toolCall := toolInvocation.(client.MessageToolInvocationToolCall)
				toolName := renderToolName(toolCall.ToolName)

				var toolArgs []string
				toolMap, _ := convertToMap(toolCall.Args)
				for _, arg := range toolMap {
					toolArgs = append(toolArgs, fmt.Sprintf("%v", arg))
				}
				params := renderParams(width-lipgloss.Width(toolName)-1, toolArgs...)
				title := styles.Padded().Render(fmt.Sprintf("%s: %s", toolName, params))

				content := toolStyle.Render(lipgloss.JoinVertical(lipgloss.Left,
					title,
					" In progress...",
				))
				message := styles.ForceReplaceBackgroundWithLipgloss(content, t.Background())
				messages = append(messages, message)

			case client.MessageToolInvocationToolResult:
				toolInvocationResult := toolInvocation.(client.MessageToolInvocationToolResult)
				toolName := renderToolName(toolInvocationResult.ToolName)
				var toolArgs []string
				toolMap, _ := convertToMap(toolInvocationResult.Args)
				for _, arg := range toolMap {
					toolArgs = append(toolArgs, fmt.Sprintf("%v", arg))
				}
				params := renderParams(width-lipgloss.Width(toolName)-1, toolArgs...)
				title := styles.Padded().Render(fmt.Sprintf("%s: %s", toolName, params))
				metadata := msg.Metadata.Tool[toolInvocationResult.ToolCallId].(map[string]any)

				var markdown string
				if toolInvocationResult.ToolName == "edit" {
					filename := toolMap["filePath"].(string)
					title = styles.Padded().Render(fmt.Sprintf("%s: %s", toolName, filename))
					oldString := toolMap["oldString"].(string)
					newString := toolMap["newString"].(string)
					patch, _, _ := diff.GenerateDiff(oldString, newString, filename)
					formattedDiff, _ := diff.FormatDiff(patch, diff.WithTotalWidth(width))
					markdown = strings.TrimSpace(formattedDiff)
					message := toolStyle.Render(lipgloss.JoinVertical(lipgloss.Left,
						title,
						markdown,
					))
					messages = append(messages, message)
				} else if toolInvocationResult.ToolName == "view" {
					result := toolInvocationResult.Result
					if metadata["preview"] != nil {
						result = metadata["preview"].(string)
					}
					filename := toolMap["filePath"].(string)
					ext := filepath.Ext(filename)
					if ext == "" {
						ext = ""
					} else {
						ext = strings.ToLower(ext[1:])
					}
					result = fmt.Sprintf("```%s\n%s\n```", ext, truncateHeight(result, 10))
					markdown = toMarkdown(result, width)
					content := toolStyle.Render(lipgloss.JoinVertical(lipgloss.Left,
						title,
						markdown,
					))
					message := styles.ForceReplaceBackgroundWithLipgloss(content, t.Background())
					messages = append(messages, message)
				} else {
					result := truncateHeight(strings.TrimSpace(toolInvocationResult.Result), 10)
					markdown = toMarkdown(result, width)
					content := toolStyle.Render(lipgloss.JoinVertical(lipgloss.Left,
						title,
						markdown,
					))
					message := styles.ForceReplaceBackgroundWithLipgloss(content, t.Background())
					messages = append(messages, message)
				}
			}
		}
	}

	// if finished {
	// 	// Add finish info if available
	// 	switch finishData.Reason {
	// 	case message.FinishReasonCanceled:
	// 		info = append(info, baseStyle.
	// 			Width(width-1).
	// 			Foreground(t.Warning()).
	// 			Render("(canceled)"),
	// 		)
	// 	case message.FinishReasonError:
	// 		info = append(info, baseStyle.
	// 			Width(width-1).
	// 			Foreground(t.Error()).
	// 			Render("(error)"),
	// 		)
	// 	case message.FinishReasonPermissionDenied:
	// 		info = append(info, baseStyle.
	// 			Width(width-1).
	// 			Foreground(t.Info()).
	// 			Render("(permission denied)"),
	// 		)
	// 	}
	// }

	// if content != "" || (finished && finishData.Reason == message.FinishReasonEndTurn) {
	// 	if content == "" {
	// 		content = "*Finished without output*"
	// 	}
	//
	// 	content = renderMessage(content, false, width, info...)
	// 	messages = append(messages, content)
	// 	// position += messages[0].height
	// 	position++ // for the space
	// } else if thinking && thinkingContent != "" {
	// 	// Render the thinking content with timestamp
	// 	content = renderMessage(thinkingContent, false, width, info...)
	// 	messages = append(messages, content)
	// 	position += lipgloss.Height(content)
	// 	position++ // for the space
	// }

	// Only render tool messages if they should be shown
	if showToolMessages {
		// for i, toolCall := range msg.ToolCalls() {
		// 	toolCallContent := renderToolMessage(
		// 		toolCall,
		// 		allMessages,
		// 		messagesService,
		// 		focusedUIMessageId,
		// 		false,
		// 		width,
		// 		i+1,
		// 	)
		// 	messages = append(messages, toolCallContent)
		// }
	}

	return strings.Join(messages, "\n\n")
}

func renderToolName(name string) string {
	switch name {
	// case agent.AgentToolName:
	// 	return "Task"
	case "ls":
		return "List"
	default:
		return cases.Title(language.Und).String(name)
	}
}

func renderToolAction(name string) string {
	switch name {
	// case agent.AgentToolName:
	// 	return "Preparing prompt..."
	case "bash":
		return "Building command..."
	case "edit":
		return "Preparing edit..."
	case "fetch":
		return "Writing fetch..."
	case "glob":
		return "Finding files..."
	case "grep":
		return "Searching content..."
	case "ls":
		return "Listing directory..."
	case "view":
		return "Reading file..."
	case "write":
		return "Preparing write..."
	case "patch":
		return "Preparing patch..."
	case "batch":
		return "Running batch operations..."
	}
	return "Working..."
}

// renders params, params[0] (params[1]=params[2] ....)
func renderParams(paramsWidth int, params ...string) string {
	if len(params) == 0 {
		return ""
	}
	mainParam := params[0]
	if len(mainParam) > paramsWidth {
		mainParam = mainParam[:paramsWidth-3] + "..."
	}

	if len(params) == 1 {
		return mainParam
	}
	otherParams := params[1:]
	// create pairs of key/value
	// if odd number of params, the last one is a key without value
	if len(otherParams)%2 != 0 {
		otherParams = append(otherParams, "")
	}
	parts := make([]string, 0, len(otherParams)/2)
	for i := 0; i < len(otherParams); i += 2 {
		key := otherParams[i]
		value := otherParams[i+1]
		if value == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%s", key, value))
	}

	partsRendered := strings.Join(parts, ", ")
	remainingWidth := paramsWidth - lipgloss.Width(partsRendered) - 5 // for the space
	if remainingWidth < 30 {
		// No space for the params, just show the main
		return mainParam
	}

	if len(parts) > 0 {
		mainParam = fmt.Sprintf("%s (%s)", mainParam, strings.Join(parts, ", "))
	}

	return ansi.Truncate(mainParam, paramsWidth, "...")
}

func removeWorkingDirPrefix(path string) string {
	wd := config.WorkingDirectory()
	if strings.HasPrefix(path, wd) {
		path = strings.TrimPrefix(path, wd)
	}
	if strings.HasPrefix(path, "/") {
		path = strings.TrimPrefix(path, "/")
	}
	if strings.HasPrefix(path, "./") {
		path = strings.TrimPrefix(path, "./")
	}
	if strings.HasPrefix(path, "../") {
		path = strings.TrimPrefix(path, "../")
	}
	return path
}

func renderToolParams(paramWidth int, toolCall any) string {
	params := ""
	switch toolCall {
	// // case agent.AgentToolName:
	// // 	var params agent.AgentParams
	// // 	json.Unmarshal([]byte(toolCall.Input), &params)
	// // 	prompt := strings.ReplaceAll(params.Prompt, "\n", " ")
	// // 	return renderParams(paramWidth, prompt)
	// case "bash":
	// 	var params tools.BashParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	command := strings.ReplaceAll(params.Command, "\n", " ")
	// 	return renderParams(paramWidth, command)
	// case "edit":
	// 	var params tools.EditParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	filePath := removeWorkingDirPrefix(params.FilePath)
	// 	return renderParams(paramWidth, filePath)
	// case "fetch":
	// 	var params tools.FetchParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	url := params.URL
	// 	toolParams := []string{
	// 		url,
	// 	}
	// 	if params.Format != "" {
	// 		toolParams = append(toolParams, "format", params.Format)
	// 	}
	// 	if params.Timeout != 0 {
	// 		toolParams = append(toolParams, "timeout", (time.Duration(params.Timeout) * time.Second).String())
	// 	}
	// 	return renderParams(paramWidth, toolParams...)
	// case tools.GlobToolName:
	// 	var params tools.GlobParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	pattern := params.Pattern
	// 	toolParams := []string{
	// 		pattern,
	// 	}
	// 	if params.Path != "" {
	// 		toolParams = append(toolParams, "path", params.Path)
	// 	}
	// 	return renderParams(paramWidth, toolParams...)
	// case tools.GrepToolName:
	// 	var params tools.GrepParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	pattern := params.Pattern
	// 	toolParams := []string{
	// 		pattern,
	// 	}
	// 	if params.Path != "" {
	// 		toolParams = append(toolParams, "path", params.Path)
	// 	}
	// 	if params.Include != "" {
	// 		toolParams = append(toolParams, "include", params.Include)
	// 	}
	// 	if params.LiteralText {
	// 		toolParams = append(toolParams, "literal", "true")
	// 	}
	// 	return renderParams(paramWidth, toolParams...)
	// case tools.LSToolName:
	// 	var params tools.LSParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	path := params.Path
	// 	if path == "" {
	// 		path = "."
	// 	}
	// 	return renderParams(paramWidth, path)
	// case tools.ViewToolName:
	// 	var params tools.ViewParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	filePath := removeWorkingDirPrefix(params.FilePath)
	// 	toolParams := []string{
	// 		filePath,
	// 	}
	// 	if params.Limit != 0 {
	// 		toolParams = append(toolParams, "limit", fmt.Sprintf("%d", params.Limit))
	// 	}
	// 	if params.Offset != 0 {
	// 		toolParams = append(toolParams, "offset", fmt.Sprintf("%d", params.Offset))
	// 	}
	// 	return renderParams(paramWidth, toolParams...)
	// case tools.WriteToolName:
	// 	var params tools.WriteParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	filePath := removeWorkingDirPrefix(params.FilePath)
	// 	return renderParams(paramWidth, filePath)
	// case tools.BatchToolName:
	// 	var params tools.BatchParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	return renderParams(paramWidth, fmt.Sprintf("%d parallel calls", len(params.Calls)))
	// default:
	// 	input := strings.ReplaceAll(toolCall, "\n", " ")
	// 	params = renderParams(paramWidth, input)
	}
	return params
}

func truncateHeight(content string, height int) string {
	lines := strings.Split(content, "\n")
	if len(lines) > height {
		return strings.Join(lines[:height], "\n")
	}
	return content
}

func renderToolResponse(toolCall any, response any, width int) string {
	return ""
	// t := theme.CurrentTheme()
	// baseStyle := styles.BaseStyle()
	//
	// if response.IsError {
	// 	errContent := fmt.Sprintf("Error: %s", strings.ReplaceAll(response.Content, "\n", " "))
	// 	errContent = ansi.Truncate(errContent, width-1, "...")
	// 	return baseStyle.
	// 		Width(width).
	// 		Foreground(t.Error()).
	// 		Render(errContent)
	// }
	//
	// resultContent := truncateHeight(response.Content, maxResultHeight)
	// switch toolCall.Name {
	// case agent.AgentToolName:
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		toMarkdown(resultContent, false, width),
	// 		t.Background(),
	// 	)
	// case tools.BashToolName:
	// 	resultContent = fmt.Sprintf("```bash\n%s\n```", resultContent)
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		toMarkdown(resultContent, width),
	// 		t.Background(),
	// 	)
	// case tools.EditToolName:
	// 	metadata := tools.EditResponseMetadata{}
	// 	json.Unmarshal([]byte(response.Metadata), &metadata)
	// 	formattedDiff, _ := diff.FormatDiff(metadata.Diff, diff.WithTotalWidth(width))
	// 	return formattedDiff
	// case tools.FetchToolName:
	// 	var params tools.FetchParams
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	mdFormat := "markdown"
	// 	switch params.Format {
	// 	case "text":
	// 		mdFormat = "text"
	// 	case "html":
	// 		mdFormat = "html"
	// 	}
	// 	resultContent = fmt.Sprintf("```%s\n%s\n```", mdFormat, resultContent)
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		toMarkdown(resultContent, width),
	// 		t.Background(),
	// 	)
	// case tools.GlobToolName:
	// 	return baseStyle.Width(width).Foreground(t.TextMuted()).Render(resultContent)
	// case tools.GrepToolName:
	// 	return baseStyle.Width(width).Foreground(t.TextMuted()).Render(resultContent)
	// case tools.LSToolName:
	// 	return baseStyle.Width(width).Foreground(t.TextMuted()).Render(resultContent)
	// case tools.ViewToolName:
	// 	metadata := tools.ViewResponseMetadata{}
	// 	json.Unmarshal([]byte(response.Metadata), &metadata)
	// 	ext := filepath.Ext(metadata.FilePath)
	// 	if ext == "" {
	// 		ext = ""
	// 	} else {
	// 		ext = strings.ToLower(ext[1:])
	// 	}
	// 	resultContent = fmt.Sprintf("```%s\n%s\n```", ext, truncateHeight(metadata.Content, maxResultHeight))
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		toMarkdown(resultContent, width),
	// 		t.Background(),
	// 	)
	// case tools.WriteToolName:
	// 	params := tools.WriteParams{}
	// 	json.Unmarshal([]byte(toolCall.Input), &params)
	// 	metadata := tools.WriteResponseMetadata{}
	// 	json.Unmarshal([]byte(response.Metadata), &metadata)
	// 	ext := filepath.Ext(params.FilePath)
	// 	if ext == "" {
	// 		ext = ""
	// 	} else {
	// 		ext = strings.ToLower(ext[1:])
	// 	}
	// 	resultContent = fmt.Sprintf("```%s\n%s\n```", ext, truncateHeight(params.Content, maxResultHeight))
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		toMarkdown(resultContent, width),
	// 		t.Background(),
	// 	)
	// case tools.BatchToolName:
	// 	var batchResult tools.BatchResult
	// 	if err := json.Unmarshal([]byte(resultContent), &batchResult); err != nil {
	// 		return baseStyle.Width(width).Foreground(t.Error()).Render(fmt.Sprintf("Error parsing batch result: %s", err))
	// 	}
	//
	// 	var toolCalls []string
	// 	for i, result := range batchResult.Results {
	// 		toolName := renderToolName(result.ToolName)
	//
	// 		// Format the tool input as a string
	// 		inputStr := string(result.ToolInput)
	//
	// 		// Format the result
	// 		var resultStr string
	// 		if result.Error != "" {
	// 			resultStr = fmt.Sprintf("Error: %s", result.Error)
	// 		} else {
	// 			var toolResponse tools.ToolResponse
	// 			if err := json.Unmarshal(result.Result, &toolResponse); err != nil {
	// 				resultStr = "Error parsing tool response"
	// 			} else {
	// 				resultStr = truncateHeight(toolResponse.Content, 3)
	// 			}
	// 		}
	//
	// 		// Format the tool call
	// 		toolCall := fmt.Sprintf("%d. %s: %s\n   %s", i+1, toolName, inputStr, resultStr)
	// 		toolCalls = append(toolCalls, toolCall)
	// 	}
	//
	// 	return baseStyle.Width(width).Foreground(t.TextMuted()).Render(strings.Join(toolCalls, "\n\n"))
	// default:
	// 	resultContent = fmt.Sprintf("```text\n%s\n```", resultContent)
	// 	return styles.ForceReplaceBackgroundWithLipgloss(
	// 		toMarkdown(resultContent, width),
	// 		t.Background(),
	// 	)
	// }
}

// func renderToolMessage(
// 	toolCall message.ToolCall,
// 	allMessages []message.Message,
// 	messagesService message.Service,
// 	focusedUIMessageId string,
// 	nested bool,
// 	width int,
// 	position int,
// ) string {
// 	if nested {
// 		width = width - 3
// 	}
//
// 	t := theme.CurrentTheme()
// 	baseStyle := styles.BaseStyle()
//
// 	style := baseStyle.
// 		Width(width - 1).
// 		BorderLeft(true).
// 		BorderStyle(lipgloss.ThickBorder()).
// 		PaddingLeft(1).
// 		BorderForeground(t.TextMuted())
//
// 	response := findToolResponse(toolCall.ID, allMessages)
// 	toolNameText := baseStyle.Foreground(t.TextMuted()).
// 		Render(fmt.Sprintf("%s: ", renderToolName(toolCall.Name)))
//
// 	if !toolCall.Finished {
// 		// Get a brief description of what the tool is doing
// 		toolAction := renderToolAction(toolCall.Name)
//
// 		progressText := baseStyle.
// 			Width(width - 2 - lipgloss.Width(toolNameText)).
// 			Foreground(t.TextMuted()).
// 			Render(fmt.Sprintf("%s", toolAction))
//
// 		content := style.Render(lipgloss.JoinHorizontal(lipgloss.Left, toolNameText, progressText))
// 		return content
// 	}
//
// 	params := renderToolParams(width-1-lipgloss.Width(toolNameText), toolCall)
// 	responseContent := ""
// 	if response != nil {
// 		responseContent = renderToolResponse(toolCall, *response, width-2)
// 		responseContent = strings.TrimSuffix(responseContent, "\n")
// 	} else {
// 		responseContent = baseStyle.
// 			Italic(true).
// 			Width(width - 2).
// 			Foreground(t.TextMuted()).
// 			Render("Waiting for response...")
// 	}
//
// 	parts := []string{}
// 	if !nested {
// 		formattedParams := baseStyle.
// 			Width(width - 2 - lipgloss.Width(toolNameText)).
// 			Foreground(t.TextMuted()).
// 			Render(params)
//
// 		parts = append(parts, lipgloss.JoinHorizontal(lipgloss.Left, toolNameText, formattedParams))
// 	} else {
// 		prefix := baseStyle.
// 			Foreground(t.TextMuted()).
// 			Render(" └ ")
// 		formattedParams := baseStyle.
// 			Width(width - 2 - lipgloss.Width(toolNameText)).
// 			Foreground(t.TextMuted()).
// 			Render(params)
// 		parts = append(parts, lipgloss.JoinHorizontal(lipgloss.Left, prefix, toolNameText, formattedParams))
// 	}
//
// 	// if toolCall.Name == agent.AgentToolName {
// 	// 	taskMessages, _ := messagesService.List(context.Background(), toolCall.ID)
// 	// 	toolCalls := []message.ToolCall{}
// 	// 	for _, v := range taskMessages {
// 	// 		toolCalls = append(toolCalls, v.ToolCalls()...)
// 	// 	}
// 	// 	for _, call := range toolCalls {
// 	// 		rendered := renderToolMessage(call, []message.Message{}, messagesService, focusedUIMessageId, true, width, 0)
// 	// 		parts = append(parts, rendered.content)
// 	// 	}
// 	// }
// 	if responseContent != "" && !nested {
// 		parts = append(parts, responseContent)
// 	}
//
// 	content := style.Render(
// 		lipgloss.JoinVertical(
// 			lipgloss.Left,
// 			parts...,
// 		),
// 	)
// 	if nested {
// 		content = lipgloss.JoinVertical(
// 			lipgloss.Left,
// 			parts...,
// 		)
// 	}
// 	return content
// }
