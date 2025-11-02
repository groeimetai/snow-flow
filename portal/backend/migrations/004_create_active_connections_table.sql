-- Migration: Create active_connections table
-- Version: 1.0.0
-- Date: 2025-11-02
-- Description: Creates table to track active MCP connections for seat management.
--              Each row represents one active SSE connection from a client.

CREATE TABLE IF NOT EXISTS active_connections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Identity
  customer_id INT NOT NULL COMMENT 'FK to customers table',
  user_id VARCHAR(64) NOT NULL COMMENT 'Hashed machine ID from client (SHA-256)',
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL DEFAULT 'developer' COMMENT 'User role for this connection',

  -- Connection metadata
  connection_id VARCHAR(128) NOT NULL COMMENT 'Unique SSE connection ID (UUID)',
  ip_address VARCHAR(45) COMMENT 'Client IP address (IPv4 or IPv6)',
  user_agent VARCHAR(512) COMMENT 'Client user agent string',

  -- Timing (all timestamps in milliseconds since epoch)
  connected_at BIGINT NOT NULL COMMENT 'Timestamp when connection was established',
  last_seen BIGINT NOT NULL COMMENT 'Timestamp of last heartbeat (updated every 30s)',

  -- Session correlation
  jwt_token_hash VARCHAR(64) COMMENT 'SHA-256 hash of JWT token for correlation and audit',

  -- Unique constraint: one connection per (customer, user_id, role)
  -- This ensures a user can only have one active connection per role
  UNIQUE KEY unique_connection (customer_id, user_id, role),

  -- Indexes for efficient queries
  INDEX idx_customer_role (customer_id, role) COMMENT 'For counting active connections per role',
  INDEX idx_last_seen (last_seen) COMMENT 'For cleanup worker to find stale connections',
  INDEX idx_connection_id (connection_id) COMMENT 'For connection lookup by ID',
  INDEX idx_customer_user (customer_id, user_id) COMMENT 'For grace period checks',

  -- Foreign key constraint with CASCADE delete
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    COMMENT 'Delete connections when customer is deleted'

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tracks active MCP SSE connections for seat management and monitoring';

-- Verification query (run after migration)
-- SELECT COUNT(*) as active_connections,
--        role,
--        COUNT(DISTINCT customer_id) as unique_customers
-- FROM active_connections
-- GROUP BY role;
