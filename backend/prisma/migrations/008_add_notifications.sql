-- Add notifications table for admin notification management
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'push',
  "targetType" TEXT NOT NULL DEFAULT 'all',
  "targetValue" TEXT,
  "scheduledFor" TIMESTAMP,
  "sentAt" TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  metadata JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled ON notifications(status, "scheduledFor");
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON notifications("createdBy");
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications("createdAt" DESC);

