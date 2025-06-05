package chat

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/sst/opencode/pkg/client"
)

// MessageCache caches rendered messages to avoid re-rendering
type MessageCache struct {
	mu    sync.RWMutex
	cache map[string]string
}

// NewMessageCache creates a new message cache
func NewMessageCache() *MessageCache {
	return &MessageCache{
		cache: make(map[string]string),
	}
}

// generateKey creates a unique key for a message based on its content and rendering parameters
func (c *MessageCache) generateKey(msg client.MessageInfo, width int, showToolMessages bool, appInfo client.AppInfo) string {
	// Create a hash of the message content and rendering parameters
	h := sha256.New()

	// Include message ID and role
	h.Write(fmt.Appendf(nil, "%s:%s", msg.Id, msg.Role))

	// Include timestamp
	h.Write(fmt.Appendf(nil, ":%f", msg.Metadata.Time.Created))

	// Include width and showToolMessages flag
	h.Write(fmt.Appendf(nil, ":%d:%t", width, showToolMessages))

	// Include app path for relative path calculations
	h.Write([]byte(appInfo.Path.Root))

	// Include message parts
	for _, part := range msg.Parts {
		h.Write(fmt.Appendf(nil, ":%v", part))
	}

	// Include tool metadata if present
	for toolID, metadata := range msg.Metadata.Tool {
		h.Write(fmt.Appendf(nil, ":%s:%v", toolID, metadata))
	}

	return hex.EncodeToString(h.Sum(nil))
}

// Get retrieves a cached rendered message
func (c *MessageCache) Get(msg client.MessageInfo, width int, showToolMessages bool, appInfo client.AppInfo) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := c.generateKey(msg, width, showToolMessages, appInfo)
	content, exists := c.cache[key]
	return content, exists
}

// Set stores a rendered message in the cache
func (c *MessageCache) Set(msg client.MessageInfo, width int, showToolMessages bool, appInfo client.AppInfo, content string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := c.generateKey(msg, width, showToolMessages, appInfo)
	c.cache[key] = content
}

// Clear removes all entries from the cache
func (c *MessageCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]string)
}

// Size returns the number of cached entries
func (c *MessageCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.cache)
}
