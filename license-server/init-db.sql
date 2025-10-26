-- Snow-Flow Enterprise License Server - MySQL Schema
-- Compatible with MySQL 8.4

-- Use the licenses database
USE licenses;

-- Service Integrators Table
CREATE TABLE IF NOT EXISTS service_integrators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  billing_email VARCHAR(255) NOT NULL,
  master_license_key VARCHAR(100) UNIQUE NOT NULL,
  white_label_enabled BOOLEAN DEFAULT FALSE,
  custom_domain VARCHAR(255),
  logo_url TEXT,
  created_at BIGINT NOT NULL,
  status ENUM('active', 'suspended', 'churned') DEFAULT 'active',
  INDEX idx_si_master_key (master_license_key),
  INDEX idx_si_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_integrator_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  license_key VARCHAR(100) UNIQUE NOT NULL,
  theme VARCHAR(50),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  status ENUM('active', 'suspended', 'churned') DEFAULT 'active',
  total_api_calls INT DEFAULT 0,
  last_api_call BIGINT,
  INDEX idx_customers_license_key (license_key),
  INDEX idx_customers_si (service_integrator_id),
  INDEX idx_customers_status (status),
  FOREIGN KEY (service_integrator_id) REFERENCES service_integrators(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Instances Table
CREATE TABLE IF NOT EXISTS customer_instances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  instance_id VARCHAR(255) NOT NULL,
  instance_name VARCHAR(255),
  hostname VARCHAR(255),
  ip_address VARCHAR(45),
  last_seen BIGINT NOT NULL,
  version VARCHAR(50) NOT NULL,
  validation_count INT NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  INDEX idx_ci_customer (customer_id),
  INDEX idx_ci_instance (instance_id),
  UNIQUE KEY unique_customer_instance (customer_id, instance_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MCP Usage Table
CREATE TABLE IF NOT EXISTS mcp_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  instance_id INT NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  tool_category ENUM('jira', 'azdo', 'confluence', 'ml', 'sso') NOT NULL,
  timestamp BIGINT NOT NULL,
  duration_ms INT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  request_params TEXT,
  ip_address VARCHAR(45),
  INDEX idx_mcp_usage_customer (customer_id),
  INDEX idx_mcp_usage_timestamp (timestamp),
  INDEX idx_mcp_usage_tool (tool_name),
  INDEX idx_mcp_usage_category (tool_category),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES customer_instances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Logs Table
CREATE TABLE IF NOT EXISTS api_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,
  duration_ms INT NOT NULL,
  timestamp BIGINT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  license_key VARCHAR(100),
  error_message TEXT,
  INDEX idx_api_logs_timestamp (timestamp),
  INDEX idx_api_logs_endpoint (endpoint(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SSO Config Table
CREATE TABLE IF NOT EXISTS sso_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  provider ENUM('saml', 'oauth', 'openid') NOT NULL,
  entry_point TEXT NOT NULL,
  issuer VARCHAR(500) NOT NULL,
  cert TEXT NOT NULL,
  callback_url TEXT NOT NULL,
  logout_url TEXT,
  name_id_format VARCHAR(255) DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  want_assertions_signed BOOLEAN DEFAULT TRUE,
  want_authn_response_signed BOOLEAN DEFAULT TRUE,
  signature_algorithm VARCHAR(50) DEFAULT 'sha256',
  attribute_mapping TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_sso_config_customer (customer_id),
  INDEX idx_sso_config_enabled (enabled),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SSO Sessions Table
CREATE TABLE IF NOT EXISTS sso_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  session_token VARCHAR(500) UNIQUE NOT NULL,
  name_id VARCHAR(500),
  session_index VARCHAR(500),
  attributes TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_activity BIGINT NOT NULL,
  INDEX idx_sso_sessions_customer (customer_id),
  INDEX idx_sso_sessions_token (session_token),
  INDEX idx_sso_sessions_user (user_id),
  INDEX idx_sso_sessions_expires (expires_at),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Licenses Table (legacy support)
CREATE TABLE IF NOT EXISTS licenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  tier ENUM('Team', 'Professional', 'Enterprise') NOT NULL,
  status ENUM('active', 'expired', 'suspended', 'invalid') NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  customer_id INT,
  max_instances INT NOT NULL DEFAULT 1,
  features TEXT NOT NULL,
  expires_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  total_api_calls INT DEFAULT 0,
  last_api_call BIGINT,
  INDEX idx_licenses_key (`key`),
  INDEX idx_licenses_status (status),
  INDEX idx_licenses_customer (customer_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- License Instances Table
CREATE TABLE IF NOT EXISTS license_instances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  license_id INT NOT NULL,
  instance_id VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  last_seen BIGINT NOT NULL,
  ip_address VARCHAR(45),
  hostname VARCHAR(255),
  validation_count INT NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  INDEX idx_li_license (license_id),
  INDEX idx_li_instance (instance_id),
  UNIQUE KEY unique_license_instance (license_id, instance_id),
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data (for development/testing)
INSERT INTO service_integrators (company_name, contact_email, billing_email, master_license_key, white_label_enabled, created_at, status)
VALUES
  ('Snow-Flow Direct', 'contact@snow-flow.ai', 'billing@snow-flow.ai', 'SNOW-SI-DIRECT', FALSE, UNIX_TIMESTAMP() * 1000, 'active')
ON DUPLICATE KEY UPDATE company_name = company_name;

-- Sample customer (optional - uncomment if needed for testing)
-- INSERT INTO customers (service_integrator_id, name, contact_email, company, license_key, created_at, updated_at, status)
-- VALUES
--   (1, 'Test Customer', 'test@example.com', 'Test Company', 'SNOW-ENT-TEST-CUSTOMER', UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000, 'active')
-- ON DUPLICATE KEY UPDATE name = name;
