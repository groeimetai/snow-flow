# Missing API Features for TypeScript Backend

This document tracks features that need to be implemented in the TypeScript backend to support the existing Go TUI functionality.

## Current API Endpoints Available
- `/session_create` - Create a new session
- `/session_share` - Share a session
- `/session_messages` - Get messages for a session
- `/session_list` - List all sessions
- `/session_chat` - Send a chat message (with SSE streaming response)
- `/event` - SSE event stream (currently only supports `storage.write` events)

## Missing Features

### Session Management
- [ ] Session deletion
- [ ] Session renaming/updating title
- [ ] Session compaction/summarization
- [ ] Session export/import

### Message Management
- [ ] Message editing
- [ ] Message deletion
- [ ] Message retrieval by ID
- [ ] Message search/filtering
- [ ] System messages support

### Agent/LLM Features
- [ ] Model selection/switching
- [ ] Tool invocation support
- [ ] Agent state management (busy/idle)
- [ ] Cancel ongoing generation
- [ ] Token usage tracking per message
- [ ] Custom prompts/system messages

### File/Attachment Support
- [ ] File attachments in messages
- [ ] Image attachments
- [ ] Code snippet attachments
- [ ] Attachment storage/retrieval

### LSP Integration
- [ ] LSP server discovery
- [ ] LSP diagnostics
- [ ] LSP code actions
- [ ] LSP hover information
- [ ] LSP references
- [ ] LSP workspace symbols

### Configuration
- [ ] Model configuration
- [ ] API key management
- [ ] Theme preferences
- [ ] User preferences storage

### Permissions
- [ ] File system access permissions
- [ ] Command execution permissions
- [ ] Network access permissions

### Status/Notifications
- [ ] Status message broadcasting
- [ ] Error notifications
- [ ] Progress indicators

### History
- [ ] Command history
- [ ] Search history
- [ ] Recent files/folders

### Events (SSE)
Currently only `storage.write` is supported. Missing events:
- [ ] `session.created`
- [ ] `session.updated`
- [ ] `session.deleted`
- [ ] `message.created`
- [ ] `message.updated`
- [ ] `message.deleted`
- [ ] `agent.status` (busy/idle)
- [ ] `tool.invoked`
- [ ] `tool.result`
- [ ] `error`
- [ ] `status` (info/warning/error messages)
- [ ] `lsp.diagnostics`
- [ ] `permission.requested`
- [ ] `permission.granted`
- [ ] `permission.denied`

### Database/Storage
- [ ] Message persistence
- [ ] Session persistence
- [ ] File tracking
- [ ] Log storage

### Pubsub/Real-time Updates
- [ ] Publish message events when messages are created/updated via API
- [ ] Agent busy/idle status updates

### Misc
- [ ] Health check endpoint
- [ ] Version endpoint
- [ ] Metrics/telemetry