-- Add discount information to orders table

-- Add discount amount column
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;

-- Add discount codes column (JSON array to store multiple discount codes)
ALTER TABLE orders ADD COLUMN discount_codes JSONB DEFAULT '[]'::jsonb;

-- Add comment to the columns
COMMENT ON COLUMN orders.discount_amount IS 'Total discount amount applied to the order';
COMMENT ON COLUMN orders.discount_codes IS 'Array of discount codes applied to the order';
