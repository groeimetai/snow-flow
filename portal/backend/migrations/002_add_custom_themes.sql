/**
 * Migration 002: Add Custom Themes for Service Integrators
 *
 * Allows Service Integrators to create and manage custom SnowCode themes
 * that can be assigned to their customers for branded CLI experiences.
 */

-- Create custom themes table
CREATE TABLE IF NOT EXISTS `service_integrator_themes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_integrator_id` INT NOT NULL,
  `theme_name` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(255) NOT NULL,
  `description` TEXT,

  -- Theme configuration (SnowCode theme JSON)
  `theme_config` JSON NOT NULL,

  -- Quick access to key colors for UI display
  `primary_color` VARCHAR(7) NOT NULL, -- Hex color (e.g., '#0070AD')
  `secondary_color` VARCHAR(7),
  `accent_color` VARCHAR(7),

  -- Theme metadata
  `is_active` BOOLEAN DEFAULT TRUE,
  `is_default` BOOLEAN DEFAULT FALSE, -- Default theme for new customers
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,

  -- Constraints
  UNIQUE KEY `unique_theme_per_si` (`service_integrator_id`, `theme_name`),
  FOREIGN KEY (`service_integrator_id`) REFERENCES `service_integrators`(`id`) ON DELETE CASCADE,

  INDEX `idx_si_themes` (`service_integrator_id`, `is_active`),
  INDEX `idx_theme_name` (`theme_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add usage tracking columns to customers table
ALTER TABLE `customers`
  ADD COLUMN `custom_theme_id` INT NULL AFTER `theme`,
  ADD FOREIGN KEY (`custom_theme_id`) REFERENCES `service_integrator_themes`(`id`) ON DELETE SET NULL;

-- Create theme usage audit log
CREATE TABLE IF NOT EXISTS `theme_usage_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `theme_id` INT NOT NULL,
  `action` ENUM('assigned', 'activated', 'deactivated', 'removed') NOT NULL,
  `timestamp` BIGINT NOT NULL,

  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`theme_id`) REFERENCES `service_integrator_themes`(`id`) ON DELETE CASCADE,

  INDEX `idx_customer_theme_logs` (`customer_id`, `timestamp`),
  INDEX `idx_theme_usage` (`theme_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert example custom themes (optional)
-- INSERT INTO `service_integrator_themes` (
--   `service_integrator_id`,
--   `theme_name`,
--   `display_name`,
--   `description`,
--   `theme_config`,
--   `primary_color`,
--   `is_default`,
--   `created_at`,
--   `updated_at`
-- ) VALUES (
--   1, -- Example SI ID
--   'capgemini',
--   'Capgemini',
--   'Official Capgemini brand theme',
--   '{"name": "Capgemini", "colors": {"primary": "#0070AD", "secondary": "#00CFFF", "background": "#FFFFFF"}}',
--   '#0070AD',
--   TRUE,
--   UNIX_TIMESTAMP() * 1000,
--   UNIX_TIMESTAMP() * 1000
-- );
