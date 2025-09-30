-- Fix RLS policy for order_employee_comments table
-- Add SELECT policy to allow authenticated users to read employee comments

CREATE POLICY "Users can read employee comments" 
ON order_employee_comments 
FOR SELECT 
TO authenticated 
USING (true);

-- Alternative: If you want to allow anonymous users to read as well
-- CREATE POLICY "Anyone can read employee comments" 
-- ON order_employee_comments 
-- FOR SELECT 
-- TO anon, authenticated 
-- USING (true);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'order_employee_comments' 
ORDER BY policyname;
