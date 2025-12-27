-- Add integration_settings table for admin-controlled integration visibility
CREATE TABLE IF NOT EXISTS integration_settings (
  id TEXT PRIMARY KEY,
  provider TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_integration_settings_provider ON integration_settings(provider);
CREATE INDEX IF NOT EXISTS idx_integration_settings_is_enabled ON integration_settings(is_enabled);

