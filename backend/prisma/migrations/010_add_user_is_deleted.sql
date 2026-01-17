-- Add isDeleted column to users table
-- Soft delete flag to prevent users from deleting and re-creating accounts to abuse free credits
-- When true, user account is marked as deleted and login is blocked

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false NOT NULL;

-- Add index for efficient querying of deleted users
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users("isDeleted");

-- Add comment for documentation
COMMENT ON COLUMN users."isDeleted" IS 'Soft delete flag. When true, user account is marked as deleted and login is blocked to prevent abuse of free credits';
