import inventory from './catalog/inventory.json';
import {featuredProducts,unpackProduct,type RawProduct} from './homeData';
export * from './homeData';
export const products=[...featuredProducts,...(inventory as RawProduct[]).map((r,i)=>unpackProduct(r,i+featuredProducts.length))];
