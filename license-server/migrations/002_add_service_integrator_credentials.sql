-- Migration 002: Add Service Integrator Credentials Table
-- Created: 2025-10-28
-- Purpose: Store encrypted credentials for service integrators (Jira, Azure DevOps, Confluence, etc.)

USE licenses;

-- Service Integrator Credentials Table
-- Stores encrypted API credentials for external service integrations
CREATE TABLE IF NOT EXISTS service_integrator_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_integrator_id INT NOT NULL,

  -- Service type
  service_type ENUM('jira', 'azure-devops', 'confluence', 'servicenow', 'github', 'gitlab') NOT NULL,

  -- Credential type
  credential_type ENUM('oauth2', 'api_token', 'basic_auth', 'pat') NOT NULL DEFAULT 'api_token',

  -- OAuth2 fields (encrypted with AES-256-GCM)
  -- Format: iv:authTag:encryptedData (hex-encoded)
  access_token TEXT,
  refresh_token TEXT,
  token_type VARCHAR(50),
  expires_at BIGINT,
  scope TEXT,

  -- API Token / PAT (encrypted)
  api_token TEXT,

  -- Basic Auth (encrypted)
  username VARCHAR(255),
  password TEXT,

  -- Service configuration
  base_url VARCHAR(500) NOT NULL,
  email VARCHAR(255),

  -- OAuth2 app config (NOT encrypted - public info)
  client_id VARCHAR(500),

  -- Configuration metadata (JSON)
  config_json TEXT COMMENT 'JSON configuration for service-specific settings',

  -- Status and metadata
  enabled BOOLEAN DEFAULT TRUE,
  last_used BIGINT,
  last_refreshed BIGINT,
  last_test_status ENUM('success', 'failed', 'not_tested') DEFAULT 'not_tested',
  last_test_message TEXT,
  last_tested_at BIGINT,

  -- Timestamps
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,

  -- Constraints
  INDEX idx_sic_service_integrator (service_integrator_id),
  INDEX idx_sic_service_type (service_type),
  INDEX idx_sic_enabled (enabled),
  INDEX idx_sic_expires (expires_at),
  UNIQUE KEY unique_si_service (service_integrator_id, service_type),
  FOREIGN KEY (service_integrator_id) REFERENCES service_integrators(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Encrypted credentials for service integrator external service connections';

-- Create audit log table for credential access
CREATE TABLE IF NOT EXISTS service_integrator_credentials_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  credential_id INT NOT NULL,
  service_integrator_id INT NOT NULL,
  action ENUM('created', 'updated', 'accessed', 'deleted', 'tested', 'refreshed') NOT NULL,
  performed_by VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  timestamp BIGINT NOT NULL,

  INDEX idx_sica_credential (credential_id),
  INDEX idx_sica_timestamp (timestamp),
  INDEX idx_sica_action (action),
  FOREIGN KEY (credential_id) REFERENCES service_integrator_credentials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit log for credential access and modifications';

-- Migration completed successfully
SELECT 'Migration 002 completed: service_integrator_credentials table created' AS status;
