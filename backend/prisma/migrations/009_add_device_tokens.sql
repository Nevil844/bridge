-- Add device_tokens table for push notification device tokens
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_device_token_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active ON device_tokens("userId", "isActive");
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

