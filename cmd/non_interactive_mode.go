package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"log/slog"

	charmlog "github.com/charmbracelet/log"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/config"
	"github.com/sst/opencode/internal/db"
	"github.com/sst/opencode/internal/format"
	"github.com/sst/opencode/internal/llm/agent"
	"github.com/sst/opencode/internal/llm/tools"
	"github.com/sst/opencode/internal/message"
	"github.com/sst/opencode/internal/permission"
	"github.com/sst/opencode/internal/tui/components/spinner"
	"github.com/sst/opencode/internal/tui/theme"
)

// syncWriter is a thread-safe writer that prevents interleaved output
type syncWriter struct {
	w  io.Writer
	mu sync.Mutex
}

// Write implements io.Writer
func (sw *syncWriter) Write(p []byte) (n int, err error) {
	sw.mu.Lock()
	defer sw.mu.Unlock()
	return sw.w.Write(p)
}

// newSyncWriter creates a new synchronized writer
func newSyncWriter(w io.Writer) io.Writer {
	return &syncWriter{w: w}
}

// filterTools filters the provided tools based on allowed or excluded tool names
func filterTools(allTools []tools.BaseTool, allowedTools, excludedTools []string) []tools.BaseTool {
	// If neither allowed nor excluded tools are specified, return all tools
	if len(allowedTools) == 0 && len(excludedTools) == 0 {
		return allTools
	}

	// Create a map for faster lookups
	allowedMap := make(map[string]bool)
	for _, name := range allowedTools {
		allowedMap[name] = true
	}

	excludedMap := make(map[string]bool)
	for _, name := range excludedTools {
		excludedMap[name] = true
	}

	var filteredTools []tools.BaseTool

	for _, tool := range allTools {
		toolName := tool.Info().Name

		// If we have an allowed list, only include tools in that list
		if len(allowedTools) > 0 {
			if allowedMap[toolName] {
				filteredTools = append(filteredTools, tool)
			}
		} else if len(excludedTools) > 0 {
			// If we have an excluded list, include all tools except those in the list
			if !excludedMap[toolName] {
				filteredTools = append(filteredTools, tool)
			}
		}
	}

	return filteredTools
}

// handleNonInteractiveMode processes a single prompt in non-interactive mode
func handleNonInteractiveMode(ctx context.Context, prompt string, outputFormat format.OutputFormat, quiet bool, verbose bool, allowedTools, excludedTools []string) error {
	// Initial log message using standard slog
	slog.Info("Running in non-interactive mode", "prompt", prompt, "format", outputFormat, "quiet", quiet, "verbose", verbose,
		"allowedTools", allowedTools, "excludedTools", excludedTools)

	// Sanity check for mutually exclusive flags
	if quiet && verbose {
		return fmt.Errorf("--quiet and --verbose flags cannot be used together")
	}

	// Set up logging to stderr if verbose mode is enabled
	if verbose {
		// Create a synchronized writer to prevent interleaved output
		syncWriter := newSyncWriter(os.Stderr)

		// Create a charmbracelet/log logger that writes to the synchronized writer
		charmLogger := charmlog.NewWithOptions(syncWriter, charmlog.Options{
			Level:           charmlog.DebugLevel,
			ReportCaller:    true,
			ReportTimestamp: true,
			TimeFormat:      time.RFC3339,
			Prefix:          "OpenCode",
		})

		// Set the global logger for charmbracelet/log
		charmlog.SetDefault(charmLogger)

		// Create a slog handler that uses charmbracelet/log
		// This will forward all slog logs to charmbracelet/log
		slog.SetDefault(slog.New(charmLogger))

		// Log a message to confirm verbose logging is enabled
		charmLogger.Info("Verbose logging enabled")
	}

	// Start spinner if not in quiet mode
	var s *spinner.Spinner
	if !quiet {
		// Get the current theme to style the spinner
		currentTheme := theme.CurrentTheme()

		// Create a themed spinner
		if currentTheme != nil {
			// Use the primary color from the theme
			s = spinner.NewThemedSpinner("Thinking...", currentTheme.Primary())
		} else {
			// Fallback to default spinner if no theme is available
			s = spinner.NewSpinner("Thinking...")
		}

		s.Start()
		defer s.Stop()
	}

	// Connect DB, this will also run migrations
	conn, err := db.Connect()
	if err != nil {
		return err
	}

	// Create a context with cancellation
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Create the app
	app, err := app.New(ctx, conn)
	if err != nil {
		slog.Error("Failed to create app", "error", err)
		return err
	}

	// Create a new session for this prompt
	session, err := app.Sessions.Create(ctx, "Non-interactive prompt")
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}

	// Set the session as current
	app.CurrentSession = &session

	// Auto-approve all permissions for this session
	permission.AutoApproveSession(ctx, session.ID)

	// Create the user message
	_, err = app.Messages.Create(ctx, session.ID, message.CreateMessageParams{
		Role:  message.User,
		Parts: []message.ContentPart{message.TextContent{Text: prompt}},
	})
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}

	// If tool restrictions are specified, create a new agent with filtered tools
	if len(allowedTools) > 0 || len(excludedTools) > 0 {
		// Initialize MCP tools synchronously to ensure they're included in filtering
		mcpCtx, mcpCancel := context.WithTimeout(ctx, 10*time.Second)
		agent.GetMcpTools(mcpCtx, app.Permissions)
		mcpCancel()

		// Get all available tools including MCP tools
		allTools := agent.PrimaryAgentTools(
			app.Permissions,
			app.Sessions,
			app.Messages,
			app.History,
			app.LSPClients,
		)

		// Filter tools based on allowed/excluded lists
		filteredTools := filterTools(allTools, allowedTools, excludedTools)

		// Log the filtered tools for debugging
		var toolNames []string
		for _, tool := range filteredTools {
			toolNames = append(toolNames, tool.Info().Name)
		}
		slog.Debug("Using filtered tools", "count", len(filteredTools), "tools", toolNames)

		// Create a new agent with the filtered tools
		restrictedAgent, err := agent.NewAgent(
			config.AgentPrimary,
			app.Sessions,
			app.Messages,
			filteredTools,
		)
		if err != nil {
			return fmt.Errorf("failed to create restricted agent: %w", err)
		}

		// Use the restricted agent for this request
		eventCh, err := restrictedAgent.Run(ctx, session.ID, prompt)
		if err != nil {
			return fmt.Errorf("failed to run restricted agent: %w", err)
		}

		// Wait for the response
		var response message.Message
		for event := range eventCh {
			if event.Err() != nil {
				return fmt.Errorf("agent error: %w", event.Err())
			}
			response = event.Response()
		}

		// Format and print the output
		content := ""
		if textContent := response.Content(); textContent != nil {
			content = textContent.Text
		}

		formattedOutput, err := format.FormatOutput(content, outputFormat)
		if err != nil {
			return fmt.Errorf("failed to format output: %w", err)
		}

		// Stop spinner before printing output
		if !quiet && s != nil {
			s.Stop()
		}

		// Print the formatted output to stdout
		fmt.Println(formattedOutput)

		// Shutdown the app
		app.Shutdown()

		return nil
	}

	// Run the default agent if no tool restrictions
	eventCh, err := app.PrimaryAgent.Run(ctx, session.ID, prompt)
	if err != nil {
		return fmt.Errorf("failed to run agent: %w", err)
	}

	// Wait for the response
	var response message.Message
	for event := range eventCh {
		if event.Err() != nil {
			return fmt.Errorf("agent error: %w", event.Err())
		}
		response = event.Response()
	}

	// Get the text content from the response
	content := ""
	if textContent := response.Content(); textContent != nil {
		content = textContent.Text
	}

	// Format the output according to the specified format
	formattedOutput, err := format.FormatOutput(content, outputFormat)
	if err != nil {
		return fmt.Errorf("failed to format output: %w", err)
	}

	// Stop spinner before printing output
	if !quiet && s != nil {
		s.Stop()
	}

	// Print the formatted output to stdout
	fmt.Println(formattedOutput)

	// Shutdown the app
	app.Shutdown()

	return nil
}
