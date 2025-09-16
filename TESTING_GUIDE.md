# 🧪 Testing Wait Time and Private Email Notification System

## 📋 Current Status Rules Found

The system has these active status rules:

1. **Casting Order → Casting Order Email Sent** (0 days wait, no private email)
2. **Casting Order Delay - Jenny → Casting Order Delay - David** (1 day wait, private email: ydavid74@gmail.com)
3. **Casting Order Email Sent → Casting Order Delay - Jenny** (3 days wait, private email: primestyle11@gmail.com)
4. **Casting Received → Casting Received Email Sent** (0 days wait, no private email)
5. **Item Shipped → Item Shipped Email Sent** (0 days wait, no private email)
6. **Polishing & Finishing → Polishing & Finishing Email Sent** (0 days wait, no private email)
7. **Return For Refund Instructions → Return For Refund Instructions Email Sent** (0 days wait, no private email)
8. **Return For Refund Received → Return For Refund Received Email Sent** (0 days wait, no private email)

## 🎯 How to Test the System

### Method 1: Test with Existing Data

1. **Check Current Orders**:
   ```bash
   # Run the test script
   node test-wait-time-system.js
   ```

2. **Manually Trigger Automation**:
   ```bash
   curl -X POST http://localhost:3003/api/automation/run-once
   ```

3. **Check Email Logs**:
   ```bash
   curl http://localhost:3003/api/email/logs
   ```

### Method 2: Create Test Data

1. **Create a Test Order with Status**:
   ```sql
   -- Insert a test order
   INSERT INTO orders (id, shopify_order_number, order_date, total_amount, customer_id)
   VALUES ('test-order-123', 'TEST001', NOW(), 100.00, 'test-customer-123');
   
   -- Insert customer
   INSERT INTO customers (id, name, email)
   VALUES ('test-customer-123', 'Test Customer', 'test@example.com');
   
   -- Insert status note
   INSERT INTO order_customer_notes (order_id, status, content, created_at)
   VALUES ('test-order-123', 'Casting Order Email Sent', 'Test status for wait time', NOW());
   ```

2. **Wait for the Wait Time** (3 business days for "Casting Order Email Sent → Casting Order Delay - Jenny")

3. **Run Automation**:
   ```bash
   curl -X POST http://localhost:3003/api/automation/run-once
   ```

### Method 3: Modify Wait Time for Testing

1. **Update a Rule to 0 Days**:
   ```sql
   UPDATE statuses_model 
   SET wait_time_business_days = 0 
   WHERE status = 'Casting Order Email Sent' AND new_status = 'Casting Order Delay - Jenny';
   ```

2. **Run Automation**:
   ```bash
   curl -X POST http://localhost:3003/api/automation/run-once
   ```

3. **Check Results**:
   ```bash
   curl http://localhost:3003/api/email/logs
   ```

## 📧 Expected Email Notifications

When the system processes a status transition, you should see:

### Private Email Notifications
- **To**: `primestyle11@gmail.com` (for Casting Order Email Sent → Casting Order Delay - Jenny)
- **Subject**: `Order Update: #120307 - Casting Order Email Sent → Casting Order Delay - Jenny`
- **Content**: 
  ```
  Order Update Notification

  Order #120307 has been updated:
  - From: Casting Order Email Sent
  - To: Casting Order Delay - Jenny
  - Customer: Jenny Adajar (dnaganda@gmail.com)
  - Wait Time: 3 business days
  - Updated: [current timestamp]

  This is an automated notification from the order management system.
  ```

### Customer Emails (if configured)
- Original customer notification emails

## 🔍 Monitoring the System

1. **Check Server Logs**: Look for automation logs in the terminal
2. **Check Email Logs**: Use the API endpoint to see sent emails
3. **Check Order Status**: Verify status transitions in the database

## 🚨 Troubleshooting

1. **No Emails Sent**: Check if wait time has passed
2. **Wrong Recipients**: Verify private_email in statuses_model table
3. **Server Not Running**: Make sure API server is running on port 3003
4. **Database Issues**: Check Supabase connection and table structure

## 📊 Test Results

After running tests, you should see:
- Status transitions in order_customer_notes table
- Email logs in email_logs table
- Private email notifications sent to configured addresses
- Server logs showing automation progress
