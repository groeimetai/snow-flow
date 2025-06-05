package chat

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
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
func (c *MessageCache) GenerateKey(params ...any) string {
	h := sha256.New()
	for _, param := range params {
		h.Write(fmt.Appendf(nil, ":%v", param))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// Get retrieves a cached rendered message
func (c *MessageCache) Get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	content, exists := c.cache[key]
	return content, exists
}

// Set stores a rendered message in the cache
func (c *MessageCache) Set(key string, content string) {
	c.mu.Lock()
	defer c.mu.Unlock()
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
