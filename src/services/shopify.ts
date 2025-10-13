import { ShopifyOrder, ShopifyProduct } from "../types";

export class ShopifyService {
  constructor(
    private storeDomain: string,
    private apiVersion: string,
    private accessToken: string
  ) {}

  async fetchOrder(orderId: string): Promise<ShopifyOrder> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/orders/${orderId}.json`;

    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`Fetch order failed: ${res.status}`);

    const json = (await res.json()) as { order?: ShopifyOrder };
    return json.order as ShopifyOrder;
  }

  async updateOrderTags(orderId: string, tags: string[]): Promise<void> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/orders/${orderId}.json`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order: {
          id: orderId,
          tags: tags.join(", "),
        },
      }),
    });

    if (!res.ok)
      throw new Error(
        `Update order tags failed: ${res.status} ${res.statusText}`
      );
  }

  async retagOrder(
    orderId: string,
    importTag: string,
    processedTag: string
  ): Promise<void> {
    try {
      // Fetch existing tags
      const order = await this.fetchOrder(orderId);
      const tags: string[] = (order.tags || "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
      const newTags = Array.from(
        new Set(
          tags
            .filter((t) => t.toLowerCase() !== importTag.toLowerCase())
            .concat([processedTag])
        )
      );

      console.log(`Retagging order ${orderId}:`, {
        originalTags: order.tags,
        importTag,
        processedTag,
        newTags,
      });

      await this.updateOrderTags(orderId, newTags);
    } catch (error) {
      console.error(`Error in retagOrder for ${orderId}:`, error);
      throw error;
    }
  }

  async fetchProduct(productId: number): Promise<ShopifyProduct> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/products/${productId}.json`;

    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`Fetch product failed: ${res.status}`);

    const json = (await res.json()) as { product?: ShopifyProduct };
    return json.product as ShopifyProduct;
  }

  async getProductImageUrl(lineItem: any): Promise<string | null> {
    try {
      // Get product with variants to find the right image
      if (lineItem.product_id) {
        const product = await this.fetchProduct(lineItem.product_id);
        
        if (product.images && product.images.length > 0) {
          // If we have a variant_id, try to find the variant-specific image
          if (lineItem.variant_id && product.variants) {
            const variant = product.variants.find((v: any) => v.id === lineItem.variant_id);
            if (variant && variant.image_id) {
              // Find the image that matches this variant's image_id
              const variantImage = product.images.find((img: any) => img.id === variant.image_id);
              if (variantImage) {
                return variantImage.src;
              }
            }
          }
          
          // Fallback to first product image
          return product.images[0].src;
        }
      }

      return null;
    } catch (error) {
      console.warn(
        `Failed to fetch image for line item ${lineItem.id}:`,
        error
      );
      return null;
    }
  }

  async getVariantDetails(lineItem: any): Promise<{metalType?: string, size?: string, specifications?: string}> {
    try {
      if (lineItem.product_id && lineItem.variant_id) {
        const product = await this.fetchProduct(lineItem.product_id);
        
        if (product.variants) {
          const variant = product.variants.find((v: any) => v.id === lineItem.variant_id);
          if (variant) {
            // Extract metal type from variant title (e.g., "14KT Yellow Gold")
            const metalType = this.extractMetalTypeFromVariant(variant);
            
            // Get the full variant specifications (e.g., "14KT Yellow Gold / 2.60CT Total / G-H / VS1-VS2 (Our Premium)")
            const specifications = variant.title || '';
            
            return {
              metalType: metalType || undefined,
              size: undefined, // Size comes from line item properties
              specifications: specifications || undefined
            };
          }
        }
      }

      return {};
    } catch (error) {
      console.warn(
        `Failed to fetch variant details for line item ${lineItem.id}:`,
        error
      );
      return {};
    }
  }

  private extractMetalTypeFromVariant(variant: any): string | null {
    // Look for metal type patterns in variant title
    const title = variant.title || '';
    
    // Common metal type patterns
    const metalPatterns = [
      /(\d+KT\s+(?:Yellow|White|Rose|Platinum)\s+Gold)/i,
      /(\d+KT\s+Gold)/i,
      /(Yellow\s+Gold)/i,
      /(White\s+Gold)/i,
      /(Rose\s+Gold)/i,
      /(Platinum)/i,
      /(Sterling\s+Silver)/i,
      /(Silver)/i
    ];

    for (const pattern of metalPatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

}
