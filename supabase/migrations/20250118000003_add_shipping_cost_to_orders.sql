-- Add shipping cost to orders table

-- Add shipping cost column
ALTER TABLE orders ADD COLUMN shipping_cost DECIMAL(10,2) DEFAULT 0.00;

-- Add comment to the column
COMMENT ON COLUMN orders.shipping_cost IS 'Shipping cost for the order';
