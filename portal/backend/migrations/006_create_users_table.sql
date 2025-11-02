/**
 * Migration 006: Create Users Table
 *
 * Purpose: Store user credentials and management data for enterprise licenses
 * Features:
 *   - User authentication and identity management
 *   - Role-based access control (developer, stakeholder, admin)
 *   - Active/inactive status tracking
 *   - Connection history metadata
 *   - Links to customers and service integrators
 *
 * Version: 2.0.0
 * Date: 2025-01-02
 */

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Foreign keys
  customer_id INT NULL COMMENT 'Links to customers table (NULL for SI admins)',
  service_integrator_id INT NULL COMMENT 'Links to service_integrators table (NULL for customer users)',

  -- User identity (from MCP auth)
  user_id VARCHAR(64) NOT NULL COMMENT 'Hashed machine ID (SHA-256) from MCP authentication',
  machine_id_raw VARCHAR(255) NULL COMMENT 'Optional: Unhashed machine ID for display (if provided)',

  -- User profile
  username VARCHAR(255) NULL COMMENT 'Optional display name',
  email VARCHAR(255) NULL COMMENT 'Optional email address',

  -- Authentication
  role ENUM('developer', 'stakeholder', 'admin') NOT NULL DEFAULT 'developer',
  password_hash VARCHAR(255) NULL COMMENT 'Optional: For future password authentication',

  -- Status management
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Quick active check (TRUE = active, FALSE = inactive/suspended)',

  -- Metadata
  created_at BIGINT NOT NULL COMMENT 'Unix timestamp (ms)',
  updated_at BIGINT NOT NULL COMMENT 'Unix timestamp (ms)',
  last_login_at BIGINT NULL COMMENT 'Unix timestamp (ms) of last authentication',
  last_seen_ip VARCHAR(45) NULL COMMENT 'Last IP address',
  last_seen_user_agent VARCHAR(512) NULL COMMENT 'Last user agent string',

  -- Indexes
  UNIQUE KEY unique_user_per_customer (customer_id, user_id) COMMENT 'One user record per machine per customer',
  UNIQUE KEY unique_user_per_si (service_integrator_id, user_id) COMMENT 'One user record per machine per SI',
  INDEX idx_user_id (user_id) COMMENT 'Fast lookup by machine ID',
  INDEX idx_customer_status (customer_id, status) COMMENT 'List users by customer and status',
  INDEX idx_si_status (service_integrator_id, status) COMMENT 'List users by SI and status',
  INDEX idx_role (role) COMMENT 'Filter by role',
  INDEX idx_last_login (last_login_at) COMMENT 'Sort by recent activity',

  -- Foreign key constraints
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_integrator_id) REFERENCES service_integrators(id) ON DELETE CASCADE,

  -- Constraints
  CHECK (
    (customer_id IS NOT NULL AND service_integrator_id IS NULL) OR
    (customer_id IS NULL AND service_integrator_id IS NOT NULL)
  ) COMMENT 'User belongs to either customer OR service integrator, not both'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User credentials and management for enterprise licensing';

-- Create user activity log table
CREATE TABLE IF NOT EXISTS user_activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- User reference
  user_id BIGINT NOT NULL COMMENT 'References users.id',

  -- Activity data
  activity_type ENUM('login', 'logout', 'status_change', 'role_change', 'created', 'updated') NOT NULL,
  activity_timestamp BIGINT NOT NULL COMMENT 'Unix timestamp (ms)',

  -- Context
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,

  -- Details
  old_value VARCHAR(255) NULL COMMENT 'Previous value for changes',
  new_value VARCHAR(255) NULL COMMENT 'New value for changes',
  performed_by VARCHAR(255) NULL COMMENT 'Who performed the action (admin, system, self)',
  notes TEXT NULL COMMENT 'Additional context',

  -- Indexes
  INDEX idx_user_activity (user_id, activity_timestamp) COMMENT 'User activity history',
  INDEX idx_activity_type (activity_type) COMMENT 'Filter by activity type',
  INDEX idx_timestamp (activity_timestamp) COMMENT 'Sort by time',

  -- Foreign key
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail for user activity and changes';
