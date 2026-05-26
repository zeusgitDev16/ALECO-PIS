-- Add updated_at column to users table for optimistic concurrency control
-- This enables version checking to prevent race conditions when updating user profiles

ALTER TABLE users
ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;
