import inventory from './catalog/inventory.json' with { type: 'json' };
import { featuredProducts, unpackProduct, type RawProduct } from './homeData.js';

export * from './homeData.js';

export const products = [
  ...featuredProducts,
  ...(inventory as RawProduct[]).map((r, i) =>
    unpackProduct(r, i + featuredProducts.length)
  )
];