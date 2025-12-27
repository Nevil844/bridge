-- Add creditsUsed column to token_usage table
-- Credits are cost-based units (1 credit = $0.01)
-- Stored as DECIMAL(10,2) to support 2 decimal places

ALTER TABLE token_usage 
ADD COLUMN IF NOT EXISTS credits_used DECIMAL(10, 2) DEFAULT 0 NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN token_usage.credits_used IS 'Credits consumed (rounded to 2 decimals). 1 credit = $0.01';

