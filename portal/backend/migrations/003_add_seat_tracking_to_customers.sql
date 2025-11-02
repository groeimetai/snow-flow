-- Migration: Add seat tracking to customers table
-- Version: 1.0.0
-- Date: 2025-11-02
-- Description: Adds developer and stakeholder seat tracking fields to support
--              seat-based licensing and connection management.

-- Add seat tracking columns
ALTER TABLE customers
  ADD COLUMN developer_seats INT DEFAULT -1 COMMENT 'Total developer seats (-1 = unlimited, for legacy licenses)',
  ADD COLUMN stakeholder_seats INT DEFAULT -1 COMMENT 'Total stakeholder seats (-1 = unlimited, for legacy licenses)',
  ADD COLUMN active_developer_seats INT DEFAULT 0 COMMENT 'Currently active developer connections (real-time count)',
  ADD COLUMN active_stakeholder_seats INT DEFAULT 0 COMMENT 'Currently active stakeholder connections (real-time count)',
  ADD COLUMN seat_limits_enforced BOOLEAN DEFAULT TRUE COMMENT 'Feature flag: enable/disable seat enforcement per customer';

-- Add index for efficient seat queries
CREATE INDEX idx_customers_seats ON customers(developer_seats, stakeholder_seats);

-- Add index for finding customers at capacity
CREATE INDEX idx_customers_active_seats ON customers(active_developer_seats, active_stakeholder_seats);

-- Backfill existing customers with unlimited seats (backward compatibility)
-- This ensures legacy customers without seat-based licenses continue to work
UPDATE customers
SET
  developer_seats = -1,
  stakeholder_seats = -1,
  active_developer_seats = 0,
  active_stakeholder_seats = 0,
  seat_limits_enforced = TRUE
WHERE developer_seats IS NULL;

-- Verification query (run after migration)
-- SELECT COUNT(*) as total_customers,
--        SUM(CASE WHEN developer_seats = -1 THEN 1 ELSE 0 END) as unlimited_dev,
--        SUM(CASE WHEN stakeholder_seats = -1 THEN 1 ELSE 0 END) as unlimited_stakeholder
-- FROM customers;
