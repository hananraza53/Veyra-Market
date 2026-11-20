import express from 'express';
import {clean,fail,sendError,table} from './core.js';
import auth from './auth.js';
import orders from './orders.js';
import operations from './operations.js';
import assistant from './assistant.js';
import management from './management.js';
import {catalog,catalogChanges} from './catalog.js';
const app=express(), api=express.Router();
app.disable('x-powered-by');
if(process.env.VERCEL)app.set('trust proxy',1);
app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next();});
app.use('/api',(req,_res,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const origin=req.get('origin');const expected=process.env.APP_ORIGIN;
   if(origin){let valid=false;try{valid=expected?new URL(origin).origin===expected:new URL(origin).host===req.get('host');}catch{}if(!valid)fail(403,'This request originated outside the marketplace.');}
   if(req.headers['sec-fetch-site']==='cross-site')fail(403,'This request originated outside the marketplace.');
   if(!req.is('application/json'))fail(415,'Send JSON with this request.');
 }
 next();
});
app.use(express.json({limit:'40kb'}));
api.get('/health',(_req,res)=>res.json({ok:true,databaseConfigured:!!process.env.MONGODB_URI,mailConfigured:!!process.env.SMTP_HOST,assistantConfigured:!!(process.env.AI_API_KEY||process.env.OPENAI_API_KEY)}));
api.get('/catalog/updates',async(_req,res)=>res.json(await catalogChanges()));
api.get('/catalog',async(req,res)=>{
 let data=await catalog();const q=clean(req.query.q).toLowerCase(),category=clean(req.query.category),department=clean(req.query.department);
 if(q)data=data.filter(p=>[p.name,p.brand,p.category,p.department].join(' ').toLowerCase().includes(q));
 if(category)data=data.filter(p=>p.category===category);
 if(department)data=data.filter(p=>p.department===department);
 const page=Math.max(1,Math.floor(Number(req.query.page)||1)),limit=Math.max(1,Math.min(100,Math.floor(Number(req.query.limit)||48)));
 res.json({total:data.length,page,products:data.slice((page-1)*limit,page*limit).map(p=>({id:p.id,name:p.name,brand:p.brand,price:p.price,department:p.department,category:p.category,image:p.image,stock:p.stock,seller:p.seller,variants:p.variants}))});
});
api.use(auth,orders,operations,management,assistant);
app.use('/api',api);
app.use('/api',(_req,res)=>res.status(404).json({error:'Unknown marketplace endpoint.'}));
app.use(sendError);
export default app;
