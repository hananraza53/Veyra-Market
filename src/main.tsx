import {ProductImage} from './ProductImage';
import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Link,useLocation,useNavigate,useNavigationType} from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {Menu,ChevronDown,ChevronRight,Search,Heart,ShoppingBag,UserRound,Moon,Sun,Truck,Tag,X,Check,SlidersHorizontal,Package,ShieldCheck,Store,ArrowUpRight,MapPin,Headset} from 'lucide-react';
import {departments,featuredProducts} from './homeData';
import type {Product} from './catalogData';
import './shell.css';
const Catalog=lazy(()=>import('./catalog')), Buyer=lazy(()=>import('./Buyer')), Ops=lazy(()=>import('./Operations'));
const Chat=lazy(()=>import('./Operations').then(m=>({default:m.Assistant})));
const fmt=(p:number)=>'Rs. '+p.toLocaleString('en-PK');
const preview=import.meta.env.VITE_DEMO_MODE==='true';
type Row={product:Product,quantity:number,variantId?:string};
function read<T,>(key:string,initial:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??initial}catch{return initial}}
function Brand(){return <Link className="brand-v" to="/" aria-label="Veyra Market home"><img src="/media/logo.png" alt=""/>veyra<span>market</span></Link>}
const groups=[
 ['Electronics','audio-wearables','electronics'],['Fashion','womens-clothing','fashion'],['Home & living','home-decor-lighting','home'],['Beauty','beauty-fragrance','beauty'],['Sports','sports-fitness','sports'],['Bags & travel','bags-luggage','bags'],['Watches','audio-wearables','watches'],['Kitchen','kitchen-dining','kitchen']
];
const slides=[
 {title:<>Sound in<br/><i>focus.</i></>,tag:'THE AUDIO EDIT',body:'Discover headphones, speakers and audio essentials.',cta:'Shop audio',path:'/department/audio-wearables',image:'/media/hero.webp'},
 {title:<>Everyday<br/><i>motion.</i></>,tag:'THE FOOTWEAR EDIT',body:'Explore trainers and sneakers for everyday wear.',cta:'Shop footwear',path:'/department/footwear',image:'/media/sneakers.jpg'},
 {title:<>Time, well<br/><i>spent.</i></>,tag:'THE WATCH EDIT',body:'Explore watches for your everyday rotation.',cta:'Explore watches',path:'/search?q=watch',image:'/media/watch.jpg'}];
function Home({wish,add,saved}:{wish:(p:Product)=>void,add:(p:Product)=>void,saved:Product[]}){
 const [slide,setSlide]=useState(0);const s=slides[slide];
 useEffect(()=>{const timer=window.setTimeout(()=>setSlide(i=>(i+1)%slides.length),5500);return()=>clearTimeout(timer)},[slide]);
 return <main className="vh-home frame">
 <section className={'vh-hero slide-'+slide}><div className="hero-layers" aria-hidden="true">{slides.map((v,i)=><div key={v.image} className={'hero-art art-'+i+(slide===i?' visible':'')} style={{backgroundImage:'url('+v.image+')'}}/>)}</div><div className="hero-tint"/><div className="vh-hero-copy" key={slide}><div className="vh-kicker"><i/> {s.tag}</div><h1>{s.title}</h1><p>{s.body}</p><Link className="vh-cta" to={s.path}>{s.cta}<ArrowUpRight size={16}/></Link></div><div className="hero-pager" aria-label="Featured collections">{slides.map((_,i)=><button key={i} aria-label={'Show collection '+(i+1)} aria-pressed={slide===i} onClick={()=>setSlide(i)}/>)}</div></section>
 <section className="vh-categories"><div className="vh-heading"><h2>Shop by department</h2><Link to="/departments">View all departments <ChevronRight size={15}/></Link></div><div className="vh-category-grid">{groups.map(([name,slug,img],i)=><Link to={name==='Watches'?'/search?q=watch':'/department/'+slug} key={name}><div className={'vh-tile tile-'+i}><img src={'/media/cat-'+img+'.webp'} alt="" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/media/'+(img==='fashion'?'sunglasses':img)+'.jpg'}}/></div><span>{name}</span></Link>)}</div></section>
 <section className="vh-offers"><div className="vh-heading"><div><div className="vh-kicker green"><i/> THE MARKET EDIT</div><h2>Deals worth a look</h2></div><Link to="/deals">Shop all deals <ChevronRight size={15}/></Link></div><div className="vh-products">{featuredProducts.slice(0,8).map(p=><article key={p.id}><Link to={'/product/'+p.id} className="vh-photo"><ProductImage src={p.image} name={p.name}/></Link>{p.oldPrice>p.price&&<span className="vh-discount">−{Math.round(100*(1-p.price/p.oldPrice))}%</span>}<button className="vh-fav" onClick={()=>wish(p)} aria-label={'Save '+p.name}><Heart size={17} fill={saved.some(x=>x.id===p.id)?'currentColor':'none'}/></button><small>{p.brand}</small><Link className="vh-name" to={'/product/'+p.id}>{p.name}</Link><div className="vh-price">{fmt(p.price)} {p.oldPrice>p.price&&<del>{fmt(p.oldPrice)}</del>}<button aria-label={'Add '+p.name+' to cart'} onClick={()=>add(p)}><ShoppingBag size={17}/></button></div></article>)}</div></section>
 <section className="vh-promo"><Tag size={29}/><div><h2>The welcome offer</h2><p>Take 10% off your basket with code <strong>WELCOME10</strong>.</p></div><Link to="/deals">Explore offers <ChevronRight size={15}/></Link></section>
 <section className="vh-services">{[[Truck,'Track your packages','/track'],[Tag,'Explore marketplace deals','/deals'],[Headset,'Visit the help center','/help']].map(([Icon,label,path]:any)=><Link key={label} to={path}><Icon size={22}/>{label}<ChevronRight size={16}/></Link>)}</section></main>
}
function App(){
 const [chat,setChat]=useState(false);
 const loc=useLocation(),nav=useNavigate(),path=loc.pathname,top=path.split('/')[1];
 const [q,setQ]=useState(''),[menu,setMenu]=useState(false),[active,setActive]=useState(0),[dark,setDark]=useState(document.documentElement.dataset.theme==='dark');
 const [cart,setCart]=useState<Row[]>(()=>read('veyra-cart',[])),[wishlist,setWish]=useState<Product[]>(()=>read('veyra-wishlist',[])),[notice,setNotice]=useState('');const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const navigation=useNavigationType(), positions=useRef(new Map<string,number>()),previous=useRef({path:loc.pathname,key:loc.key});
 const lenis=useRef<Lenis|null>(null);
 useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const l=new Lenis({autoRaf:true,duration:1.5,smoothWheel:true,wheelMultiplier:1.5,allowNestedScroll:true});lenis.current=l;return()=>l.destroy()},[]);
 useEffect(()=>{setMenu(false);setChat(false);const old=previous.current;positions.current.set(old.key,window.scrollY);if(old.path!==path||navigation==='POP'){const y=navigation==='POP'?(positions.current.get(loc.key)||0):0;window.requestAnimationFrame(()=>{lenis.current?.scrollTo(y,{immediate:true});window.scrollTo(0,y)})}previous.current={path,key:loc.key};document.title=(top?top.replaceAll('-',' ')+' · ':'')+'Veyra Market'},[loc.key]);
 useEffect(()=>{localStorage.setItem('veyra-cart',JSON.stringify(cart))},[cart]);useEffect(()=>{localStorage.setItem('veyra-wishlist',JSON.stringify(wishlist))},[wishlist]);
 useEffect(()=>{if(!menu)return;function esc(e:KeyboardEvent){if(e.key==='Escape')setMenu(false)}window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[menu]);
 function toast(s:string){setNotice(s);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setNotice(''),2200)}
 function add(p:Product){
   const selected=p.variants.find(option=>option.id===p.variantId)||p.variants[0];
   const product=selected?{...p,variantId:selected.id,variantLabel:selected.label,price:selected.price,stock:selected.stock}:p;
   const variantId=product.variantId,cap=Math.min(product.stock,99);
   const matches=(row:Row)=>row.product.id===product.id&&row.variantId===variantId;
   if((cart.find(matches)?.quantity||0)>=cap){toast('Stock limit reached');return}
   setCart(rows=>rows.some(matches)?rows.map(r=>matches(r)?{...r,quantity:Math.min(r.quantity+1,cap)}:r):[...rows,{product,quantity:1,variantId}]);
   toast('Added to your bag')
 }
 function wish(p:Product){const had=wishlist.some(x=>x.id===p.id);setWish(old=>had?old.filter(x=>x.id!==p.id):[...old,p]);toast(had?'Removed from wishlist':'Saved to wishlist')}
 function theme(){const value=!dark;setDark(value);document.documentElement.dataset.theme=value?'dark':'light';localStorage.setItem('veyra-theme',value?'dark':'light')}
 const cartCount=cart.reduce((a,b)=>a+b.quantity,0),dep=departments[active];
 const buyer=['cart','wishlist','checkout','login','register','verify','forgot','reset','account','orders','track','order-success'].includes(top);
 const ops=['seller','admin','help','assistant','about','contact','testimonials','privacy','terms','cookies','shipping','returns','payments','sell','support'].includes(top);
 return <><div key={loc.key} className="v-route-line" aria-hidden="true"/><div className="v-utility"><div className="frame"><span><MapPin size={13}/> Pakistan <b>·</b> PKR</span><div><Link to="/sell">Sell on Veyra</Link><Link to="/track"><Truck size={14}/> Track order</Link><Link to="/help">Help center</Link></div></div></div>
 <header className="v-head"><div className="frame v-mainnav"><Brand/><form role="search" onSubmit={e=>{e.preventDefault();if(q.trim())nav('/search?q='+encodeURIComponent(q.trim()))}}><Search size={18}/><input aria-label="Search products" placeholder="Search products, brands and more" value={q} onChange={e=>setQ(e.target.value)}/><button>Search</button></form><div className="v-actions"><button onClick={theme} aria-label="Switch theme">{dark?<Sun/>:<Moon/>}</button><Link to="/account" aria-label="Account"><UserRound/></Link><Link to="/wishlist" aria-label={'Wishlist, '+wishlist.length+' items'}><Heart fill={wishlist.length?'currentColor':'none'}/><b className="v-pop" key={wishlist.length}>{wishlist.length}</b></Link><Link to="/cart" aria-label={'Shopping bag, '+cartCount+' items'}><ShoppingBag/><b className="v-pop" key={cartCount}>{cartCount}</b></Link></div></div>
 <nav className="v-nav frame"><button className="v-dept" onClick={()=>setMenu(!menu)} aria-expanded={menu}><Menu size={18}/> All departments <ChevronDown size={14}/></button><Link className="nav-sale" to="/deals"><Tag size={15}/> Deals</Link><Link to="/best-sellers">Best sellers</Link><Link to="/new-arrivals">New arrivals</Link><Link to="/brands">Brands</Link><Link to="/stores">Stores</Link><Link className="nav-assist" to="/assistant"><Headset size={15}/> Shopping assistant</Link></nav>
 {menu&&<><button className="v-shade" aria-label="Close departments" onClick={()=>setMenu(false)}/><div className="v-mega frame" data-lenis-prevent><aside>{departments.map((d,i)=><button key={d.slug} className={active===i?'chosen':''} onFocus={()=>setActive(i)} onMouseEnter={()=>setActive(i)} onClick={()=>setActive(i)}>{d.name}<ChevronRight size={14}/></button>)}</aside><section><div className="vh-heading"><h2>{dep.name}</h2><Link to={'/department/'+dep.slug}>Shop all</Link></div><div className="v-mega-groups">{dep.groups.map(g=><div key={g.name}><strong>{g.name}</strong>{g.leaves.map(l=><Link key={l.slug} to={'/category/'+l.slug}>{l.name}</Link>)}</div>)}</div></section></div></>}</header>
 <Suspense fallback={<main className="frame v-loading" aria-label="Loading page"><div/><div/><div/></main>}>{!top?<Home {...{wish,add,saved:wishlist}}/>:buyer?<Buyer {...{cart,wishlist,add,wish,clearCart:()=>setCart([]),preview,setQuantity:(id:string,n:number,v?:string)=>setCart(rows=>rows.map(r=>r.product.id===id&&(!v||v===r.variantId)?{...r,quantity:Math.min(n,r.product.stock,99)}:r).filter(r=>r.quantity>0))}}/>:ops?<Ops/>:<Catalog {...{add,wish}}/>}</Suspense>
 <footer className="v-footer"><div className="frame"><Brand/><div>{[['Explore','Departments','/departments','Brands','/brands','Offers','/deals'],['Customer care','Track order','/track','Contact','/contact','Help center','/help'],['Veyra Market','About us','/about','Testimonials','/testimonials','Sell on Veyra','/sell']].map(([title,...links])=><section key={title}><strong>{title}</strong>{links.map((s,i)=>i%2===0&&<Link key={s} to={links[i+1]}>{s}</Link>)}</section>)}</div></div><div className="frame v-legal"><span>© Veyra Market</span><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms of service</Link><Link to="/cookies">Cookie preferences</Link></div></footer>
 {top!=='assistant'&&<div className="v-chatdock">{chat&&<section className="v-chatbox op-root" role="region" aria-label="Shopping assistant" data-lenis-prevent><button className="v-chat-close" aria-label="Close assistant" onClick={()=>setChat(false)}><X size={17}/></button><Suspense fallback={<p>Opening assistant…</p>}><Chat productId={top==='product'?path.split('/')[2]:undefined}/></Suspense></section>}<button className="v-chat-trigger" aria-expanded={chat} onClick={()=>setChat(v=>!v)}><Headset size={18}/> Ask Veyra</button></div>}
 {notice&&<div className="v-toast" role="status" key={notice}><Check size={18}/>{notice}</div>}</>
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>);
