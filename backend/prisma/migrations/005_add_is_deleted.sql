-- Add isDeleted column to conversations table
-- Soft delete flag for safety and abuse prevention
-- When true, conversation is marked as deleted but data is preserved

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL;

-- Add index for efficient querying of deleted conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_is_deleted ON conversations(user_id, is_deleted);

-- Add comment for documentation
COMMENT ON COLUMN conversations.is_deleted IS 'Soft delete flag. When true, conversation is marked as deleted but data is preserved for safety and abuse prevention';

