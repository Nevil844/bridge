-- Insert the initial admin
-- Replace 'you@example.com' below with the email you'll log in with (must already exist in `users`,
-- i.e. you've signed in via Google OAuth at least once).
-- This works with Prisma db push which uses camelCase column names
-- Run this AFTER running: npx prisma db push

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

