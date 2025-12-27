-- Insert the initial admin (neviljobanputra34@gmail.com)
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
WHERE u.email = 'neviljobanputra34@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM admins WHERE "userId" = u.id);

