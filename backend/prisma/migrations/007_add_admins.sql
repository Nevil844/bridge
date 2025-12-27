-- Add admins table for multi-admin support
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  added_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Insert the initial admin (neviljobanputra34@gmail.com)
-- Note: This will only work if the user exists in the users table
-- You may need to run this after the user is created, or update the user_id manually
-- Using a simple approach: generate a unique ID using md5 hash
INSERT INTO admins (id, user_id, email, added_by, created_at, updated_at)
SELECT 
  'admin_' || substr(md5(u.id || u.email), 1, 20),
  u.id,
  u.email,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
WHERE u.email = 'neviljobanputra34@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM admins WHERE user_id = u.id);

