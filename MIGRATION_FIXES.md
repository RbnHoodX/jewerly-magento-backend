# Migration Fixes - Automated Order Status Updates

## Issues Fixed

### 1. SQL Syntax Error in statuses_model Table

**Problem**: Invalid CHECK constraint syntax

```sql
-- ❌ WRONG
wait_time_business_days INTEGER CHECK (wait_time_business_days >= 0) OR wait_time_business_days = 'Instant'
```

**Solution**: Simplified to use only integer values

```sql
-- ✅ FIXED
wait_time_business_days INTEGER CHECK (wait_time_business_days >= 0)
```

### 2. Foreign Key Reference Error

**Problem**: email_logs table referenced statuses_model before it was created

```sql
-- ❌ WRONG
status_rule_id UUID REFERENCES public.statuses_model(id) ON DELETE SET NULL,
```

**Solution**:

1. Removed foreign key constraint from initial table creation
2. Added separate migration to create foreign key after both tables exist

### 3. Existing Table Conflict

**Problem**: order_customer_notes table already exists in Supabase
**Solution**: Deleted the migration file since the table already exists

## Updated Migration Files

### 1. `20250113000100_create_statuses_model_table.sql`

- Fixed CHECK constraint syntax
- Uses integer values only (0 = instant)

### 2. `20250113000200_create_email_logs_table.sql`

- Removed foreign key constraint to statuses_model
- Will be added in separate migration

### 3. `20250113000300_create_order_customer_notes_table.sql`

- **DELETED** - Table already exists

### 4. `20250113000400_insert_sample_status_rules.sql`

- Updated to use integer values (0 instead of 'Instant')

### 5. `20250113000500_add_foreign_key_constraints.sql`

- **NEW** - Adds foreign key constraint after both tables exist

## Updated Code

### Automation Service

- Changed `wait_time_business_days` from `number | "Instant"` to `number`
- Updated logic to check for `0` instead of `"Instant"`

### TypeScript Types

- Updated to reflect integer-only values
- Removed string union type

## Testing

Run the migration test to verify everything works:

```bash
npm run test:migrations
```

## Migration Order

Run migrations in this order:

1. `20250113000100_create_statuses_model_table.sql`
2. `20250113000200_create_email_logs_table.sql`
3. `20250113000400_insert_sample_status_rules.sql`
4. `20250113000500_add_foreign_key_constraints.sql`

## Sample Data

The sample rules now use:

- `0` for instant transitions (Order Placed → Processing)
- `2` for 2 business days (Processing → In Production)
- `5` for 5 business days (In Production → Quality Control)
- `1` for 1 business day (Quality Control → Shipped)
- `3` for 3 business days (Shipped → Delivered)

All migrations should now run without errors! ✅
