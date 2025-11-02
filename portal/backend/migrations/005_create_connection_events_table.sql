-- Migration: Create connection_events table
-- Version: 1.0.0
-- Date: 2025-11-02
-- Description: Creates audit log table for connection lifecycle events.
--              Provides visibility into seat usage patterns and rejection reasons.

CREATE TABLE IF NOT EXISTS connection_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Identity
  customer_id INT NOT NULL COMMENT 'FK to customers table',
  user_id VARCHAR(64) NOT NULL COMMENT 'Hashed machine ID from client',
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL COMMENT 'User role attempting connection',

  -- Event details
  event_type ENUM('connect', 'disconnect', 'heartbeat', 'timeout', 'rejected') NOT NULL
    COMMENT 'Type of connection event: connect=new connection, disconnect=graceful close, heartbeat=keepalive, timeout=stale cleanup, rejected=seat limit',
  timestamp BIGINT NOT NULL COMMENT 'Event timestamp in milliseconds since epoch',

  -- Context (optional fields for debugging and analysis)
  ip_address VARCHAR(45) COMMENT 'Client IP address',
  error_message TEXT COMMENT 'Error message for rejected connections',
  seat_limit INT COMMENT 'Seat limit at time of event (for rejected events)',
  active_count INT COMMENT 'Active connection count at time of event (for rejected events)',

  -- Indexes for efficient queries
  INDEX idx_customer_timestamp (customer_id, timestamp) COMMENT 'For customer event history',
  INDEX idx_event_type (event_type) COMMENT 'For filtering by event type',
  INDEX idx_user_events (customer_id, user_id, timestamp) COMMENT 'For user-specific event history',
  INDEX idx_timestamp (timestamp) COMMENT 'For time-based queries and cleanup',
  INDEX idx_rejected_events (event_type, timestamp) COMMENT 'For monitoring rejection rates',

  -- Foreign key constraint with CASCADE delete
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    COMMENT 'Delete events when customer is deleted'

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit log for connection lifecycle events, seat rejections, and usage patterns';

-- Add partitioning by month for large-scale deployments (optional, can be added later)
-- ALTER TABLE connection_events
-- PARTITION BY RANGE (timestamp) (
--   PARTITION p202501 VALUES LESS THAN (UNIX_TIMESTAMP('2025-02-01') * 1000),
--   PARTITION p202502 VALUES LESS THAN (UNIX_TIMESTAMP('2025-03-01') * 1000),
--   -- Add more partitions as needed
-- );

-- Verification query (run after migration)
-- SELECT event_type,
--        COUNT(*) as count,
--        COUNT(DISTINCT customer_id) as unique_customers
-- FROM connection_events
-- WHERE timestamp > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY)) * 1000
-- GROUP BY event_type;
