import {Router} from 'express';
import {clean,fail,requireUser,table,transaction,id,limit,digest} from './core.js';
import {baseline,builtInVouchers,product} from './catalog.js';
const routes=Router();
const view=(r:any)=>{const {_id,...rest}=r;return {id:_id,...rest};};
routes.post('/seller/apply',async(req,res)=>{
 const u=await requireUser(req),shopName=clean(req.body.shopName,70),description=clean(req.body.description,900);
 if(shopName.length<3||!description)fail(400,'Enter a shop name and description.');
 if(u.role!=='buyer')fail(409,'Your account already has marketplace access.');
 if(baseline.some(p=>String(p.seller).toLowerCase()===shopName.toLowerCase()))fail(409,'Choose a unique shop name.');
 const apps=await table('applications');
 const previous=await apps.findOne({_id:u._id});if(previous?.status==='pending')fail(409,'Application already submitted.');
 await apps.updateOne({_id:u._id},{$set:{shopName,description,status:'pending',createdAt:new Date()}},{upsert:true});
 res.json({application:view(await apps.findOne({_id:u._id}))});
});
routes.get('/admin/applications',async(req,res)=>{await requireUser(req,['admin']);res.json({applications:(await (await table('applications')).find().sort({createdAt:-1}).limit(200).toArray()).map(view)});});
routes.patch('/admin/applications/:id',async(req,res)=>{
 await requireUser(req,['admin']);const key=clean(req.params.id),status=clean(req.body.status);
 if(!['approved','rejected'].includes(status))fail(400,'Choose an application decision.');
 const apps=await table('applications'),users=await table('users'),shops=await table('shops');
 try{const application=await transaction(async session=>{
  const saved=await apps.findOneAndUpdate({_id:key,status:'pending'},{$set:{status}},{session,returnDocument:'after'});
  if(!saved)fail(409,'No pending application exists.');
  if(status==='approved'){await shops.insertOne({_id:saved.shopName.toLowerCase(),owner:key},{session});await users.updateOne({_id:key},{$set:{shopName:saved.shopName,role:'seller'}},{session});}
  return saved;
 });res.json({application:view(application)});}catch(e){if((e as any)?.code===11000)fail(409,'Shop name is already registered.');throw e;}
});
routes.get('/seller/listings',async(req,res)=>{const u=await requireUser(req,['seller','admin']);res.json({listings:(await (await table('listings')).find({owner:u._id}).sort({createdAt:-1}).limit(500).toArray()).map(view)});});
function integer(v:unknown,max:number){const value=Number(v);if(!Number.isSafeInteger(value)||value<0||value>max)fail(400,'Enter a valid non-negative number.');return value;}
routes.post('/seller/listings',async(req,res)=>{
 const u=await requireUser(req,['seller','admin']);
 if(!u.shopName)fail(400,'An approved shop is required.');
 const name=clean(req.body.name,150),brand=clean(req.body.brand,80),category=clean(req.body.category,100),department=clean(req.body.department,100),image=clean(req.body.image,1200);
 if(!name||!category||!department||!brand||!/^https:\/\/[^\s]+$/i.test(image))fail(400,'Enter product details and an HTTPS image URL.');
 const listing={_id:'shop-'+id(),name,brand,category,department,image,price:integer(req.body.price,100000000),stock:integer(req.body.stock,1000000),description:clean(req.body.description,1800),seller:u.shopName,owner:u._id,createdAt:new Date(),active:true};
 await (await table('listings')).insertOne(listing);res.status(201).json({listing:view(listing)});
});
routes.patch('/seller/listings/:id',async(req,res)=>{const u=await requireUser(req,['seller','admin']);const set:Record<string,number>={};if(req.body.price!==undefined)set.price=integer(req.body.price,100000000);if(req.body.stock!==undefined)set.stock=integer(req.body.stock,1000000);if(!Object.keys(set).length)fail(400,'Supply a price or stock change.');const listing=await (await table('listings')).findOneAndUpdate({_id:clean(req.params.id),owner:u._id},{$set:set},{returnDocument:'after'});if(!listing)fail(404,'Listing not found.');res.json({listing:view(listing)});});
routes.get('/manage/vouchers',async(_req,res)=>{const custom=process.env.MONGODB_URI?await (await table('vouchers')).find({active:true}).limit(100).toArray():[];res.json({vouchers:[...builtInVouchers,...custom.map(view)]});});
routes.post('/manage/vouchers',async(req,res)=>{await requireUser(req,['admin']);const code=clean(req.body.code,30).toUpperCase(),percent=integer(req.body.percent,75);if(!/^[A-Z0-9-]{3,25}$/.test(code)||percent<1||builtInVouchers.some(v=>v.code===code))fail(400,'Choose a unique code and a discount from 1 to 75 percent.');await (await table('vouchers')).updateOne({_id:code},{$set:{code,percent,active:true}},{upsert:true});res.json({voucher:{code,percent,active:true}});});
routes.get('/support',async(req,res)=>{const u=await requireUser(req);res.json({tickets:(await (await table('tickets')).find(u.role==='admin'?{}:{owner:u._id}).sort({createdAt:-1}).limit(200).toArray()).map(view)});});
routes.post('/support',async(req,res)=>{const u=await requireUser(req),subject=clean(req.body.subject,150),message=clean(req.body.message,3000);if(!subject||!message)fail(400,'Add a subject and message.');await limit('support:'+u._id,10,3600);const ticket={_id:'T-'+id(),subject,owner:u._id,status:'Open',createdAt:new Date(),messages:[{author:u.name,message,at:new Date()}]};await (await table('tickets')).insertOne(ticket);res.status(201).json({ticket:view(ticket)});});
routes.post('/support/:id/replies',async(req,res)=>{const u=await requireUser(req),message=clean(req.body.message,3000);if(!message)fail(400,'Enter a reply.');const ticket=await (await table('tickets')).findOneAndUpdate({_id:clean(req.params.id),...(u.role==='admin'?{}:{owner:u._id})},{$push:{messages:{author:u.name,message,at:new Date()}}} as any,{returnDocument:'after'});if(!ticket)fail(404,'Ticket not found.');res.json({ticket:view(ticket)});});

routes.get('/account/reviews',async(req,res)=>{
 const u=await requireUser(req);
 const rows=await (await table('reviews')).find({owner:u._id},{projection:{owner:0}}).sort({createdAt:-1}).limit(100).toArray();
 res.json({reviews:rows.map(view)});
});
routes.get('/products/:id/reviews',async(req,res)=>{
 const rows=await (await table('reviews')).find({productId:clean(req.params.id)},{projection:{owner:0}}).sort({createdAt:-1}).limit(100).toArray();
 res.json({reviews:rows.map(view)});
});
routes.post('/products/:id/reviews',async(req,res)=>{
 const u=await requireUser(req),productId=clean(req.params.id),rating=Number(req.body.rating),message=clean(req.body.message,1200);
 if(!Number.isInteger(rating)||rating<1||rating>5||!message)fail(400,'Enter a rating and review.');
 const order=await (await table('orders')).findOne({owner:u._id,'items.productId':productId});
 if(!order)fail(403,'Reviews are available for purchased products.');
 const item=order.items.find((p:any)=>p.productId===productId),review={productId,name:item.name,productName:item.name,author:u.name,rating,message,createdAt:new Date()};
 const reviews=await table('reviews'),key=digest(u._id+':'+productId);
 await reviews.updateOne({_id:key},{$set:{...review,owner:u._id}},{upsert:true});
 res.json({review:{...review,id:key}});
});
routes.get('/products/:id/questions',async(req,res)=>{
 const rows=await (await table('questions')).find({productId:clean(req.params.id)},{projection:{owner:0}}).sort({createdAt:-1}).limit(100).toArray();res.json({questions:rows.map(view)});
});
routes.post('/products/:id/questions',async(req,res)=>{
 const u=await requireUser(req),productId=clean(req.params.id),message=clean(req.body.message,800);
 if(!message||!await product(productId))fail(400,'Choose a product and enter your question.');
 await limit('questions:'+u._id,15,3600);const row={_id:id(),productId,author:u.name,message,createdAt:new Date()};
 await (await table('questions')).insertOne({...row,owner:u._id});res.json({question:view(row)});
});
export default routes;
