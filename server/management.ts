import {Router} from 'express'
import {clean,fail,requireUser,table,id,transaction} from './core.js'

const routes=Router()
const partitions={categories:'customCategories',brands:'customBrands',campaigns:'campaigns',content:'pageIntroductions'} as const
const publicSections=new Set(['about','terms','privacy','payments','returns','shipping','testimonials','cookies'])
function partition(raw:unknown){
  const name=clean(raw,30)
  if(!Object.hasOwn(partitions,name))fail(404,'Unknown management area.')
  return name as keyof typeof partitions
}
routes.get('/market/content',async(_req,res)=>{
 const records=process.env.MONGODB_URI?await (await table(partitions.content)).find({}).limit(50).toArray():[]
 res.json({policies:Object.fromEntries(records.map(r=>[r._id,r.text]))})
})
routes.get('/admin/config/:kind',async(req,res)=>{
  await requireUser(req,['admin'])
  const kind=partition(req.params.kind), records=await (await table(partitions[kind])).find({}).limit(1000).toArray()
  res.json(kind==='content'?{policies:Object.fromEntries(records.map(r=>[r._id,r.text]))}:{[kind]:records.map(({_id,...x})=>({id:_id,...x}))})
})
routes.post('/admin/config/:kind',async(req,res)=>{
 await requireUser(req,['admin'])
 const kind=partition(req.params.kind), collection=await table(partitions[kind])
 if(kind==='content'){
    const page=clean(req.body.page,50),text=clean(req.body.text,1500)
    if(!publicSections.has(page)||!text)fail(400,'Select a published page and enter an introduction.')
    await collection.updateOne({_id:page},{$set:{text}},{upsert:true})
 }else{
    const name=clean(req.body.name,100),attributes=clean(req.body.attributes,500),date=clean(req.body.date,10)
    if(!name)fail(400,'A name is required.')
    if(kind==='categories'&&!attributes)fail(400,'Enter at least one filter attribute.')
    if(kind==='campaigns'&&!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'Enter a start date.')
    try{await collection.insertOne({_id:name.toLowerCase(),name,...(kind==='categories'?{attributes}:kind==='campaigns'?{date}:{}),createdAt:new Date()})}
    catch(e){if((e as any).code===11000)fail(409,'That name already exists.');throw e}
 }
 res.json({ok:true})
})
routes.get('/admin/users',async(req,res)=>{
 await requireUser(req,['admin'])
 const rows=await (await table('users')).find({},{projection:{name:1,email:1,role:1}}).limit(500).toArray()
 res.json({users:rows.map(r=>({id:r._id,name:r.name,email:r.email,role:r.role}))})
})
routes.get('/admin/listings',async(req,res)=>{
 await requireUser(req,['admin'])
 const rows=await (await table('listings')).find({},{projection:{owner:0}}).sort({createdAt:-1}).limit(500).toArray()
 res.json({listings:rows.map(({_id,...r})=>({...r,id:_id,status:r.active?'Published':'Hidden'}))})
})
routes.patch('/admin/listings/:id',async(req,res)=>{
 await requireUser(req,['admin'])
 if(typeof req.body.active!=='boolean')fail(400,'Choose a publication status.')
 const result=await (await table('listings')).updateOne({_id:clean(req.params.id)},{$set:{active:req.body.active}})
 if(!result.matchedCount)fail(404,'Listing not found.')
 res.json({ok:true})
})
routes.get('/seller/shop',async(req,res)=>{
 const u=await requireUser(req,['seller','admin'])
 const shop=await (await table('shops')).findOne({owner:u._id})
 res.json({shop:{name:u.shopName||'',description:shop?.description||''}})
})
routes.patch('/seller/shop',async(req,res)=>{
 const u=await requireUser(req,['seller','admin'])
 const description=clean(req.body.description,1600)
 const result=await (await table('shops')).updateOne({owner:u._id},{$set:{description}})
 if(!result.matchedCount)fail(404,'An approved shop is required.')
 res.json({ok:true})
})
routes.post('/seller/import',async(req,res)=>{
 const user=await requireUser(req,['seller','admin'])
 if(!user.shopName)fail(403,'An approved shop is required.')
 if(!Array.isArray(req.body.rows)||!req.body.rows.length||req.body.rows.length>80)fail(400,'Import between 1 and 80 rows.')
 const listings=req.body.rows.map((r:any,i:number)=>{
    const name=clean(r?.name,150),price=Number(r?.price),stock=Number(r?.stock),category=clean(r?.category,100),brand=clean(r?.brand,80),department=clean(r?.department,100),image=clean(r?.image,1200)
    if(!name||!category||!brand||!department||!/^https:\/\/[^\s]+$/i.test(image)||!Number.isSafeInteger(price)||price<=0||price>100000000||!Number.isSafeInteger(stock)||stock<0||stock>1000000)fail(400,'Review the details on row '+(i+2)+'. Include department and HTTPS image.')
    return {_id:'shop-'+id(),owner:user._id,seller:user.shopName,name,price,stock,category,brand,department,image,active:true,createdAt:new Date()}
 })
 const collection=await table('listings')
 await transaction(async session=>{await collection.insertMany(listings,{session})})
 res.status(201).json({count:listings.length})
})
export default routes
