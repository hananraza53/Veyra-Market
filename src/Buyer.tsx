import React, { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Product } from './catalogData';
import './buyer.css';

type Line = { product: Product; quantity: number };
type BuyerProps = {
  cart: Line[]; wishlist: Product[]; setQuantity: (id: string, quantity: number, variantId?: string) => void;
  add: (product: Product) => void; wish: (product: Product) => void; clearCart: () => void; preview?: boolean
};
type User = { id?: string; email: string; name: string; role?: string };
type Address = { name: string; address: string; phone: string; city: string; email?: string };
type Item = { label?:string; productId: string; variantId?: string; name: string; image: string; price: number; quantity: number; seller: string };
type Shipment = { seller: string; status: string; events: { status: string; at: string }[] };
type Order = { id: string; items: Item[]; total: number; subtotal: number; discount: number; shippingFee: number; shipments: Shipment[]; createdAt: string; shipping?: Address; demo?: boolean };
type ReturnRequest = { id?: string; orderId: string; productId: string; reason: string; status: string };
const money = (value: number) => 'Rs. ' + Math.round(value).toLocaleString('en-PK');
type Voucher = {code:string;percent:number};
const builtInVouchers:Voucher[] = [{code:'WELCOME10',percent:10},{code:'EDIT15',percent:15},{code:'FREESHIP',percent:0}];
function useVouchers(preview:boolean){
  const [list,setList]=useState(builtInVouchers);
  useEffect(()=>{let active=true;
    if(preview){try{const stored=JSON.parse(localStorage.getItem('veyra.workspace.v1')||'{}');setList([...builtInVouchers,...(stored.vouchers||[{code:'STUDIO10',percent:10}])]);}catch{}}
    else api<{vouchers:Voucher[]}>('/manage/vouchers').then(r=>{if(active)setList(r.vouchers)}).catch(()=>{});
    return()=>{active=false}
  },[preview]);return list
}
const fmtDate = (date: string) => new Date(date).toLocaleDateString('en-GB',{ day:'numeric', month:'short', year:'numeric' });
function load<T,>(key:string, fallback:T): T { try { return JSON.parse(localStorage.getItem('veyra-buyer:'+key) || 'null') ?? fallback; } catch { return fallback; } }
function save(key:string,value:unknown){ localStorage.setItem('veyra-buyer:'+key,JSON.stringify(value)); }
function receiptKey(id:string){return 'receipt:'+id}
async function api<T,>(path: string, method='GET', body?:unknown):Promise<T> {
  const res = await fetch('/api'+path,{ method, credentials:'same-origin', headers: body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body):undefined });
  if (!res.headers.get('content-type')?.includes('json')) throw new Error('The marketplace service is unavailable in this preview.');
  const result=await res.json(); if(!res.ok) throw new Error(result.error || 'The request could not be completed. Please try again.');
  return result;
}
function useResource<T,>(key:string,fetcher:()=>Promise<T>, initial:T) {
  const [result,setResult]=useState<{data:T;error:string;busy:boolean}>({data:initial,error:'',busy:true});
  useEffect(()=>{let active=true;setResult({data:initial,error:'',busy:true});fetcher().then(data=>active&&setResult({data,error:'',busy:false})).catch(e=>active&&setResult({data:initial,error:e.message,busy:false}));return()=>{active=false}},[key]);
  return result;
}
function Page({title,children,sub}:{title:string;children:ReactNode;sub?:string}){return <section className="buyer"><nav aria-label="Breadcrumb" className="by-crumb"><Link to="/">Home</Link><span>/</span>{title}</nav><h1>{title}</h1>{sub&&<p className="by-sub">{sub}</p>}{children}</section>}
function Alert({text}:{text:string}) {return text?<p className="by-alert" role="alert">{text}</p>:null}
function Empty({title,desc,link='/',action='Explore the marketplace'}:{title:string;desc:string;link?:string;action?:string}){return <div className="by-empty"><h2>{title}</h2><p>{desc}</p><Link className="by-button" to={link}>{action}</Link></div>}
function Field({label,name,type='text',defaultValue,required=true,autoComplete}:{label:string;name:string;type?:string;defaultValue?:string;required?:boolean;autoComplete?:string}){const pass=['password','confirm'].includes(name);return <label className="by-field">{label}<input key={name} name={name} type={type} autoComplete={autoComplete} defaultValue={defaultValue} required={required} minLength={pass&&autoComplete==='new-password'?10:undefined} maxLength={name==='code'?6:pass?72:250} pattern={name==='code'?'[0-9]{6}':undefined} inputMode={name==='code'?'numeric':undefined}/></label>}
function Submit({busy,children}:{busy:boolean;children:ReactNode}){return <button className="by-button" disabled={busy}>{busy?'Please wait…':children}</button>}
function Auth({page,preview}:{page:string;preview:boolean}) {
  const nav=useNavigate(); const [q]=useSearchParams(); const email=q.get('email')||''; const [error,setError]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const titles:Record<string,string>={login:'Welcome back',register:'Create an account',verify:'Verify your email',forgot:'Forgot your password?',reset:'Set a new password'};
  const descriptions:Record<string,string>={login:'Sign in to track orders and manage your account.',register:'Keep your orders, addresses, and returns in one place.',verify:'Enter the six-digit code from your registration email.',forgot:'Enter the email address you registered with to request a reset code.',reset:'Enter your email code and choose a new password.'};
  async function send(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');setMsg('');
    const values=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;const next=q.get('next')==='/checkout'?'/checkout':'/account';const search='?email='+encodeURIComponent(values.email)+'&next='+encodeURIComponent(next);
    try{
      if(preview)throw new Error('Email and account services are available on the connected MERN deployment. You can explore this preview with guest checkout.');
      if(values.confirm && values.confirm!==values.password)throw new Error('Your passwords must match.');
      if(page==='login'){await api('/auth/login','POST',{email:values.email,password:values.password});window.dispatchEvent(new Event('veyra:session'));nav(next)}
      if(page==='register'){await api('/auth/register','POST',{email:values.email,password:values.password,name:values.name});nav('/verify'+search)}
      if(page==='verify'){await api('/auth/verify','POST',{email:values.email,code:values.code});nav('/login'+search+'&verified=1')}
      if(page==='forgot'){await api('/auth/forgot','POST',{email:values.email});nav('/reset'+search)}
      if(page==='reset'){await api('/auth/reset','POST',{email:values.email,code:values.code,newPassword:values.password});nav('/login'+search+'&reset=1')}
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function resend(form:HTMLFormElement|null){if(!form||busy)return;const contact=String(new FormData(form).get('email')||'');if(!contact||!form.querySelector<HTMLInputElement>('[name=email]')?.reportValidity())return;setBusy(true);setError('');setMsg('');try{if(preview)throw new Error('Email delivery requires a connected marketplace deployment.');await api(page==='verify'?'/auth/resend':'/auth/forgot','POST',{email:contact});setMsg('Check your inbox for a new code.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const ref=useRef<HTMLFormElement>(null);
  return <Page title={titles[page]}><div className="by-auth"><div className="by-auth-heading"><span className="by-mark" aria-hidden="true">V</span><p>{descriptions[page]}</p></div>{preview&&<p className="by-note by-preview-note">This preview supports guest checkout. Email verification and sign-in require the connected marketplace service.</p>}<form ref={ref} onSubmit={send} className="by-form">
    {page==='register'&&<Field name="name" label="Full name" autoComplete="name"/>}<Field name="email" label="Email address" type="email" autoComplete="email" defaultValue={email}/>
    {['verify','reset'].includes(page)&&<Field name="code" label="Verification code" autoComplete="one-time-code"/>}
    {['login','reset','register'].includes(page)&&<Field name="password" label={page==='reset'?'New password':'Password'} type="password" autoComplete={page==='login'?'current-password':'new-password'}/>}
    {['register','reset'].includes(page)&&<Field name="confirm" label="Confirm password" type="password" autoComplete="new-password"/>}
    {page==='login'&&<Link className="by-inline" to="/forgot">Forgot password?</Link>}
    {q.has('verified')&&<p className="by-message">Email verified. Sign in to continue.</p>}{q.has('reset')&&<p className="by-message">Password updated. Sign in with your new password.</p>}
    <Alert text={error}/>{msg&&<p role="status">{msg}</p>}<Submit busy={busy}>{{login:'Sign in',register:'Create account',forgot:'Send reset code',verify:'Verify email',reset:'Update password'}[page]}</Submit>
    {['verify','reset'].includes(page)&&<button type="button" className="by-text" disabled={busy} onClick={()=>resend(ref.current)}>Resend code</button>}
    </form><p className="by-auth-foot">{page==='login'?<>New to Veyra? <Link to={'/register'+(q.get('next')==='/checkout'?'?next=%2Fcheckout':'')}>Create an account</Link></>:<Link to="/login">Return to sign in</Link>}</p></div></Page>
}
function breakdown(cart:Line[],code:string,vouchers:Voucher[]){const subtotal=cart.reduce((t,l)=>t+l.quantity*l.product.price,0);const discount=Math.round(subtotal*(vouchers.find(v=>v.code===code)?.percent||0)/100);const shippingFee=!cart.length||subtotal>=5000||code==='FREESHIP'?0:250;return {subtotal,discount,shippingFee,total:subtotal-discount+shippingFee}}
function Summary({cart,code,submit,children,vouchers}:{cart:Line[];code:string;vouchers:Voucher[];submit?:(code:string)=>void;children?:ReactNode}){
 const totals=breakdown(cart,code,vouchers);const [draft,setDraft]=useState(code),[err,setErr]=useState('');
 return <aside className="by-panel by-summary"><h2>Order summary</h2><dl><div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div><div><dt>Delivery</dt><dd>{totals.shippingFee?money(totals.shippingFee):'Free'}</dd></div>{code&&<div><dt>{code} {submit&&<button aria-label="Remove voucher" className="by-text" onClick={()=>{submit('');setDraft('');setErr('')}}>×</button>}</dt><dd>{totals.discount?'−'+money(totals.discount):'Applied'}</dd></div>}<div className="by-total"><dt>Total</dt><dd>{money(totals.total)}</dd></div></dl>
 {submit&&<form className="by-voucher" onSubmit={e=>{e.preventDefault();const value=draft.trim().toUpperCase();if(vouchers.some(v=>v.code===value)){submit(value);setDraft(value);setErr('')}else setErr('Enter a valid voucher code.')}}><label className="by-field">Voucher code<input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Enter code"/></label><button className="by-quiet">Apply</button></form>}
 <Alert text={err}/>{children}</aside>
}
function Cart({cart,setQuantity,code,onCode,vouchers}:{cart:Line[];vouchers:Voucher[];setQuantity:BuyerProps['setQuantity'];code:string;onCode:(value:string)=>void}){
 return <Page title="Shopping cart" sub={cart.length?cart.reduce((s,l)=>s+l.quantity,0)+' items in your cart':undefined}>{!cart.length?<Empty title="Your cart is empty" desc="Explore the collection and add a few favourites."/>:<div className="by-layout"><div>{Array.from(new Set(cart.map(x=>x.product.seller))).map(s=><section className="by-panel" key={s}><h2>{s}</h2>{cart.filter(l=>l.product.seller===s).map(({product:p,quantity})=><article className="by-line" key={p.id+':'+p.variantId}><Link to={'/product/'+p.id}><img src={p.image} alt={p.name} loading="lazy"/></Link><div className="by-item"><small>{p.brand}</small><Link to={'/product/'+p.id}>{p.name}</Link><small>{p.variantLabel||p.category}</small><div className="by-row"><div className="by-step"><button aria-label={'Decrease quantity of '+p.name} disabled={quantity<=1} onClick={()=>setQuantity(p.id,quantity-1,p.variantId)}>−</button><span>{quantity}</span><button aria-label={'Increase quantity of '+p.name} disabled={quantity>=Math.min(99,p.stock)} onClick={()=>setQuantity(p.id,quantity+1,p.variantId)}>+</button></div><button className="by-text" onClick={()=>setQuantity(p.id,0,p.variantId)}>Remove</button></div></div><strong>{money(p.price*quantity)}</strong></article>)}</section>)}</div><Summary cart={cart} code={code} vouchers={vouchers} submit={onCode}><Link className="by-button" to="/checkout">Continue to checkout</Link></Summary></div>}</Page>
}
function Wishlist({wishlist,add,wish}:Pick<BuyerProps,'wishlist'|'add'|'wish'>){return <Page title="Wishlist" sub={wishlist.length?wishlist.length+' saved products':undefined}>{!wishlist.length?<Empty title="Keep your favourites here" desc="Use the heart on any product to save it for later."/>:<div className="by-grid">{wishlist.map(p=><article className="by-panel by-wish" key={p.id}><Link to={'/product/'+p.id}><img src={p.image} alt={p.name} loading="lazy"/></Link><small>{p.brand}</small><h2><Link to={'/product/'+p.id}>{p.name}</Link></h2><strong>{money(p.price)}</strong><div className="by-row"><button className="by-button" disabled={!p.stock} onClick={()=>add(p)}>Add to cart</button><button className="by-text" onClick={()=>wish(p)}>Remove</button></div></article>)}</div>}</Page>}
function localOrders():Order[]{return load<Order[]>('demo-orders',[])}
async function getOrder(id:string,preview:boolean,token?:string){if(preview){const order=localOrders().find(o=>o.id===id);if(!order)throw new Error('No matching demo order was found on this browser.');return order}const secret=token||load<string>(receiptKey(id),'');return (await api<{order:Order}>('/orders/'+encodeURIComponent(id)+(secret?'?token='+encodeURIComponent(secret):''))).order}
function AddressFields({email=false,defaults}:{email?:boolean;defaults?:Address}){return <><Field name="name" label="Full name" autoComplete="name" defaultValue={defaults?.name}/>{email&&<Field name="email" label="Email address" type="email" autoComplete="email" defaultValue={defaults?.email}/>}<Field name="phone" label="Phone number" type="tel" autoComplete="tel" defaultValue={defaults?.phone}/><Field name="address" label="Street address" autoComplete="street-address" defaultValue={defaults?.address}/><Field name="city" label="City" autoComplete="address-level2" defaultValue={defaults?.city}/></>}
function Checkout({cart,code,clearCart,preview,vouchers}:{cart:Line[];vouchers:Voucher[];code:string;clearCart:()=>void;preview:boolean}){
 const nav=useNavigate();const [busy,setBusy]=useState(false),[error,setError]=useState(''); const request=useRef({body:'',id:''});const [selectedAddress,setSelectedAddress]=useState('');
 const account=useResource('checkout-addresses',async()=>{
    if(preview)return {addresses:[] as Address[],email:''};
    const {user}=await api<{user:User|null}>('/auth/me');if(!user)return {addresses:[] as Address[],email:''};
    const {addresses}=await api<{addresses:Address[]}>('/account/addresses');return {addresses,email:user.email};
 },{addresses:[] as Address[],email:''});
 const savedAddress=selectedAddress!==''?account.data.addresses[Number(selectedAddress)]:undefined;
 async function place(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy||!cart.length)return;setBusy(true);setError('');const shipping=Object.fromEntries(new FormData(e.currentTarget)) as Address;const items=cart.map(l=>({productId:l.product.id,variantId:l.product.variantId,quantity:l.quantity}));const body=JSON.stringify({items,shipping,coupon:code});if(request.current.body!==body)request.current={body,id:crypto.randomUUID()};
  try{let order:Order;
   if(preview){order={id:'VY-'+crypto.randomUUID().slice(0,8).toUpperCase(),createdAt:new Date().toISOString(),items:cart.map(({product:p,quantity})=>({productId:p.id,variantId:p.variantId,label:p.variantLabel,name:p.name,image:p.image,price:p.price,quantity,seller:p.seller})),shipments:Array.from(new Set(cart.map(l=>l.product.seller))).map(seller=>({seller,status:'Placed',events:[{status:'Placed',at:new Date().toISOString()}]})),...breakdown(cart,code,vouchers),demo:true};save('demo-orders',[order,...localOrders()])}
   else{const res=await api<{order:Order;trackingToken?:string}>('/orders','POST',{items,shipping,coupon:code||undefined,requestId:request.current.id});order=res.order;if(res.trackingToken){save(receiptKey(order.id),res.trackingToken);save('guest-ids',Array.from(new Set([order.id,...load<string[]>('guest-ids',[])])))}}
   nav('/order-success/'+encodeURIComponent(order.id),{replace:true,state:{order}});clearCart();save('voucher','');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <Page title="Checkout">{!cart.length?<Empty title="Your cart is empty" desc="Add a product to begin checkout."/>:<div className="by-layout"><form id="by-checkout" className="by-panel by-form" onSubmit={place}><h2>Delivery details</h2>{account.data.addresses.length>0&&<label className="by-field">Use a saved address<select value={selectedAddress} onChange={e=>setSelectedAddress(e.target.value)}><option value="">Enter a new address</option>{account.data.addresses.map((a,i)=><option key={i} value={i}>{a.name} · {a.address}, {a.city}</option>)}</select></label>}<AddressFields key={selectedAddress} email defaults={savedAddress?{...savedAddress,email:account.data.email}:undefined}/><h2>Payment</h2><p className="by-payment">Cash on delivery</p>{preview&&<p className="by-note">Preview checkout saves a demo order on this browser. You can use sample delivery details.</p>}<Alert text={error}/></form><Summary cart={cart} code={code} vouchers={vouchers}><button form="by-checkout" className="by-button" disabled={busy}>{busy?'Placing order…':preview?'Place demo order':'Place order'}</button></Summary></div>}</Page>
}
function GuestTrackingLink({id}:{id:string}){
 const token=load<string>(receiptKey(id),'');
 const [copied,setCopied]=useState(false),[fallback,setFallback]=useState(false);
 if(!token)return null;
 const url=new URL('/track/'+encodeURIComponent(id),window.location.origin);url.searchParams.set('token',token);
 return <div className="by-guest-link"><p>Keep this private link to track your guest order on another device.</p><button className="by-quiet" onClick={async()=>{try{await navigator.clipboard.writeText(url.href);setCopied(true)}catch{setFallback(true)}}}>{copied?'Tracking link copied':'Copy private tracking link'}</button>{fallback&&<label className="by-field">Private tracking link<input aria-label="Private tracking link" readOnly onFocus={e=>e.target.select()} value={url.href}/></label>}</div>
}
function Success({id,preview}:{id:string;preview:boolean}){
 const location=useLocation(),fromState=location.state?.order as Order|undefined;
 const {data:order,error,busy}=useResource(id,()=>fromState?Promise.resolve(fromState):getOrder(id,preview),null as Order|null);
 return <Page title="Order confirmation">{busy?<p role="status">Finding your order…</p>:error?<Alert text={error}/>:order&&<div className="by-success"><div className="by-celebrate" aria-hidden="true"><i/><i/><i/><i/><i/><i/><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30"/><path d="M21 36l10 10 20-21"/></svg></div><h2>Order successful</h2><p>Your order <strong>{order.id}</strong> is confirmed.</p><p>{order.items.reduce((s,i)=>s+i.quantity,0)} items · {money(order.total)} · Cash on delivery</p><div className="by-center"><Link className="by-button" to={'/track/'+order.id}>Track order</Link><Link className="by-quiet" to={'/orders/'+order.id}>View order</Link></div>{!preview&&<GuestTrackingLink id={id}/>}</div>}</Page>
}
function Orders({preview}:{preview:boolean}){
 const {data, busy,error}=useResource('orders:'+preview,async()=>{if(preview)return localOrders();let mine:Order[]=[];let failure='';try{mine=(await api<{orders:Order[]}>('/orders')).orders}catch(e){failure=(e as Error).message}const guests=await Promise.all(load<string[]>('guest-ids',[]).map(id=>getOrder(id,false).catch(()=>null)));const all=[...mine,...guests.filter((o):o is Order=>!!o)];if(failure&&!all.length)throw new Error(failure);return Array.from(new Map(all.map(o=>[o.id,o])).values()).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt))},[] as Order[]);
 const [q,setQ]=useState(''),[status,setStatus]=useState('');const statuses=Array.from(new Set(data.flatMap(o=>o.shipments.map(s=>s.status))));const list=data.filter(o=>(!status||o.shipments.some(s=>s.status===status))&&([o.id,...o.items.map(i=>i.name)].join(' ').toLowerCase().includes(q.toLowerCase())));
 return <Page title="My orders">{busy?<p role="status">Loading orders…</p>:error?<><Alert text={error}/><Link to="/login" className="by-quiet">Sign in</Link></>:!data.length?<Empty title="No orders yet" desc="Once you place an order, you'll find it here."/>:<><div className="by-tools"><label className="by-field">Find an order<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Order number or product"/></label><label className="by-field">Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label></div>{!list.length&&<p>No orders match your search.</p>}{list.map(o=><article key={o.id} className="by-panel"><div className="by-space"><div><small>{fmtDate(o.createdAt)}</small><h2>{o.id}</h2></div><strong>{money(o.total)}</strong></div><p>{o.items.map(i=>i.name).join(', ')}</p><div className="by-row"><Link className="by-quiet" to={'/orders/'+o.id}>Order details</Link><Link className="by-text" to={'/track/'+o.id}>Track packages</Link></div></article>)}</>}</Page>
}
function TrackingLookup(){const nav=useNavigate();return <Page title="Track your order"><form className="by-auth by-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);const token=String(d.get('token')||'').trim();nav('/track/'+encodeURIComponent(String(d.get('id')).trim())+(token?'?token='+encodeURIComponent(token):''))}}><Field name="id" label="Order number"/><Field name="token" label="Guest tracking token (if supplied)" required={false}/><button className="by-button">Find order</button></form></Page>}
function OrderView({id,tracking,preview}:{id:string;tracking:boolean;preview:boolean}){
 const [params]=useSearchParams();const token=params.get('token')||'';const {data:o,busy,error}=useResource(id+token,()=>getOrder(id,preview,token),null as Order|null);
 return <Page title={tracking?'Track order':'Order details'}>{busy?<p role="status">Loading your order…</p>:error?<><Alert text={error}/><Link className="by-text" to="/track">Find another order</Link></>:o&&<><div className="by-panel by-space"><div><small>Order number</small><h2>{o.id}</h2><small>Placed {fmtDate(o.createdAt)}</small></div><strong>{money(o.total)}</strong></div>{o.shipments.map((s,index)=><article key={s.seller} className="by-panel"><div className="by-space"><div><small>Package {index+1} of {o.shipments.length}</small><h2>{s.seller}</h2></div><span className="by-pill">{s.status}</span></div>{tracking?<ol className="by-timeline">{s.events.map((ev,i)=><li key={i}><strong>{ev.status}</strong><small>{fmtDate(ev.at)}</small></li>)}</ol>:o.items.filter(i=>i.seller===s.seller).map((i,idx)=><div className="by-line" key={idx}><img src={i.image} alt="" loading="lazy"/><div className="by-item"><Link to={'/product/'+i.productId}>{i.name}</Link><small>{i.label&&i.label+' · '}Quantity {i.quantity}</small></div><strong>{money(i.price*i.quantity)}</strong></div>)}</article>)}{!tracking&&<div className="by-panel"><h2>Payment details</h2><p>Subtotal {money(o.subtotal)} · Discount {money(o.discount)} · Delivery {money(o.shippingFee)}</p><strong>Total {money(o.total)}</strong></div>}<div className="by-row"><Link className="by-button" to={(tracking?'/orders/':'/track/')+o.id+(token?'?token='+encodeURIComponent(token):'')}>{tracking?'View order details':'Track packages'}</Link>{!tracking&&<><Link className="by-quiet" to={'/orders/'+o.id+'/return'}>Request return</Link><Link className="by-text" to={'/orders/'+o.id+'/return-status'}>Return status</Link></>}</div></>}</Page>
}
function Returns({id,preview,statusOnly}:{id:string;preview:boolean;statusOnly:boolean}){
 const nav=useNavigate();const [error,setError]=useState(''),[sending,setSending]=useState(false);const {data:o,busy,error:orderErr}=useResource(id,()=>getOrder(id,preview),null as Order|null);
 const results=useResource(id+String(statusOnly),async()=>preview?load<ReturnRequest[]>('returns',[]):(await api<{returns:ReturnRequest[]}>('/manage/returns')).returns,[] as ReturnRequest[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(sending)return;setError('');setSending(true);const f=Object.fromEntries(new FormData(e.currentTarget));try{const entry={orderId:id,productId:String(f.productId),reason:String(f.reason).trim()};if(!entry.reason)throw new Error('Please describe the reason for the return.');if(preview)save('returns',[...load<ReturnRequest[]>('returns',[]),{...entry,status:'Requested'}]);else await api('/manage/returns','POST',entry);nav('/orders/'+id+'/return-status')}catch(e){setError((e as Error).message)}finally{setSending(false)}}
 const list=results.data.filter(r=>r.orderId===id);
 return <Page title={statusOnly?'Return status':'Request a return'}>{busy?<p>Loading order…</p>:orderErr?<Alert text={orderErr}/>:o&&<div className="by-panel"><small>{id}</small>{statusOnly?<>{results.busy?<p>Loading requests…</p>:results.error?<Alert text={results.error}/>:!list.length?<p>No return requests for this order.</p>:list.map((r,i)=><div className="by-line" key={i}><div><h2>{o.items.find(x=>x.productId===r.productId)?.name||'Item'}</h2><p>{r.reason}</p><strong>{r.status}</strong></div></div>)}</>:<form onSubmit={submit} className="by-form"><label className="by-field">Select an item<select name="productId">{o.items.map((i,idx)=><option key={idx} value={i.productId}>{i.name}</option>)}</select></label><label className="by-field">Reason<textarea required maxLength={1000} name="reason" rows={4}/></label><Alert text={error}/><Submit busy={sending}>Submit return request</Submit></form>}<Link className="by-text" to={'/orders/'+id}>Back to order</Link></div>}</Page>
}
const accountLinks=[['/account/profile','Profile & security'],['/account/addresses','Address book'],['/orders','My orders'],['/wishlist','Wishlist'],['/account/reviews','My reviews'],['/account/notifications','Notifications'],['/account/vouchers','My vouchers']];
function Account({section,preview,onCode,vouchers}:{section:string;vouchers:Voucher[];preview:boolean;onCode:(s:string)=>void}){
 const [rev,update]=useState(0),[alert,setAlert]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);const nav=useNavigate();
 const auth=useResource('auth'+rev,async()=>preview?null:(await api<{user:User}>('/auth/me')).user,null as User|null);
 const address=useResource('addresses'+section+rev,async()=>section==='addresses'&&!preview?(await api<{addresses:Address[]}>('/account/addresses')).addresses:[],[] as Address[]);
 const activity=useResource('updates'+section,async()=>section==='notifications'?(preview?localOrders():(await api<{orders:Order[]}>('/orders')).orders):[],[] as Order[]);
 const reviews=useResource('reviews'+section,async()=>section==='reviews'&&!preview?(await api<{reviews:{id:string;productId:string;rating:number;text?:string;comment?:string;message?:string}[]}>('/account/reviews')).reviews:[],[] as {id:string;productId:string;rating:number;text?:string;comment?:string;message?:string}[]);
 const title=section?accountLinks.find(([p])=>p==='/account/'+section)?.[1]||'My account':'My account';
 async function edit(e:FormEvent<HTMLFormElement>,addressMode:boolean){e.preventDefault();if(busy)return;setAlert('');setNotice('');setBusy(true);const f=e.currentTarget;try{await api(addressMode?'/account/addresses':'/account',addressMode?'POST':'PATCH',Object.fromEntries(new FormData(f)));setNotice(addressMode?'Address saved.':'Profile updated.');if(addressMode)f.reset();update(v=>v+1)}catch(e){setAlert((e as Error).message)}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{await api('/auth/logout','POST',{});window.dispatchEvent(new Event('veyra:session'));nav('/login')}catch(e){setAlert((e as Error).message)}finally{setBusy(false)}}
 const gate=<Empty title="Sign in to your account" desc="Your profile and saved addresses are available after sign-in." link="/login" action="Sign in"/>;
 return <Page title={title}><div className="by-account"><nav className="by-side" aria-label="Account"><Link to="/account">Account overview</Link>{accountLinks.map(([to,label])=><Link key={to} to={to} aria-current={to==='/account/'+section?'page':undefined}>{label}</Link>)}</nav><div>
 <Alert text={alert}/>{notice&&<p className="by-message" role="status">{notice}</p>}
 {!section&&<div className="by-panel"><h2>{auth.data?'Welcome, '+auth.data.name:'Welcome to your account'}</h2><p>{auth.data?.email||'Find your purchases, track packages, and manage account details.'}</p><div className="by-row"><Link className="by-button" to="/orders">View orders</Link>{auth.data?<button className="by-quiet" onClick={logout} disabled={busy}>Sign out</button>:<Link className="by-quiet" to="/login">Sign in</Link>}</div></div>}
 {['profile','addresses'].includes(section)&&(auth.busy?<p>Loading account…</p>:!auth.data?gate:section==='profile'?<form className="by-panel by-form" onSubmit={e=>edit(e,false)}><Field label="Full name" name="name" defaultValue={auth.data.name}/><p>{auth.data.email}</p><Submit busy={busy}>Save changes</Submit><Link className="by-text" to={'/forgot?email='+encodeURIComponent(auth.data.email)}>Change password</Link></form>:<><div className="by-panel"><h2>Saved addresses</h2>{address.error?<Alert text={address.error}/>:address.data.length?address.data.map((a,i)=><p key={i}><strong>{a.name}</strong><br/>{a.address}, {a.city}<br/>{a.phone}</p>):<p>No saved addresses yet.</p>}</div><form className="by-panel by-form" onSubmit={e=>edit(e,true)}><h2>Add address</h2><AddressFields/><Submit busy={busy}>Save address</Submit></form></>)}
 {section==='vouchers'&&<div className="by-panel"><h2>Available vouchers</h2>{vouchers.map(({code,percent})=><div className="by-coupon" key={code}><div><strong>{code}</strong><p>{code==='FREESHIP'?'Free delivery':percent+'% off your basket'}</p></div><button className="by-quiet" onClick={()=>{onCode(code);nav('/cart')}}>Use code</button></div>)}</div>}
 {section==='notifications'&&<div className="by-panel"><h2>Order updates</h2>{activity.error?<Alert text={activity.error}/>:!activity.data.length?<p>No shipment updates yet.</p>:activity.data.flatMap(o=>o.shipments.map(s=><div className="by-coupon" key={o.id+s.seller}><div><strong>{s.seller} · {s.status}</strong><p>{o.id}</p></div><Link className="by-text" to={'/track/'+o.id}>Track</Link></div>))}</div>}
 {section==='reviews'&&<div className="by-panel"><h2>Your product reviews</h2>{reviews.error?<Alert text={reviews.error}/>:!reviews.data.length?<p>No reviews to display.</p>:reviews.data.map(r=><div key={r.id}><Link to={'/product/'+r.productId}>View product</Link><p>{r.rating}/5 · {r.text||r.comment||r.message}</p></div>)}</div>}
 </div></div></Page>
}
export default function Buyer(props:BuyerProps){
 const loc=useLocation();const parts=loc.pathname.split('/').filter(Boolean);const [area,id,detail]=parts;const [code,setCode]=useState(()=>load<string>('voucher',''));const onCode=(s:string)=>{save('voucher',s);setCode(s)};
 const preview=props.preview??(import.meta.env.VITE_DEMO_MODE==='true');const vouchers=useVouchers(preview);
 if(['login','register','verify','forgot','reset'].includes(area))return <Auth key={area} page={area} preview={preview}/>;
 if(area==='cart')return <Cart vouchers={vouchers} cart={props.cart} setQuantity={props.setQuantity} code={code} onCode={onCode}/>;
 if(area==='wishlist')return <Wishlist {...props}/>;
 if(area==='checkout')return <Checkout vouchers={vouchers} cart={props.cart} clearCart={()=>{props.clearCart();onCode('')}} code={code} preview={preview}/>;
 if(area==='order-success'&&id)return <Success id={id} preview={preview}/>;
 if(area==='track')return id?<OrderView id={id} tracking preview={preview}/>:<TrackingLookup/>;
 if(area==='orders')return !id?<Orders preview={preview}/>:detail==='return'||detail==='return-status'?<Returns key={detail} id={id} preview={preview} statusOnly={detail==='return-status'}/>:<OrderView id={id} tracking={false} preview={preview}/>;
 return <Account vouchers={vouchers} key={id||area} section={id||''} preview={preview} onCode={onCode}/>;
}
