import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {ArrowUpRight,Check,ChevronDown,ChevronLeft,ChevronRight,Heart,Layers3,Package,Search,ShoppingBag,SlidersHorizontal,Star,Truck,X} from 'lucide-react';
import {departments,products,money,slugify,type Department,type Product,type Variant} from './catalogData';
import './catalog.css';

export {departments,products,money,type Product} from './catalogData';
type Actions={add:(p:Product)=>void;wish:(p:Product)=>void};
type CatalogProps=Actions&{saved?:Product[]};
const paths=(id:string)=>'/product/'+encodeURIComponent(id);
const groups=departments.flatMap(d=>d.groups.flatMap(g=>g.leaves.map(l=>({...l,department:d,group:g.name}))));
const normalized=(v:string)=>v.trim().toLocaleLowerCase();
const discount=(p:Product,price=p.price)=>Math.max(0,Math.round(100*(1-price/p.oldPrice)));
function load<T,>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem('veyra.'+key)||'null')??fallback}catch{return fallback}}
function persist(key:string,value:unknown){localStorage.setItem('veyra.'+key,JSON.stringify(value))}
function selected(p:Product,v:Variant):Product{return {...p,variantId:v.id,variantLabel:v.label,price:v.price,stock:v.stock};}
function model(x:Partial<Product>&{id:string;name:string}):Product{
 const department=departments.find(d=>[d.slug,d.name].some(n=>normalized(n)===normalized(x.department||'')));
 const match=groups.find(g=>normalized(g.name)===normalized(x.category||'')&&(!department||g.department.slug===department.slug));
 const variants=x.variants?.length?x.variants:[{id:x.id+'-v1',label:'Standard',price:Number(x.price||0),stock:Number(x.stock||0),attributes:{}}];
 return {id:x.id,name:x.name,brand:x.brand||'Independent Makers',category:x.category||'General',department:x.department||match?.department.name||'Marketplace',departmentSlug:department?.slug||match?.department.slug||slugify(x.department||'Marketplace'),categorySlug:match?.slug||slugify(x.category||'General'),group:match?.group||'Products',image:x.image||'',price:variants[0].price,oldPrice:x.oldPrice||variants[0].price,stock:x.stock??variants.reduce((a,v)=>a+v.stock,0),seller:x.seller||'Veyra Studio',description:x.description||x.name,attributes:x.attributes||{},rating:x.rating||0,variants,sequence:products.length,popularity:0};
}
type ChangeSet={listings?:Partial<Product>[];stocks?:{productId:string;variantId:string;stock:number}[]};
function localChanges():ChangeSet{
 try{const w=JSON.parse(localStorage.getItem('veyra.workspace.v1')||'{}');return {listings:(w.listings||[]).filter((l:{status:string})=>l.status==='Published').map((p:Product)=>({...p,seller:w.shop?.name||'Veyra Studio'}))}}catch{return {}}
}
function useInventory(){
 const [changes,set]=useState<ChangeSet>(()=>import.meta.env.VITE_DEMO_MODE==='true'?localChanges():{});
 useEffect(()=>{if(import.meta.env.VITE_DEMO_MODE==='true')return;const ac=new AbortController();
 fetch((import.meta.env.VITE_API_BASE||'')+'/api/catalog/updates',{signal:ac.signal}).then(r=>r.ok?r.json():{}).then(v=>{if(!ac.signal.aborted)set(v)}).catch(()=>{});return()=>ac.abort()},[]);
 return useMemo(()=>{
  const listings=(changes.listings||[]).filter((p):p is Partial<Product>&{id:string;name:string}=>!!p.id&&!!p.name).map(model);
  if(!listings.length&&!changes.stocks?.length)return products;
  const mods=new Map((changes.stocks||[]).map(s=>[s.productId+'|'+s.variantId,s.stock]));
  const custom=new Map(listings.map(p=>[p.id,p]));
  return [...products.filter(p=>!custom.has(p.id)),...listings].map(p=>{if(!p.variants.some(v=>mods.has(p.id+'|'+v.id)))return p;const variants=p.variants.map(v=>({...v,stock:mods.get(p.id+'|'+v.id)??v.stock}));return {...p,variants,stock:variants.reduce((n,v)=>n+v.stock,0)}})
 },[changes]);
}
function Image({src,name,loading='lazy'}:{src:string;name:string;loading?:'eager'|'lazy'}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return bad||!src?<span className="vc-fallback"><Package size={28}/><span>Image unavailable</span></span>:<img src={src} loading={loading} decoding="async" alt={name} onError={()=>setBad(true)}/>;
}
function Crumbs({items}:{items:[string,string][]}){return <nav className="vc-crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link>{items.map(([name,path],i)=><span key={i}><ChevronRight size={13}/>{path?<Link to={path}>{name}</Link>:name}</span>)}</nav>}
function Card({p,add,wish}:{p:Product}&Actions){
 const [saved,set]=useState(()=>readWish(p.id)); const [added,a]=useState(false);
 useEffect(()=>set(readWish(p.id)),[p.id]);
 const link=paths(p.id)+(p.variantId?'?variant='+encodeURIComponent(p.variantId):'');
 return <article className="vc-card"><div className="vc-picture"><Link to={link} aria-label={p.name}><Image src={p.image} name={p.name}/></Link>
 {discount(p)>0&&<span className="vc-off">−{discount(p)}%</span>}<button className={'vc-heart '+(saved?'is-saved':'')} aria-label={(saved?'Remove from':'Add to')+' wishlist: '+p.name} aria-pressed={saved} onClick={()=>{wish(p);set(!saved)}}><Heart size={17} fill={saved?'currentColor':'none'}/></button></div>
 <Link className="vc-maker" to={'/brand/'+slugify(p.brand)}>{p.brand}</Link><Link className="vc-name" to={link}>{p.name}</Link>{p.variantLabel&&p.variantLabel!=='Standard'&&<small>{p.variantLabel}</small>}<div className="vc-card-price"><span>{money(p.price)} {p.oldPrice>p.price&&<del>{money(p.oldPrice)}</del>}</span><button disabled={p.stock===0} aria-label={'Add '+p.name+' to bag'} onClick={()=>{add(p);a(true);setTimeout(()=>a(false),1300)}}>{added?<Check size={17}/>:<ShoppingBag size={17}/>}</button></div></article>
}
function readWish(id:string){try{return JSON.parse(localStorage.getItem('veyra-wishlist')||'[]').some((p:Product)=>p.id===id)}catch{return false}}
function Empty({heading,text,action='Browse departments',to='/departments'}:{heading:string;text:string;action?:string;to?:string}){return <div className="vc-empty"><Layers3 size={29}/><h2>{heading}</h2><p>{text}</p><Link className="vc-button" to={to}>{action}</Link></div>}
function Departments(){const [q,set]=useState('');const filtered=departments.filter(d=>normalized(d.name).includes(normalized(q))||d.groups.some(g=>g.leaves.some(l=>normalized(l.name).includes(normalized(q)))));return <><Crumbs items={[[ 'All departments','']]}/><h1>All departments</h1><label className="vc-searchbox"><Search size={17}/><input value={q} onChange={e=>set(e.target.value)} placeholder="Find a department or category"/></label><div className="vc-departments">{filtered.map(d=><div key={d.slug}><Link className="vc-dep-card" to={'/department/'+d.slug}><Image src={d.image} name={d.name}/><span><strong>{d.name}</strong><small>{d.groups.reduce((n,g)=>n+g.leaves.length,0)} categories</small></span><ChevronRight size={17}/></Link><div className="vc-leaf-links">{d.groups.flatMap(g=>g.leaves).filter(l=>!q||normalized(d.name).includes(normalized(q))||normalized(l.name).includes(normalized(q))).slice(0,4).map(l=><Link key={l.slug} to={'/category/'+l.slug}>{l.name}</Link>)}</div></div>)}</div>{!filtered.length&&<p>No matching departments.</p>}</>}
function DepartmentGroups({d}:{d:Department}){return <details className="vc-tree"><summary>Browse all {d.groups.reduce((n,g)=>n+g.leaves.length,0)} categories <ChevronDown size={17}/></summary><div>{d.groups.map(g=><section key={g.name}><strong>{g.name}</strong>{g.leaves.map(l=><Link key={l.slug} to={'/category/'+l.slug}>{l.name}</Link>)}</section>)}</div></details>}
function Directory({inventory,stores=false}:{inventory:Product[];stores?:boolean}){const [q,set]=useState('');const dir=useMemo(()=>{const map=new Map<string,number>();for(const p of inventory){const name=stores?p.seller:p.brand;map.set(name,(map.get(name)||0)+1)}return [...map].sort(([a],[b])=>a.localeCompare(b))},[inventory,stores]);const found=dir.filter(([n])=>normalized(n).includes(normalized(q)));const [page,setPage]=useState(1);return <><Crumbs items={[[ stores?'Seller directory':'Brand directory','']]}/><h1>{stores?'Shop by store':'Shop by brand'}</h1><label className="vc-searchbox"><Search size={17}/><input value={q} onChange={e=>{set(e.target.value);setPage(1)}} placeholder={stores?'Find a store':'Find a brand'}/></label><div className="vc-index">{found.slice((page-1)*72,page*72).map(([n,count])=><Link to={'/'+(stores?'store/':'brand/')+slugify(n)} key={n}><strong>{n}</strong><small>{count} {count===1?'product':'products'}</small></Link>)}</div>{!found.length&&<p>No matches.</p>}<Pager page={page} count={Math.ceil(found.length/72)} set={setPage}/></>}
function Pager({page,count,set}:{page:number;count:number;set:(n:number)=>void}){return count>1?<nav aria-label="Pagination" className="vc-pager"><button disabled={page<=1} onClick={()=>set(page-1)}><ChevronLeft size={16}/> Previous</button><span>Page {page} of {count}</span><button disabled={page>=count} onClick={()=>set(page+1)}>Next <ChevronRight size={16}/></button></nav>:null}
function storageViews(id:string){try{const prev=load<string[]>('recent',[]);persist('recent',[id,...prev.filter(x=>x!==id)].slice(0,30))}catch{/* Storage can be unavailable for private browsing. */}}
const sortNames=[['recommended','Recommended'],['price-asc','Price: low to high'],['price-desc','Price: high to low'],['popular','Popularity'],['new','Newest arrivals'],['rating','Highest rated'],['discount','Biggest discount']];
const stop=new Set(['model','sku','description','name']);
function Listing({inventory,top,id,add,wish}:{inventory:Product[];top:string;id:string}&Actions){
 const [params,setParams]=useSearchParams(),[mobile,setMobile]=useState(false),[brandSearch,setBrand]=useState(''),[expanded,setExpanded]=useState(false);
 const min=params.get('min')||'',max=params.get('max')||'',sort=params.get('sort')||(top==='best-sellers'?'popular':top==='new-arrivals'?'new':top==='deals'||top==='flash-sale'?'discount':'recommended');
 const minN=min===''?0:Number(min),maxN=max===''?Infinity:Number(max);const [priceError,setError]=useState('');
 const brands=params.getAll('brand'),q=params.get('q')||'',chosenLeaf=groups.find(l=>l.slug===id),d=departments.find(x=>x.slug===id);
 const filterMap:Record<string,string[]>={};
 for(const [key,value] of params)if(key.startsWith('a.'))(filterMap[key.slice(2)]||=[]).push(value);
 const base=useMemo(()=>{
  const terms=normalized(q).split(/\s+/).filter(Boolean),recent=load<string[]>('recent',[]);
  return inventory.filter(p=>{
   if(top==='department'&&p.departmentSlug!==id||top==='category'&&p.categorySlug!==id||top==='brand'&&slugify(p.brand)!==id||top==='store'&&slugify(p.seller)!==id)return false;
   if((top==='deals'||top==='flash-sale'||top==='campaign')&&discount(p)<(top==='flash-sale'?35:1))return false;
   if(top==='recently-viewed'&&!recent.includes(p.id))return false;
   if(terms.length){const hay=normalized([p.name,p.department,p.category,p.brand,p.seller,...p.variants.map(v=>v.label)].join(' '));if(!terms.every(t=>hay.includes(t)))return false}
   return true
  }).sort((a,b)=>top==='recently-viewed'?recent.indexOf(a.id)-recent.indexOf(b.id):0)
 },[inventory,q,top,id]);
 const attrsSelected=Object.entries(filterMap);const inStock=params.get('stock')==='1',minimumRating=Number(params.get('rating')||0);
 const validVariant=(v:Variant,ignore='')=>v.price>=minN&&v.price<=maxN&&(!inStock||v.stock>0)&&attrsSelected.every(([attr,values])=>attr===ignore||values.includes(v.attributes[attr]));
 const available=base.filter(p=>p.rating>=minimumRating&&p.variants.some(v=>validVariant(v)));
 const brandCounts=new Map<string,number>();available.forEach(p=>brandCounts.set(p.brand,(brandCounts.get(p.brand)||0)+1));brands.forEach(b=>{if(!brandCounts.has(b))brandCounts.set(b,0)});
 const relevant=base.filter(p=>(!brands.length||brands.includes(p.brand))&&p.rating>=minimumRating);
 const result=available.filter(p=>!brands.length||brands.includes(p.brand)).map(p=>{
   const vv=p.variants.filter(v=>validVariant(v));const winner=vv.reduce((a,b)=>a.price<=b.price?a:b);return selected(p,winner)
 });
 result.sort((a,b)=>sort==='price-asc'?a.price-b.price:sort==='price-desc'?b.price-a.price:sort==='rating'?b.rating-a.rating:sort==='discount'?discount(b)-discount(a):sort==='popular'?b.popularity-a.popularity:sort==='new'?b.sequence-a.sequence:0);
 const facets:Record<string,Map<string,number>>={};
 if(top==='category'||top==='department'||(top==='search'&&base.length<700)){
  for(const p of relevant){const seen=new Set<string>();for(const v of p.variants){if(v.price<minN||v.price>maxN||inStock&&!v.stock)continue;for(const [k,value] of Object.entries(v.attributes)){if(!value||stop.has(k.toLowerCase())||!validVariant(v,k))continue;const tag=k+'|'+value;if(seen.has(tag))continue;seen.add(tag);const values=facets[k]||=new Map();values.set(value,1+(values.get(value)||0));}}}
 }
 const update=(key:string,value:string,multi=false)=>{const next=new URLSearchParams(params);next.delete('page');if(multi){const all=next.getAll(key);next.delete(key);(all.includes(value)?all.filter(v=>v!==value):[...all,value]).forEach(v=>next.append(key,v))}else if(value)next.set(key,value);else next.delete(key);setParams(next)};
 const clear=()=>{const next=new URLSearchParams();if(q)next.set('q',q);setParams(next);setError('')};
 const applyPrice=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const f=new FormData(event.currentTarget);const a=String(f.get('min')||''),b=String(f.get('max')||'');if(a&&b&&Number(a)>Number(b)){setError('Minimum must be less than or equal to maximum.');return}setError('');const next=new URLSearchParams(params);next.delete('page');for(const [k,v] of [['min',a],['max',b]]){if(v)next.set(k,v);else next.delete(k)}setParams(next)};
 const pageSize=24,pageCount=Math.ceil(result.length/pageSize),page=Math.min(Math.max(1,Number(params.get('page'))||1),pageCount||1);
 const name=top==='department'?d?.name:top==='category'?chosenLeaf?.name:top==='search'?'Search results':top==='brand'?base[0]?.brand:top==='store'?base[0]?.seller:({'deals':'Marketplace deals','flash-sale':'Flash sale','campaign':'The market edit','new-arrivals':'New arrivals','best-sellers':'Best sellers','recently-viewed':'Recently viewed','shop':'Shop all products'} as Record<string,string>)[top];
 const brandList=[...brandCounts.entries()].filter(([n])=>normalized(n).includes(normalized(brandSearch))).sort((a,b)=>Number(brands.includes(b[0]))-Number(brands.includes(a[0]))||b[1]-a[1]||a[0].localeCompare(b[0]));
 const chips=[...params.entries()].filter(([key])=>!['q','page','sort'].includes(key));
 const section=(title:string,body:React.ReactNode)=><details className="vc-filter-sec" key={title} open><summary>{title}<ChevronDown size={15}/></summary>{body}</details>;
 if(!name)return <Empty heading="Collection unavailable" text="Choose another department to continue shopping."/>;
 return <><Crumbs items={[...(chosenLeaf&&top==='category'?[[chosenLeaf.department.name,'/department/'+chosenLeaf.department.slug] as [string,string]]:[]),[name,'']]}/><div className="vc-title-row"><div><h1>{name}</h1>{top==='search'&&q&&<p>Showing matches for “{q}”</p>}</div>{top==='deals'&&<Link className="vc-quiet-link" to="/flash-sale">Shop flash sale <ArrowUpRight size={15}/></Link>}</div>
 {top==='department'&&d&&<DepartmentGroups d={d}/>}
 {(top==='deals'||top==='flash-sale')&&<div className="vc-vouchers"><div><strong>10% off your order</strong><code>WELCOME10</code></div><div><strong>15% off the market edit</strong><code>EDIT15</code></div><div><strong>Free standard delivery</strong><code>FREESHIP</code></div></div>}
 <div className="vc-layout"><button className="vc-mobile-filter" onClick={()=>setMobile(true)}><SlidersHorizontal size={16}/> Filters{chips.length?' ('+chips.length+')':''}</button>
 {mobile&&<button className="vc-veil" onClick={()=>setMobile(false)} aria-label="Close filters"/>}
 <aside className={'vc-filter '+(mobile?'vc-open':'')} data-lenis-prevent><div className="vc-filter-title"><h2>Filters</h2><button onClick={clear} className="vc-textbtn">Clear all</button><button className="vc-close" onClick={()=>setMobile(false)} aria-label="Close filters"><X size={18}/></button></div>
 {section('Price range',<form key={min+'|'+max} onSubmit={applyPrice}><div className="vc-minmax"><label>Min (Rs.)<input name="min" type="number" min="0" defaultValue={min} placeholder="0"/></label><label>Max (Rs.)<input name="max" type="number" min="0" defaultValue={max} placeholder="Any"/></label></div><button className="vc-apply">Apply price</button>{priceError&&<p role="alert">{priceError}</p>}</form>)}
 {section('Brand',<><input type="search" aria-label="Find brand" placeholder="Find a brand" value={brandSearch} onChange={e=>setBrand(e.target.value)}/>{brandList.slice(0,expanded?100:7).map(([brand,n])=><label className="vc-check" key={brand}><input type="checkbox" checked={brands.includes(brand)} onChange={()=>update('brand',brand,true)}/>{brand}<small>{n}</small></label>)}{brandList.length>7&&<button className="vc-textbtn" onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer':'Show more brands'}</button>}</>)}
 {Object.entries(facets).filter(([,v])=>v.size>0&&v.size<140).sort(([a],[b])=>a.localeCompare(b)).slice(0,9).map(([attr,values])=>section(attr,<div className="vc-scroll-facet">{[...values].sort((a,b)=>b[1]-a[1]).map(([v,n])=><label key={v} className="vc-check"><input type="checkbox" checked={(filterMap[attr]||[]).includes(v)} onChange={()=>update('a.'+attr,v,true)}/>{v}<small>{n}</small></label>)}</div>))}
 {section('Availability',<label className="vc-check"><input type="checkbox" checked={inStock} onChange={()=>update('stock',inStock?'':'1')}/> In stock only</label>)}{section('Customer rating',<select aria-label="Minimum customer rating" value={minimumRating} onChange={e=>update('rating',e.target.value==='0'?'':e.target.value)}><option value="0">Any rating</option><option value="3">3 stars & up</option><option value="4">4 stars & up</option><option value="4.5">4.5 stars & up</option></select>)}
 <button className="vc-mobile-show vc-button" onClick={()=>setMobile(false)}>Show {result.length.toLocaleString()} products</button></aside>
 <div className="vc-results"><div className="vc-toolbar"><span>{result.length.toLocaleString()} {result.length===1?'product':'products'}</span><label>Sort by <select value={sort} onChange={e=>update('sort',e.target.value)}>{sortNames.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
 {chips.length>0&&<div className="vc-chips">{chips.map(([k,v])=><button key={k+v} onClick={()=>update(k,k==='brand'||k.startsWith('a.')?v:'',k==='brand'||k.startsWith('a.'))}>{k==='min'?'Min '+money(+v):k==='max'?'Max '+money(+v):k==='stock'?'In stock':k==='rating'?v+'★ & up':v}<X size={13}/></button>)}</div>}
 {result.length?<div className="vc-grid">{result.slice((page-1)*pageSize,page*pageSize).map(p=><Card key={p.id} p={p} add={add} wish={wish}/>)}</div>:<div className="vc-empty"><Search size={27}/><h2>No products found</h2><p>Try another search or remove a filter.</p>{chips.length>0&&<button className="vc-button" onClick={clear}>Clear filters</button>}</div>}
 <Pager page={page} count={pageCount} set={n=>{const next=new URLSearchParams(params);next.set('page',String(n));setParams(next);window.scrollTo({top:0})}}/></div></div></>
}
type Post={id?:string;name?:string;author?:string;rating?:number;message:string;createdAt?:string};
const preview=import.meta.env.VITE_DEMO_MODE==='true';
function Discussion({p,kind}:{p:Product;kind:'questions'|'reviews'}){
 const [posts,setPosts]=useState<Post[]>([]),[message,setMsg]=useState(''),[busy,setBusy]=useState(false),[rating,setRating]=useState(5),[status,setStatus]=useState('');
 const resource='/api/products/'+encodeURIComponent(p.id)+'/'+kind;
 useEffect(()=>{let live=true;setStatus('');setMsg('');
  if(preview){setPosts(load<Post[]>(kind+'.'+p.id,[]));return}
  fetch(resource,{credentials:'include'}).then(r=>r.ok?r.json():{}).then((d:Partial<Record<typeof kind,Post[]>>)=>{if(live)setPosts(d[kind]||[])}).catch(()=>{if(live)setStatus('Could not retrieve messages.')});return()=>{live=false}
 },[resource,kind,p.id]);
 async function submit(e:FormEvent){e.preventDefault();if(!message.trim()||busy)return;setBusy(true);setStatus('');const post={message:message.trim(),...(kind==='reviews'?{rating}: {})};try{
  if(preview){const next=[{...post,name:'Preview visitor',createdAt:new Date().toISOString()},...posts];persist(kind+'.'+p.id,next);setPosts(next)}
  else{const r=await fetch(resource,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(post)});const d=await r.json();if(!r.ok)throw Error(d.error||'Sign in to continue.');const again=await fetch(resource,{credentials:'include'});if(again.ok)setPosts((await again.json())[kind]||[])}
  setMsg('');setStatus(kind==='reviews'?'Review submitted.':'Question submitted.')
 }catch(e){setStatus(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}
 return <section className="vc-talk"><h2>{kind==='reviews'?'Customer reviews':'Product questions'}</h2>{posts.length===0?<p>{kind==='reviews'?'No written reviews yet.':'No questions yet.'}</p>:posts.map((post,i)=><article key={post.id||i}><strong>{post.name||post.author||'Marketplace member'}</strong>{post.rating&&<span>{post.rating} / 5</span>}<p>{post.message}</p></article>)}<form onSubmit={submit}><label>{kind==='reviews'?'Write a review':'Ask a question'}<textarea required maxLength={1500} value={message} onChange={e=>setMsg(e.target.value)}/></label>{kind==='reviews'&&<label>Rating <select value={rating} onChange={e=>setRating(+e.target.value)}>{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select></label>}{preview&&<small>Preview submissions are stored in this browser.</small>}<button className="vc-button" disabled={busy}>{busy?'Submitting…':'Submit'}</button>{status&&<p role="status">{status}</p>}</form></section>
}
function Details({p,inventory,add,wish,tab}:{p:Product;inventory:Product[];tab?:string}&Actions){
 const [params,setParams]=useSearchParams();const v=p.variants.find(v=>v.id===params.get('variant'))||p.variants[0];const [saved,save]=useState(readWish(p.id)),[added,a]=useState(false);
 const [compared,compare]=useState(load<string[]>('compare',[]).includes(p.id)),[compareMsg,cm]=useState('');
 useEffect(()=>{storageViews(p.id)},[p.id]);
 const item=selected(p,v),specs={Brand:p.brand,Category:p.category,...v.attributes};
 const related=inventory.filter(x=>x.id!==p.id&&x.categorySlug===p.categorySlug).slice(0,4);
 const addCompare=()=>{const prev=load<string[]>('compare',[]);if(!compared&&prev.length>=4){cm('Your comparison already contains four items. Remove one to add this product.');return}persist('compare',compared?prev.filter(id=>id!==p.id):[...prev,p.id]);compare(!compared);cm('')};
 return <><Crumbs items={[[p.department,'/department/'+p.departmentSlug],[p.category,'/category/'+p.categorySlug],[p.name,'']]}/><div className="vc-product"><div className="vc-detail-image"><Image src={p.image} name={p.name} loading="eager"/></div><section><Link className="vc-maker" to={'/brand/'+slugify(p.brand)}>{p.brand}</Link><h1>{p.name}</h1><div className="vc-details-rating">{p.rating>0&&<><Star size={15} fill="currentColor"/>{p.rating.toFixed(1)} <i>·</i></>}<Link to={paths(p.id)+'/reviews'}>Customer reviews</Link></div><p className="vc-product-price">{money(v.price)} {p.oldPrice>v.price&&<del>{money(p.oldPrice)}</del>} {discount(p,v.price)>0&&<small>Save {discount(p,v.price)}%</small>}</p><p className="vc-prodesc">{p.description}</p>
 {p.variants.length>1&&<fieldset className="vc-variants"><legend>Select option</legend>{p.variants.map(vv=><button key={vv.id} aria-pressed={v.id===vv.id} onClick={()=>setParams({variant:vv.id},{replace:true})}>{vv.label}</button>)}</fieldset>}
 <div className="vc-stock"><span className={v.stock?'yes':'no'}/>{v.stock>0?v.stock+' available':'Out of stock'}</div><div className="vc-purchase"><button className="vc-button" disabled={!v.stock} onClick={()=>{add(item);a(true);setTimeout(()=>a(false),1400)}}>{added?<Check size={18}/>:<ShoppingBag size={18}/>} {added?'Added to bag':'Add to bag'}</button><button className={'vc-outline '+(saved?'is-saved':'')} onClick={()=>{wish(item);save(!saved)}}><Heart size={18} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Wishlist'}</button></div>
 <div className="vc-service"><Truck size={17}/><span>Standard delivery <Link to="/shipping">See delivery details</Link></span></div><div className="vc-service"><Package size={17}/><span>Sold by <Link to={'/store/'+slugify(p.seller)}>{p.seller}</Link></span></div>
 <div className="vc-compare-line"><button className="vc-textbtn" onClick={addCompare}>{compared?'Remove from comparison':'Add to comparison'}</button><Link to="/compare">View comparison</Link></div>{compareMsg&&<p>{compareMsg}</p>}</section></div>
 <nav className="vc-tabs" aria-label="Product information">{[['','Specifications'],['offers','Seller offers'],['reviews','Reviews'],['questions','Questions']].map(([slug,n])=><Link key={n} aria-current={(!tab&&!slug)||tab===slug?'page':undefined} to={paths(p.id)+(slug?'/'+slug:'')}>{n}</Link>)}</nav>
 {tab==='reviews'||tab==='questions'?<Discussion p={p} kind={tab}/>:tab==='offers'?<section className="vc-talk"><h2>Available offers</h2><div className="vc-offer"><Link to={'/store/'+slugify(p.seller)}>{p.seller}</Link><strong>{money(v.price)}</strong><button className="vc-button" disabled={!v.stock} onClick={()=>add(item)}>Add to bag</button></div></section>:<section className="vc-talk"><h2>Specifications</h2><dl className="vc-spec">{Object.entries(specs).map(([k,val])=><div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl></section>}
 {related.length>0&&<section><h2>More in {p.category}</h2><div className="vc-grid vc-wide">{related.map(p=><Card key={p.id} p={p} add={add} wish={wish}/>)}</div></section>}</>
}
function Compare({inventory,add}:{inventory:Product[];add:Actions['add']}){const [ids,set]=useState(load<string[]>('compare',[]));const list=ids.map(id=>inventory.find(p=>p.id===id)).filter((v):v is Product=>!!v);return <><Crumbs items={[[ 'Compare products','']]}/><h1>Compare products</h1>{!list.length?<Empty heading="Your comparison is empty" text="Open any product and select Add to comparison. You can compare up to four products side by side."/>:<div className="vc-compare-wrap"><table className="vc-compare"><thead><tr><th>Product</th>{list.map(p=><th key={p.id}><Link to={paths(p.id)}><Image src={p.image} name={p.name}/>{p.name}</Link><button className="vc-textbtn" onClick={()=>{const next=ids.filter(x=>x!==p.id);persist('compare',next);set(next)}}>Remove</button></th>)}</tr></thead><tbody>{['Price','Brand','Category','Seller',...new Set(list.flatMap(p=>Object.keys(p.attributes)))].map(k=><tr key={k}><th>{k}</th>{list.map(p=><td key={p.id}>{k==='Price'?money(p.price):k==='Brand'?p.brand:k==='Category'?p.category:k==='Seller'?p.seller:p.attributes[k]||'—'}</td>)}</tr>)}<tr><th>Shop</th>{list.map(p=><td key={p.id}><button className="vc-button" disabled={!p.stock} onClick={()=>add(p)}>Add to bag</button></td>)}</tr></tbody></table></div>}</>}
export default function CatalogRoutes({add,wish}:CatalogProps){
 const location=useLocation(),inventory=useInventory();const [top,id='',tab='']=location.pathname.split('/').filter(Boolean).map(s=>{try{return decodeURIComponent(s)}catch{return s}});
 const p=top==='product'?inventory.find(p=>p.id===id):undefined;
 const valid=['shop','department','category','search','brand','store','deals','flash-sale','campaign','best-sellers','new-arrivals','recently-viewed'];
 return <main className="vc frame">{top==='departments'?<Departments/>:top==='brands'||top==='stores'?<Directory key={top} stores={top==='stores'} inventory={inventory}/>:top==='compare'?<Compare inventory={inventory} add={add}/>:p?<Details key={p.id} {...{p,inventory,add,wish,tab}}/>:valid.includes(top)?<Listing key={top+'/'+id} {...{inventory,top,id,add,wish}}/>:<Empty heading="Page unavailable" text="Explore departments to find your next purchase."/>}</main>
}
