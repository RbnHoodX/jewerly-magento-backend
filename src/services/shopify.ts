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
      // First try to get variant-specific image if variant_id exists
      if (lineItem.variant_id) {
        const variant = await this.fetchVariant(lineItem.variant_id);
        if (variant && variant.image_id) {
          // Get the specific image for this variant
          const image = await this.fetchImage(variant.image_id);
          if (image) {
            return image.src;
          }
        }
      }

      // Fallback to product images if no variant-specific image
      if (lineItem.product_id) {
        const product = await this.fetchProduct(lineItem.product_id);
        if (product.images && product.images.length > 0) {
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

  private async fetchVariant(variantId: number): Promise<any> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/variants/${variantId}.json`;
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch variant: ${res.status} ${res.statusText}`
      );
    }

    const json = await res.json();
    return json.variant;
  }

  private async fetchImage(imageId: number): Promise<any> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/images/${imageId}.json`;
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    return json.image;
  }
}
