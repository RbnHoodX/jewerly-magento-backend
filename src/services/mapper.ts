import { ShopifyOrder } from "../types";
import {
  CustomerUpsertData,
  OrderInsertData,
  OrderItemInsertData,
  AddressInsertData,
  Address,
} from "../types";

export class DataMapper {
  // Convert UTC date to EST datetime string (YYYY-MM-DD HH:MM:SS)
  private static convertToESTDateTime(utcDateString: string): string {
    const date = new Date(utcDateString);
    // Convert to EST and format as YYYY-MM-DD HH:MM:SS
    const estDate = new Date(
      date.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    return estDate.toISOString().replace("T", " ").split(".")[0];
  }

  static mapShopifyToCustomerData(order: ShopifyOrder): CustomerUpsertData {
    const email = order?.email || order?.customer?.email;
    const customer = order?.customer;

    return {
      email: email || "",
      name: customer
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
        : undefined,
      first_name: customer?.first_name ?? undefined,
      last_name: customer?.last_name ?? undefined,
      phone: customer?.phone ?? order?.phone ?? undefined,
      billing_addr: order.billing_address
        ? this.mapShopifyAddress(order.billing_address)
        : undefined,
      shipping_addr: order.shipping_address
        ? this.mapShopifyAddress(order.shipping_address)
        : undefined,
    };
  }

  static mapShopifyToOrderData(order: ShopifyOrder): OrderInsertData {
    // Extract shipping service and cost from fulfillments
    const shippingInfo = this.extractShippingInfo(order);

    // Calculate total discount amount
    const totalDiscount =
      order.discount_codes?.reduce((sum, discount) => {
        const amount = parseFloat(discount.amount || "0");
        return sum + amount;
      }, 0) || 0;

    // Get shipping cost
    const shippingCost = Number(order.total_shipping || 0);

    return {
      purchase_from: "primestyle",
      order_date: order.created_at
        ? DataMapper.convertToESTDateTime(String(order.created_at))
        : undefined,
      total_amount: Number(order.current_total_price ?? 0),
      discount_amount: totalDiscount,
      discount_codes: order.discount_codes || [],
      shipping_cost: shippingCost,
      bill_to_name: this.extractName(
        order.billing_address,
        order.customer,
        order.email
      ),
      ship_to_name: this.extractName(
        order.shipping_address,
        order.customer,
        order.email
      ),
      delivery_method: shippingInfo.service || "Standard Shipping",
      shopify_order_number: order.name, // Shopify order number (e.g., #1001, #1002)
      // Only include fields that exist in the database schema
      // notes: order.note || null, // TODO: Add this field to database schema
      // shipping_service: shippingInfo.service || null, // TODO: Add this field to database schema
      // shipping_cost: shippingInfo.cost || null, // TODO: Add this field to database schema
    };
  }

  static mapShopifyToOrderItems(
    order: ShopifyOrder,
    imageUrls?: Map<number, string>,
    orderId?: string
  ): OrderItemInsertData[] {
    const items = order.line_items ?? [];
    return items.map((li) => {
      // Extract properties from line item
      const properties = li.properties || [];
      const ringSize = this.extractProperty(properties, [
        "ring size",
        "size",
        "ring_size",
      ]);
      const engraving = this.extractProperty(properties, [
        "engraving",
        "personalization",
        "text",
      ]);
      const metalType = this.extractProperty(properties, [
        "metal",
        "metal type",
        "metal_type",
      ]);

      // Create specification summary from properties
      const specSummary = properties
        .map((prop) => `${prop.name}: ${prop.value}`)
        .join(", ");

      // Get image URL for this line item
      const imageUrl = imageUrls?.get(li.id) || null;

      return {
        order_id: orderId || "", // Add required order_id field
        sku: li.sku || li.variant_id?.toString() || li.id.toString(),
        details: li.title ?? undefined,
        price: Number(li.price ?? 0),
        qty: Number(li.quantity ?? 1),
        size: ringSize || undefined,
        metal_type: metalType || undefined,
        image: imageUrl || undefined,
        // Only include fields that exist in the database schema
        // specification_summary: specSummary || null, // TODO: Add this field to database schema
        // engraving: engraving || null, // TODO: Add this field to database schema
      };
    });
  }

  static mapShopifyToBillingAddress(
    order: ShopifyOrder,
    orderId?: string
  ): AddressInsertData | undefined {
    if (!order.billing_address) return undefined;

    const b = order.billing_address;
    return {
      order_id: orderId || "",
      first_name: b.first_name || "",
      last_name: b.last_name || "",
      company: b.company || undefined,
      street1: b.address1 || "",
      street2: b.address2 || undefined,
      city: b.city || "",
      region: b.province || "",
      postcode: b.zip || "",
      country: b.country || "",
      phone: b.phone || undefined,
      email: order.email || undefined,
    };
  }

  static mapShopifyToShippingAddress(
    order: ShopifyOrder,
    orderId?: string
  ): AddressInsertData | undefined {
    if (!order.shipping_address) return undefined;

    const s = order.shipping_address;
    return {
      order_id: orderId || "",
      first_name: s.first_name || "",
      last_name: s.last_name || "",
      company: s.company || undefined,
      street1: s.address1 || "",
      street2: s.address2 || undefined,
      city: s.city || "",
      region: s.province || "",
      postcode: s.zip || "",
      country: s.country || "",
      phone: s.phone || undefined,
      email: order.email || undefined,
    };
  }

  private static mapShopifyAddress(address: any): Address {
    return {
      first_name: address.first_name,
      last_name: address.last_name,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      province: address.province,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
    };
  }

  private static extractName(
    address: any,
    customer: any,
    email: string | undefined
  ): string | undefined {
    // Try address first
    if (address?.first_name || address?.last_name) {
      return (
        `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim() ||
        undefined
      );
    }

    // Fallback to customer
    if (customer?.first_name || customer?.last_name) {
      return (
        `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
        undefined
      );
    }

    // Last resort: email
    return email || undefined;
  }

  private static extractProperty(
    properties: Array<{ name: string; value: string }>,
    possibleNames: string[]
  ): string | null {
    for (const prop of properties) {
      const propName = prop.name.toLowerCase().trim();
      for (const possibleName of possibleNames) {
        if (propName === possibleName.toLowerCase().trim()) {
          return prop.value;
        }
      }
    }
    return null;
  }

  private static extractShippingInfo(order: ShopifyOrder): {
    service: string | undefined;
    cost: number | undefined;
  } {
    const fulfillments = order.fulfillments || [];

    if (fulfillments.length === 0) {
      return { service: undefined, cost: undefined };
    }

    // Get the first fulfillment (most recent)
    const fulfillment = fulfillments[0];
    const service = fulfillment.service || undefined;

    // Calculate shipping cost from order totals
    // If total_shipping is 0, it's free shipping
    // If it's 29.99, it's overnight upgrade
    const totalShipping = Number(order.total_shipping || 0);
    const cost = totalShipping > 0 ? totalShipping : undefined;

    return { service, cost };
  }
}
