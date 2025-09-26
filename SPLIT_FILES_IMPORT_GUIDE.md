# Split Files Import Guide

## Overview

The order import system has been updated to handle split files instead of a single Excel file. This provides better performance and easier maintenance.

## File Structure

The original `output.xlsx` file has been split into the following files in the `migration/` directory:

### 1. Main Order Data

- **File**: `main_page.csv` (20.5 MB)
- **Content**: Main order information, customer data, billing/shipping addresses, and up to 10 products per order
- **Database Tables**: `orders`, `customers`, `order_billing_address`, `order_shipping_address`, `order_items`

### 2. Customer Notes

- **File**: `Customer Notes.csv` (40.5 MB)
- **Content**: Order status updates and customer communication notes
- **Database Tables**: `order_comments`

### 3. Diamond Inventory

- **File**: `Diamonds.csv` (3.8 MB)
- **Content**: Diamond inventory and pricing data
- **Database Tables**: `diamond_inventory` (requires setup)

### 4. Casting Data

- **File**: `casting.csv` (1.8 MB)
- **Content**: Casting materials and inventory for orders
- **Database Tables**: `order_casting`

### 5. 3D Related Files

- **File**: `3drelated.csv` (1.4 MB)
- **Content**: 3D design files and attachments (up to 49 per order)
- **Database Tables**: `order_3d_related`

### 6. Employee Comments

- **File**: `Employee Comments.xlsx` (11.6 MB)
- **Content**: Employee comments with file attachments
- **Database Tables**: `order_employee_comments`

## Database Schema Changes

Based on the migration files, the following tables have been created/updated:

### New Tables

- `order_billing_address` - Separate billing address table
- `order_shipping_address` - Separate shipping address table
- `order_casting` - Casting materials and inventory
- `order_3d_related` - 3D design files and attachments
- `order_employee_comments` - Employee comments with video attachments
- `order_comments` - General order comments and notes

### Updated Tables

- `orders` - Added `bill_to_name`, `ship_to_name`, `customization_notes`, `how_did_you_hear`
- `customers` - Added `first_name`, `last_name`, `company`, `tax_id`, `notes`
- `order_items` - Added `image` column for product images

## Usage

### New Import Script

Use the new split files import script:

```bash
npx tsx scripts/import-orders-from-split-files.ts
```

### Original Import Script (Deprecated)

The original script is still available but should not be used:

```bash
# DO NOT USE - This is for the old single Excel file approach
npx tsx scripts/import-orders-from-xlsx.ts
```

## Key Differences

### 1. File Format

- **Old**: Single Excel file with multiple sheets
- **New**: Multiple CSV files + 1 Excel file for employee comments

### 2. Performance

- **Old**: Loads entire Excel file into memory
- **New**: Processes files individually, better memory usage

### 3. Data Structure

- **Old**: All data in one file, harder to maintain
- **New**: Split by data type, easier to update individual sections

### 4. Database Schema

- **Old**: Uses JSONB columns for addresses
- **New**: Separate tables for addresses, better normalization

## Migration Process

1. **Backup existing data** (if any)
2. **Run database migrations** to create new tables
3. **Place split files** in `migration/` directory
4. **Run new import script** to import all data
5. **Verify data** in database

## File Requirements

Ensure all files are present in the `migration/` directory:

- `main_page.csv`
- `Customer Notes.csv`
- `Diamonds.csv`
- `casting.csv`
- `3drelated.csv`
- `Employee Comments.xlsx`

## Error Handling

The new script includes better error handling:

- Individual file processing (if one fails, others continue)
- Detailed logging for each step
- Graceful handling of missing files
- Better error messages for debugging

## Testing

Use the test script to verify file structure:

```bash
npx tsx scripts/test-split-files.ts
```

This will:

- Check if all required files exist
- Display file sizes
- Test file accessibility
- Show sample data from each file

## Benefits

1. **Better Performance**: Smaller files load faster
2. **Easier Maintenance**: Update individual data types
3. **Better Schema**: Normalized database structure
4. **Scalability**: Can handle larger datasets
5. **Flexibility**: Import specific data types as needed

