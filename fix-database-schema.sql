-- Fix Database Schema - Foreign Key Relationships
-- Run this in Supabase SQL Editor

-- 1. Fix order_costs table foreign key relationship
ALTER TABLE public.order_costs 
ADD CONSTRAINT order_costs_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 2. Fix order_customer_notes table foreign key relationship  
ALTER TABLE public.order_customer_notes 
ADD CONSTRAINT order_customer_notes_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 3. Fix order_billing_address table foreign key relationship
ALTER TABLE public.order_billing_address 
ADD CONSTRAINT order_billing_address_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 4. Fix order_shipping_address table foreign key relationship
ALTER TABLE public.order_shipping_address 
ADD CONSTRAINT order_shipping_address_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 5. Fix order_items table foreign key relationship
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 6. Fix diamond_deductions table foreign key relationship
ALTER TABLE public.diamond_deductions 
ADD CONSTRAINT diamond_deductions_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 7. Fix order_casting table foreign key relationship
ALTER TABLE public.order_casting 
ADD CONSTRAINT order_casting_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 8. Fix order_3d_related table foreign key relationship
ALTER TABLE public.order_3d_related 
ADD CONSTRAINT order_3d_related_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 9. Fix order_employee_comments table foreign key relationship
ALTER TABLE public.order_employee_comments 
ADD CONSTRAINT order_employee_comments_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- Verify the relationships were created
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'orders'
ORDER BY tc.table_name;
