import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {randomInt,randomBytes} from 'node:crypto';
import nodemailer from 'nodemailer';
import {clean,fail,sign,table,limit,digest,cookie,profile,currentUser,requireUser,id,transaction} from './core.js';
const routes=Router(), rounds=12;
const emailOf=(v:unknown)=>{if(typeof v!=='string'||v.length>254||!/^\S+@[^@\s]+\.[^@\s]+$/.test(v.trim())) fail(400,'Enter a valid email address.');return v.trim().toLowerCase();};
function passwordOf(v:unknown){if(typeof v!=='string'||v.length<10||Buffer.byteLength(v)>72)fail(400,'Choose a password of at least 10 characters and up to 72 bytes.');return v;}
function mailer(){
  const {SMTP_HOST,SMTP_USER,SMTP_PASS,MAIL_FROM}=process.env;
  if(!SMTP_HOST||!SMTP_USER||!SMTP_PASS||!MAIL_FROM)fail(503,'Email delivery is not configured yet.');
  return nodemailer.createTransport({host:SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',requireTLS:process.env.SMTP_PORT!=='465',auth:{user:SMTP_USER,pass:SMTP_PASS},connectionTimeout:8000,socketTimeout:12000});
}
async function issue(email:string,purpose:string,payload:object){
  const smtp=mailer(), code=randomInt(0,1000000).toString().padStart(6,'0'), key=purpose+':'+email;
  const challenge=sign(key+':'+code);
  const challenges=await table('challenges');
  await challenges.updateOne({_id:key},{$set:{challenge,attempts:0,expiresAt:new Date(Date.now()+600000),...payload}},{upsert:true});
  try{await smtp.sendMail({from:process.env.MAIL_FROM,to:email,subject:purpose==='verify'?'Verify your Veyra email':'Reset your Veyra password',text:'Your Veyra '+purpose+' code is '+code+'. It expires in 10 minutes. If you did not request it, you can ignore this email.'});}
  catch{await challenges.deleteOne({_id:key,challenge});fail(503,'Email could not be delivered. Please try again.');}
}
const response={message:'If this email is eligible, a verification code has been sent.'};
routes.post(['/auth/register','/auth/resend','/auth/forgot'],async(req,res)=>{
  const email=emailOf(req.body.email);
  const reset=req.path.endsWith('forgot')||req.body.purpose==='reset';
  await limit('mail:'+email,4,900); await limit('mail-ip:'+req.ip,25,900);
  mailer();
  const u=await (await table('users')).findOne({_id:email});
  if(reset){if(u)await issue(email,'reset',{version:u.version});}
  else if(!u){
    if(req.path.endsWith('register')){
      const name=clean(req.body.name,90);if(!name)fail(400,'Enter your name.');
      await issue(email,'verify',{name,passwordHash:await bcrypt.hash(passwordOf(req.body.password),rounds)});
    }else{
      const pending=await (await table('challenges')).findOne({_id:'verify:'+email,expiresAt:{$gt:new Date()}});
      if(pending)await issue(email,'verify',{name:pending.name,passwordHash:pending.passwordHash});
    }
  }
  res.json(response);
});
routes.post(['/auth/verify','/auth/reset'],async(req,res)=>{
  const email=emailOf(req.body.email),reset=req.path.endsWith('reset'),key=(reset?'reset':'verify')+':'+email;
  const code=String(req.body.code||'');if(!/^\d{6}$/.test(code))fail(400,'Enter the six-digit email code.');
  const password=reset?passwordOf(req.body.newPassword??req.body.password):null;
  const challenges=await table('challenges'),users=await table('users');
  const filter={_id:key,expiresAt:{$gt:new Date()},attempts:{$lt:5}};
  const attempt=await challenges.findOneAndUpdate(filter,{$inc:{attempts:1}},{returnDocument:'before'});
  if(!attempt||attempt.challenge!==sign(key+':'+code))fail(400,'This code is invalid or expired.');
  const nextHash=password?await bcrypt.hash(password,rounds):undefined;
  await transaction(async session=>{
    const consumed=await challenges.deleteOne({_id:key,challenge:attempt.challenge,expiresAt:{$gt:new Date()}},{session});
    if(!consumed.deletedCount)fail(400,'This code has already been used.');
    if(reset){const updated=await users.updateOne({_id:email,version:attempt.version},{$set:{passwordHash:nextHash},$inc:{version:1}},{session});if(!updated.matchedCount)fail(400,'Request a fresh reset code.');}
    else await users.updateOne({_id:email},{$setOnInsert:{name:attempt.name,passwordHash:attempt.passwordHash,role:'buyer',version:1,createdAt:new Date()}},{upsert:true,session});
  });
  res.json({message:reset?'Password updated. Please sign in.':'Email verified. Please sign in.'});
});
routes.post('/auth/login',async(req,res)=>{
  const email=emailOf(req.body.email);
  await limit('login:'+email,15,900);await limit('login-ip:'+req.ip,70,900);
  const u=await (await table('users')).findOne({_id:email});
  const pass=typeof req.body.password==='string'?req.body.password:'';
  const ok=await bcrypt.compare(pass,u?.passwordHash||'$2b$12$1K5iZyaMaSOfIX7kB9Gk6OguPtNjqIuvZnZb9BN1y3egQc6mR.ZN.');
  if(!u||!ok||Buffer.byteLength(pass)>72)fail(401,'Email or password is incorrect.');
  const token=randomBytes(32).toString('hex'),duration=7*86400000;
  await (await table('sessions')).insertOne({_id:digest(token),owner:email,version:u.version,expiresAt:new Date(Date.now()+duration)});
  res.cookie('veyra_sid',token,{httpOnly:true,secure:process.env.NODE_ENV==='production'||!!process.env.VERCEL,sameSite:'lax',path:'/',maxAge:duration}).json({user:profile(u)});
});
routes.post('/auth/logout',async(req,res)=>{const t=cookie(req);if(t)await (await table('sessions')).deleteOne({_id:digest(t)});res.clearCookie('veyra_sid',{path:'/'}).json({ok:true});});
routes.get('/auth/me',async(req,res)=>{const u=await currentUser(req);res.json({user:u?profile(u):null});});
routes.patch('/account',async(req,res)=>{const u=await requireUser(req),name=clean(req.body.name,90);if(!name)fail(400,'Enter your name.');await (await table('users')).updateOne({_id:u._id},{$set:{name}});res.json({user:profile({...u,name})});});
routes.get('/account/addresses',async(req,res)=>res.json({addresses:(await requireUser(req)).addresses||[]}));
routes.post('/account/addresses',async(req,res)=>{const u=await requireUser(req);const address={id:id(),name:clean(req.body.name),phone:clean(req.body.phone),address:clean(req.body.address),city:clean(req.body.city)};if(Object.values(address).some(x=>!x))fail(400,'Complete all address fields.');await (await table('users')).updateOne({_id:u._id},{$push:{addresses:{$each:[address],$slice:-30}}} as any);res.json({addresses:(await requireUser(req)).addresses});});
export default routes;
