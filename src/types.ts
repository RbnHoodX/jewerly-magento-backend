// Database table types based on Supabase schema
export interface Customer {
  id: string;
  customer_id?: string; // 6-digit customer number (e.g., 000001, 000020)
  name?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  billing_addr?: Address;
  shipping_addr?: Address;
  created_at: string;
}

export interface Address {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface Order {
  id: string;
  customer_id?: string;
  purchase_from?: string;
  order_date?: string;
  total_amount: number;
  discount_amount?: number;
  discount_codes?: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  shipping_cost?: number;
  bill_to_name?: string;
  ship_to_name?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku?: string;
  size?: string;
  metal_type?: string;
  details?: string;
  price: number;
  qty: number;
  image?: string;
}

export interface OrderBillingAddress {
  id: string;
  order_id: string;
  first_name: string;
  last_name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderShippingAddress {
  id: string;
  order_id: string;
  first_name: string;
  last_name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

// Shopify API types
export interface ShopifyCustomer {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface ShopifyLineItem {
  id: number;
  variant_id?: number;
  title: string;
  quantity: number;
  sku?: string;
  price: string;
  total_discount?: string;
  vendor?: string;
  product_id?: number;
  requires_shipping?: boolean;
  taxable?: boolean;
  fulfillment_status?: string;
  properties?: Array<{
    name: string;
    value: string;
  }>;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images: Array<{
    id: number;
    src: string;
    alt?: string;
    width: number;
    height: number;
  }>;
  variants: Array<{
    id: number;
    title: string;
    sku?: string;
    image_id?: number;
  }>;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  cancelled_at?: string;
  closed_at?: string;
  financial_status: string;
  fulfillment_status?: string;
  current_total_price: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_shipping?: string;
  currency: string;
  customer?: ShopifyCustomer;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
  tags: string;
  note?: string;
  test?: boolean;
  confirmed?: boolean;
  reference?: string;
  source_name?: string;
  referring_site?: string;
  landing_site?: string;
  browser_ip?: string;
  order_number: number;
  discount_codes: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  fulfillments: Array<{
    id: number;
    status: string;
    created_at: string;
    service: string;
    updated_at: string;
    tracking_company?: string;
    tracking_number?: string;
    tracking_numbers: string[];
    tracking_url?: string;
    tracking_urls: string[];
    receipt: {
      testcase: boolean;
      authorization: string;
    };
    name: string;
    admin_graphql_api_id: string;
    line_items: ShopifyLineItem[];
  }>;
  refunds: Array<{
    id: number;
    order_id: number;
    created_at: string;
    note?: string;
    user_id?: number;
    processed_at: string;
    restock: boolean;
    admin_graphql_api_id: string;
    refund_line_items: Array<{
      id: number;
      quantity: number;
      line_item_id: number;
      location_id?: number;
      restock_type: string;
      subtotal: string;
      total_tax: string;
      line_item: ShopifyLineItem;
    }>;
    transactions: Array<{
      id: number;
      order_id: number;
      kind: string;
      gateway?: string;
      status: string;
      message?: string;
      created_at: string;
      test: boolean;
      authorization?: string;
      location_id?: number;
      user_id?: number;
      parent_id?: number;
      processed_at: string;
      device_id?: number;
      receipt: {
        id: number;
        order_id: number;
        kind: string;
        gateway?: string;
        status: string;
        message?: string;
        created_at: string;
        test: boolean;
        authorization?: string;
        location_id?: number;
        user_id?: number;
        parent_id?: number;
        processed_at: string;
        device_id?: number;
        receipt: any;
        amount: string;
        currency: string;
        admin_graphql_api_id: string;
      };
      amount: string;
      currency: string;
      admin_graphql_api_id: string;
    }>;
  }>;
  customer_locale?: string;
  app_id?: number;
  checkout_id?: number;
  checkout_token?: string;
  gateway?: string;
  number: number;
  order_adjustments: Array<{
    id: number;
    order_id: number;
    refund_id?: number;
    amount: string;
    tax_amount: string;
    kind: string;
    reason: string;
    created_at: string;
    updated_at: string;
  }>;
  processing_method: string;
  source_url?: string;
  total_outstanding: string;
  total_price_usd: string;
  user_id?: number;
  admin_graphql_api_id: string;
}

// Sync operation types
export interface SyncResult {
  runId: string;
  timestamp: string;
  totalOrders: number;
  successfulImports: number;
  failedImports: number;
  skippedOrders: number;
  errors: string[];
}

export interface OrderImportResult {
  runId: string;
  shopifyId: string;
  name: string;
  status: "success" | "updated" | "error" | "skipped";
  orderId?: string;
  error?: string;
  summary?: {
    created_at: string;
    email?: string;
    line_items_count: number;
    total: string;
    tags: string;
  };
  snapshot?: {
    created_at: string;
    email?: string;
    line_items_count: number;
    total: string;
    tags: string;
  };
}

// Environment configuration
export interface SyncConfig {
  shopify: {
    storeDomain: string;
    apiVersion: string;
    accessToken: string;
    importTag: string;
    processedTag: string;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  sync: {
    since?: string;
    logLevel: "debug" | "info" | "warn" | "error";
    logDir: string;
    concurrency: number;
    retries: number;
  };
}

// Database operation types
export interface CustomerUpsertData {
  email: string;
  customer_id?: string; // 6-digit customer number (e.g., 000001, 000020)
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  billing_addr?: Address;
  shipping_addr?: Address;
}

export interface OrderInsertData {
  customer_id?: string;
  purchase_from: string;
  order_date?: string;
  total_amount: number;
  discount_amount?: number;
  discount_codes?: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  shipping_cost?: number;
  bill_to_name?: string;
  ship_to_name?: string;
  delivery_method?: string;
  shopify_order_number?: string;
  order_id?: string; // Use Shopify order number as order_id
  // Additional fields that may be present in database
  id?: string;
  created_at?: string;
  updated_at?: string;
  customization_notes?: string;
  previous_order_id?: string;
  how_did_you_hear?: string;
  labor?: number;
  cad_cost?: number;
  general_cost?: number;
  // TODO: Add these fields to database schema
  // order_number?: string
  // notes?: string
  // admin_order_number?: string
  // shipping_service?: string
  // shipping_cost?: number
}

export interface OrderItemInsertData {
  order_id: string;
  sku?: string;
  size?: string;
  metal_type?: string;
  details?: string;
  price: number;
  qty: number;
  image?: string;
  // TODO: Add these fields to database schema
  // specification_summary?: string
  // engraving?: string
}

export interface AddressInsertData {
  order_id: string;
  first_name: string;
  last_name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
}
