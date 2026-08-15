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

-- Insert the initial admin
-- Replace 'you@example.com' with the email you'll log in with (must already exist in `users`).
-- Note: Prisma db push uses camelCase column names (userId, not user_id)
-- This will only work if the user exists in the users table
INSERT INTO admins (id, "userId", email, "addedBy", "createdAt", "updatedAt")
SELECT
  'admin_' || substr(md5(u.id || u.email), 1, 20),
  u.id,
  u.email,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
WHERE u.email = 'you@example.com'
  AND NOT EXISTS (SELECT 1 FROM admins WHERE "userId" = u.id);

