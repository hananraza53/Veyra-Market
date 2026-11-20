import {products as seed} from '../src/catalogData.js';
import {table} from './core.js';
export interface Variant { id:string; label:string; price:number;stock:number;attributes?:Record<string,unknown> }
export interface Item {id:string;name:string;brand:string;category:string;department:string;price:number;stock:number;image:string;seller:string;description?:string;variants?:Variant[]}
export const baseline=seed as unknown as Item[];
const byId=new Map(baseline.map(p=>[String(p.id),p]));
export async function product(id:string):Promise<Item|undefined>{
  const custom=await (await table('listings')).findOne({_id:id,active:{$ne:false}});
  if(custom)return {...custom,id:custom._id} as unknown as Item;
  return byId.get(id);
}
export async function catalog(){
  if(!process.env.MONGODB_URI)return baseline;
  const {stocks,listings}=await catalogChanges();
  const changed=new Map(stocks.map(s=>[s.productId+':'+s.variantId,s.stock]));
  const items=baseline.map(p=>{const variants=p.variants?.map(v=>({...v,stock:changed.get(p.id+':'+v.id)??v.stock}));return {...p,variants,stock:variants?.reduce((n,v)=>n+v.stock,0)??p.stock};});
  return [...items,...listings];
}
export const builtInVouchers=[{code:'WELCOME10',percent:10},{code:'EDIT15',percent:15},{code:'FREESHIP',percent:0}];
export const policies={
 'Shipping & delivery':'Orders are grouped by seller and tracked as separate shipments. Standard delivery costs PKR 250 per order and is free for subtotals of PKR 5,000 or more. Individual delivery dates are available only when provided by a seller.',
 'Payment methods':'The portfolio marketplace supports demonstration cash-on-delivery orders.',
 'Returns':'Signed-in buyers can submit an item-level return request. Approval and refund status appear under Returns.',
 'Privacy':'Account and order data is used to operate the marketplace. Private order information is visible to its buyer and authorized fulfillment staff.',
 'Discount codes':'WELCOME10 gives 10% off, EDIT15 gives 15% off, and FREESHIP waives standard delivery. One code per order.'
};

export async function catalogChanges(){
  if(!process.env.MONGODB_URI)return {listings:[] as Item[],stocks:[] as {productId:string;variantId:string;stock:number}[]};
  const [custom,inventory]=await Promise.all([
    (await table('listings')).find({active:true},{projection:{owner:0}}).toArray(),
    (await table('inventory')).find({}).toArray()
  ]);
  return {listings:custom.map(p=>({...p,id:p._id}) as unknown as Item),stocks:inventory.map(p=>({productId:String(p.productId),variantId:String(p.variantId),stock:Number(p.stock)}))};
}
