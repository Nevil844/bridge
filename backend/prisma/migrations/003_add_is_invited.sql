-- Add isInvited column to waitlist table
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS is_invited BOOLEAN NOT NULL DEFAULT false;

-- Create index on isInvited for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_is_invited ON waitlist(is_invited);

