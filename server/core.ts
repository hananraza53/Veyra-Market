import { MongoClient, type Document } from 'mongodb';
import type { Request, Response, NextFunction } from 'express';
import { createHash, createHmac, randomBytes } from 'node:crypto';

export class Problem extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function fail(status:number, message:string):never { throw new Problem(status,message); }
export const clean=(v:unknown,n=250)=> typeof v==='string'?v.trim().slice(0,n):'';
export const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export const secret=()=>process.env.APP_SECRET || fail(503,'Set APP_SECRET to enable authentication.');
export const sign=(v:string)=>createHmac('sha256',secret()).update(v).digest('hex');
export const id=()=>randomBytes(12).toString('hex');
type Row=Document & {_id:string};
let pending: Promise<MongoClient>|undefined;
export async function db(){
  if(!process.env.MONGODB_URI) fail(503,'The marketplace database has not been connected.');
  if(!pending){
    const client=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:8,serverSelectionTimeoutMS:6000});
    pending=client.connect().then(async c=>{
      const database=c.db(process.env.MONGODB_DB||'veyra');
      await Promise.all(['limits','challenges','sessions'].map(k=>database.collection(k).createIndex({expiresAt:1},{expireAfterSeconds:0})));
      await database.collection('orders').createIndex({owner:1,createdAt:-1});
      return c;
    }).catch(async()=>{pending=undefined;await client.close();return fail(503,'Database connection unavailable.');});
  }
  return (await pending).db(process.env.MONGODB_DB||'veyra');
}
export const table=async(k:string)=>(await db()).collection<Row>(k);
export async function transaction<T>(fn:(s:import('mongodb').ClientSession)=>Promise<T>){
  await db();const s=(await pending!).startSession();
  try{return await s.withTransaction(()=>fn(s));}finally{await s.endSession();}
}
export function cookie(req:Request){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('veyra_sid='))?.slice(10);}
export async function currentUser(req:Request){
  const token=cookie(req);if(!token || !/^[0-9a-f]{64}$/.test(token))return null;
  const sess=await (await table('sessions')).findOne({_id:digest(token),expiresAt:{$gt:new Date()}});
  if(!sess)return null;
  return (await table('users')).findOne({_id:sess.owner,version:sess.version});
}
export async function requireUser(req:Request,roles?:string[]){
  const u=await currentUser(req);if(!u)fail(401,'Please sign in.');
  if(roles&&!roles.includes(u.role))fail(403,'Your account cannot access this page.');
  return u;
}
export function profile(u:Row){return {id:u._id,name:u.name,email:u._id,role:u.role,shopName:u.shopName};}
export const sendError=(e:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(e instanceof Problem)res.status(e.status).json({error:e.message});else if((e as any)?.type==='entity.parse.failed')res.status(400).json({error:'Invalid JSON.'});else res.status(500).json({error:'The request could not be completed.'});};
export async function limit(key:string,max:number,seconds:number){
  const now=Date.now(),bucket=Math.floor(now/(seconds*1000));
  let rec;
  try{rec=await (await table('limits')).findOneAndUpdate({_id:digest(key+':'+bucket)},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+1)*seconds*1000)}},{upsert:true,returnDocument:'after'});}catch(e){if((e as any)?.code===11000)fail(429,'Please try again later.');throw e;}
  if((rec?.count||0)>max)fail(429,'Too many attempts. Please try again later.');
}
