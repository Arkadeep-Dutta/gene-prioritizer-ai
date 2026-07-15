import registry from "../../platform/products/registry.json";
import { LOGRES_BRAND } from "./brand";
export type PlatformProduct = (typeof registry.products)[number];
export function getRegisteredProducts(): PlatformProduct[] {
  return registry.products;
}
export function getGenemedProduct(): PlatformProduct {
  const product = registry.products.find(
    (item) => item.product_id === LOGRES_BRAND.primaryProductId,
  );
  if (!product) throw new Error("Genemed product registration is missing.");
  return product;
}
export function assertClinicalUseBlocked(): void {
  for (const product of registry.products) {
    if (product.clinical_use_status !== "blocked")
      throw new Error(product.product_id + " must keep clinical use blocked.");
  }
}
