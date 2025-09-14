# Automated Order Status Updates & Customer Communication

This system automatically manages order status transitions and sends customer notifications based on configurable rules.

## Overview

The automation system consists of:

1. **Database Tables**: Store automation rules and track status changes
2. **Automation Service**: Core logic for processing status transitions
3. **Email Service**: Handles customer notifications via Shopify API
4. **Cron Service**: Runs automation hourly
5. **CLI Tools**: Manage the automation service

## Database Schema

### Tables

#### `statuses_model`

Stores automation rules for status transitions.

| Field                     | Type    | Description                                  |
| ------------------------- | ------- | -------------------------------------------- |
| `id`                      | UUID    | Primary key                                  |
| `status`                  | TEXT    | Current status that triggers the rule        |
| `new_status`              | TEXT    | Next status to transition to                 |
| `wait_time_business_days` | INTEGER | Days to wait before transition (0 = instant) |
| `description`             | TEXT    | Human-readable description                   |
| `private_email`           | TEXT    | Email to send copy of notifications          |
| `email_subject`           | TEXT    | Subject line for customer emails             |
| `email_custom_message`    | TEXT    | Email body with placeholders                 |
| `additional_recipients`   | TEXT[]  | Additional email addresses to CC             |
| `is_active`               | BOOLEAN | Whether this rule is active                  |

#### `order_customer_notes`

Stores customer-facing status updates.

| Field                  | Type      | Description                                |
| ---------------------- | --------- | ------------------------------------------ |
| `id`                   | UUID      | Primary key                                |
| `order_id`             | UUID      | Reference to order                         |
| `status`               | TEXT      | Current order status                       |
| `note`                 | TEXT      | Optional note for customer                 |
| `is_automated`         | BOOLEAN   | Whether this was created by automation     |
| `triggered_by_rule_id` | UUID      | Reference to the rule that triggered this  |
| `created_at`           | TIMESTAMP | When this note was created                 |
| `created_by`           | UUID      | User who created this (null for automated) |

#### `email_logs`

Audit trail for all emails sent.

| Field              | Type      | Description                                  |
| ------------------ | --------- | -------------------------------------------- |
| `id`               | UUID      | Primary key                                  |
| `order_id`         | UUID      | Reference to order                           |
| `status_rule_id`   | UUID      | Reference to the rule                        |
| `email_type`       | TEXT      | Type: 'customer', 'private', or 'additional' |
| `recipient_email`  | TEXT      | Email address                                |
| `subject`          | TEXT      | Email subject                                |
| `message`          | TEXT      | Email body                                   |
| `sent_at`          | TIMESTAMP | When email was sent                          |
| `status`           | TEXT      | 'sent', 'failed', or 'pending'               |
| `error_message`    | TEXT      | Error details if failed                      |
| `shopify_email_id` | TEXT      | Shopify API email ID                         |

## Email Placeholders

The system supports the following placeholders in email content:

- `{{ order_number }}` - Order number (Shopify or internal)
- `{{ customer_name }}` - Customer name
- `{{ customer_email }}` - Customer email
- `{{ status }}` - Current status
- `{{ note }}` - Status note
- `{{ date }}` - Current date
- `{{ time }}` - Current time

## Usage

### Starting the Automation Service

```bash
# Start the service (runs continuously)
npm run automation:start

# Run once and exit (for testing)
npm run automation:run-once

# Check status
npm run automation:status

# Stop the service
npm run automation:stop
```

### Environment Variables

Required:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

Optional (for email sending):

- `SHOPIFY_API_KEY` - Shopify API key
- `SHOPIFY_API_SECRET` - Shopify API secret
- `SHOPIFY_SHOP_DOMAIN` - Shopify shop domain

### Creating Status Rules

Insert rules into the `statuses_model` table:

```sql
INSERT INTO statuses_model (
    status,
    new_status,
    wait_time_business_days,
    description,
    private_email,
    email_subject,
    email_custom_message,
    additional_recipients,
    is_active
) VALUES (
    'Order Placed',
    'Processing',
    'Instant',
    'Order has been received and is being processed',
    'admin@primestyle.com',
    'Your Order is Being Processed - {{ order_number }}',
    'Dear {{ customer_name }},

Thank you for your order! We have received your order #{{ order_number }} and it is now being processed.

We will keep you updated on the progress of your order.

Best regards,
Prime Style Team',
    ARRAY['manager@primestyle.com'],
    true
);
```

## PrimeStyle Status Rules

The system comes with 10 pre-configured status rules for PrimeStyle:

### Production Stage Rules (Instant)

1. **Casting Order → Casting Order Email Sent** (Instant)
2. **Casting Received → Casting Received Email Sent** (Instant)
3. **Polishing & Finishing → Polishing & Finishing Email Sent** (Instant)

### Return Process Rules (Instant)

4. **Return For Refund Instructions → Return For Refund Instructions Email Sent** (Instant)
5. **Return for replacement instructions → Return for replacement instructions Email Sent** (Instant)
6. **Return For Refund Received → Return For Refund Received Email Sent** (Instant)
7. **Return for replacement received → Return for replacement received Email Sent** (Instant)

### Shipping Rules (Instant)

8. **Item Shipped → Item Shipped Email Sent** (Instant)

### Delay Escalation Rules

9. **Casting Order Email Sent → Casting Order Delay - Jenny** (3 business days)
10. **Casting Order Delay - Jenny → Casting Order Delay - David** (1 business day)

Each rule includes:

- ✅ **Customer email** with personalized content (where applicable)
- ✅ **Private email notifications** to Jenny and David for delays
- ✅ **Placeholder replacement** for dynamic content ({{ order_number }})
- ✅ **Detailed return instructions** with specific PrimeStyle requirements

## How It Works

1. **Hourly Execution**: The cron service runs every hour
2. **Rule Processing**: For each active rule, find orders with the current status
3. **Wait Time Check**: If wait time is not 0 (instant), check if enough business days have passed
4. **Status Transition**: Insert new status note into `order_customer_notes`
5. **Email Sending**: Send emails to customer, private email, and additional recipients
6. **Logging**: Log all email attempts in `email_logs`

## Business Days Calculation

The system calculates business days by:

- Starting from the note creation date
- Counting only weekdays (Monday-Friday)
- Excluding weekends (Saturday-Sunday)

## Error Handling

- Failed email sends are logged with error details
- Automation continues processing other orders if one fails
- All operations are logged for debugging

## Monitoring

Check the logs for:

- Automation execution status
- Email send results
- Error details
- Processing statistics

## Integration with Existing UI

The system integrates with the existing magento-admin UI:

- Status dropdown shows current status from `order_customer_notes`
- Timeline shows all status changes
- Note handling works with both manual and automated notes

## Security

- All database operations use Row Level Security (RLS)
- Email content is sanitized to prevent injection attacks
- Environment variables are used for sensitive configuration

## Troubleshooting

### Common Issues

1. **Emails not sending**: Check Shopify credentials and API limits
2. **Rules not triggering**: Verify `is_active` is true and status matches exactly
3. **Business days not calculating**: Check timezone settings and date formats

### Debugging

1. Check logs for detailed error messages
2. Verify database connections and permissions
3. Test email sending with `run-once` command
4. Check `email_logs` table for send status

## Future Enhancements

- Webhook integration for real-time updates
- Email templates with rich formatting
- Advanced scheduling options
- Customer preference management
- A/B testing for email content
