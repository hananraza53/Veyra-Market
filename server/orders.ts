import {Router} from 'express';
import {clean,currentUser,digest,fail,id,requireUser,sign,table,transaction} from './core.js';
import {builtInVouchers,product} from './catalog.js';
const routes=Router();
export const safeOrder=(o:any)=>{const {_id,owner,trackingHash,requestKey,requestSignature,...fields}=o;return fields;};
const visible=(r:any)=>{const {_id,...v}=r;return {...v,id:_id};};
routes.post('/orders',async(req,res)=>{
 const u=await currentUser(req),data=req.body,source=data.shipping||{};
 const shipping={name:clean(source.name,100),city:clean(source.city,80),address:clean(source.address,240),email:clean(source.email||u?._id,254).toLowerCase(),phone:clean(source.phone,40)};
 if(Object.values(shipping).some(v=>!v)||!/^\S+@[^@\s]+\.[^@\s]+$/.test(shipping.email))fail(400,'Complete the delivery address and email.');
 if(!Array.isArray(data.items)||!data.items.length||data.items.length>80)fail(400,'Your order must contain 1–80 lines.');
 const requestId=clean(data.requestId,120);
 if(requestId.length<12)fail(400,'A valid checkout request ID is required.');
 const fingerprint=digest(JSON.stringify([shipping,data.items,data.coupon||'']));
 const orderKey=digest((u?._id||shipping.email)+':'+requestId),orders=await table('orders');
 const trackingToken=u?undefined:sign('guest:'+orderKey);
 const respond=(o:any)=>{if(o.requestSignature!==fingerprint)fail(409,'This checkout ID belongs to a different order.');res.json({order:safeOrder(o),trackingToken});};
 const existing=await orders.findOne({_id:orderKey});if(existing){respond(existing);return;}
 const rows:{sku:string;productId:string;variantId:string;label:string;name:string;image:string;price:number;quantity:number;seller:string;initialStock:number}[]=[], seen=new Set<string>();
 for(const line of data.items){
  const p=await product(clean(line.productId)),qty=Number(line.quantity);
  if(!p||!Number.isInteger(qty)||qty<1||qty>99)fail(400,'An order item or quantity is invalid.');
  const variant=line.variantId?p.variants?.find(v=>String(v.id)===String(line.variantId)):p.variants?.[0];
  if(line.variantId&&!variant)fail(400,'This product variant is unavailable.');
  const sku=p.id+':'+(variant?.id||'base');if(seen.has(sku))fail(400,'Combine duplicate items in your cart.');seen.add(sku);
  rows.push({sku,productId:p.id,variantId:variant?.id||'',label:variant?.label||'',name:p.name,image:p.image,price:Number(variant?.price??p.price),quantity:qty,seller:p.seller||'Veyra',initialStock:Number(variant?.stock??p.stock)});
 }
 const code=clean(data.coupon,40).toUpperCase(),vouchers=await table('vouchers');
 const voucher=code?(builtInVouchers.find(v=>v.code===code)||await vouchers.findOne({_id:code,active:true})):null;
 if(code&&!voucher)fail(400,'This discount code is invalid.');
 const subtotal=rows.reduce((n,i)=>n+i.price*i.quantity,0);
 const discount=Math.round(subtotal*(voucher?.percent||0)/100),shippingFee=subtotal>=5000||code==='FREESHIP'?0:250;
 const createdAt=new Date(),status='Confirmed';
 const items=rows.map(({sku,initialStock,...row})=>row);
 const order={_id:orderKey,id:'VR-'+id().toUpperCase(),owner:u?._id||null,trackingHash:trackingToken?digest(trackingToken):null,requestSignature:fingerprint,items,shipping,coupon:code,subtotal,discount,shippingFee,total:subtotal-discount+shippingFee,createdAt,shipments:[...new Set(rows.map(i=>i.seller))].map(seller=>({seller,status,events:[{status,at:createdAt}]}))};
 const inventory=await table('inventory'),listings=await table('listings');
 try{
 const stored=await transaction(async session=>{
  const duplicate=await orders.findOne({_id:orderKey},{session});if(duplicate)return duplicate;
  for(const r of rows){
   if(r.productId.startsWith('shop-')){
    const saved=await listings.updateOne({_id:r.productId,stock:{$gte:r.quantity},price:r.price,active:true},{$inc:{stock:-r.quantity}},{session});
    if(!saved.modifiedCount)fail(409,r.name+' stock or price has changed.');
   }else{
    await inventory.updateOne({_id:r.sku},{$setOnInsert:{stock:r.initialStock,productId:r.productId,variantId:r.variantId}},{upsert:true,session});
    const saved=await inventory.updateOne({_id:r.sku,stock:{$gte:r.quantity}},{$inc:{stock:-r.quantity}},{session});
    if(!saved.modifiedCount)fail(409,r.name+' has insufficient stock.');
   }
  }
  await orders.insertOne(order,{session});return order;
 });
 respond(stored);
 }catch(e){if((e as any)?.code===11000){const o=await orders.findOne({_id:orderKey});if(o){respond(o);return;}}throw e;}
});
routes.get('/orders',async(req,res)=>{const u=await requireUser(req);res.json({orders:(await (await table('orders')).find({owner:u._id}).sort({createdAt:-1}).limit(200).toArray()).map(safeOrder)});});
routes.get('/orders/:id',async(req,res)=>{const u=await currentUser(req),token=clean(req.query.token,128);const o=await (await table('orders')).findOne({id:clean(req.params.id)});if(!o||!(u&&o.owner===u._id||token&&o.trackingHash===digest(token)||u?.role==='admin'))fail(404,'Order not found.');res.json({order:safeOrder(o)});});
routes.get('/seller/orders',async(req,res)=>{const u=await requireUser(req,['seller','admin']);const shop=u.shopName;if(!shop){res.json({orders:[]});return;}const found=await (await table('orders')).find({'shipments.seller':shop}).sort({createdAt:-1}).limit(200).toArray();res.json({orders:found.map(o=>{const items=o.items.filter((x:any)=>x.seller===shop);return {id:o.id,createdAt:o.createdAt,shipping:o.shipping,items,total:items.reduce((n:number,x:any)=>n+x.price*x.quantity,0),shipments:o.shipments.filter((x:any)=>x.seller===shop)};})});});
routes.patch('/seller/orders/:id',async(req,res)=>{const u=await requireUser(req,['seller','admin']),seller=u.role==='admin'?clean(req.body.seller):u.shopName,status=clean(req.body.status);const prior:Record<string,string>={Packed:'Confirmed',Dispatched:'Packed',Delivered:'Dispatched'};if(!seller||!prior[status])fail(400,'Invalid fulfillment update.');const saved=await (await table('orders')).updateOne({id:clean(req.params.id),shipments:{$elemMatch:{seller,status:prior[status]}}},{$set:{'shipments.$.status':status},$push:{'shipments.$.events':{status,at:new Date()}}} as any);if(!saved.modifiedCount)fail(409,'The shipment is unavailable or its status has changed.');res.json({ok:true});});
routes.get('/admin/orders',async(req,res)=>{await requireUser(req,['admin']);res.json({orders:(await (await table('orders')).find().sort({createdAt:-1}).limit(300).toArray()).map(safeOrder)});});
routes.get('/manage/returns',async(req,res)=>{const u=await requireUser(req);res.json({returns:(await (await table('returns')).find(u.role==='admin'?{}:{owner:u._id}).sort({createdAt:-1}).limit(200).toArray()).map(visible)});});
routes.post('/manage/returns',async(req,res)=>{const u=await requireUser(req),orderId=clean(req.body.orderId),productId=clean(req.body.productId),reason=clean(req.body.reason,1200);if(!reason)fail(400,'Enter the reason for returning this item.');const order=await (await table('orders')).findOne({id:orderId,owner:u._id,'items.productId':productId});if(!order)fail(404,'Order item not found.');const key=digest(orderId+':'+productId);const item=await (await table('returns')).findOneAndUpdate({_id:key},{$setOnInsert:{orderId,productId,owner:u._id,reason,status:'Requested',createdAt:new Date()}},{upsert:true,returnDocument:'after'});res.json({return:visible(item)});});
routes.patch('/manage/returns/:id',async(req,res)=>{await requireUser(req,['admin']);const status=clean(req.body.status);if(!['Approved','Declined','Received','Refunded'].includes(status))fail(400,'Invalid return status.');const r=await (await table('returns')).findOneAndUpdate({_id:clean(req.params.id)},{$set:{status}},{returnDocument:'after'});if(!r)fail(404,'Return not found.');res.json({return:visible(r)});});
export default routes;
