-- Add customer_id column to customers table
-- This column will store 6-digit customer numbers like 000001, 000020, etc.

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- Create an index on customer_id for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);

-- Add a unique constraint to ensure customer_id is unique
ALTER TABLE customers 
ADD CONSTRAINT unique_customer_id UNIQUE (customer_id);

-- Add a check constraint to ensure customer_id is 6 digits
ALTER TABLE customers 
ADD CONSTRAINT check_customer_id_format 
CHECK (customer_id IS NULL OR customer_id ~ '^[0-9]{6}$');

-- Add a comment to document the column
COMMENT ON COLUMN customers.customer_id IS '6-digit customer number (e.g., 000001, 000020) generated during sync from Shopify';
