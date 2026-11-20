import branchesJSON from './catalog/branches.json' with { type: 'json' };
import names from './catalog/departmentNames.json' with { type: 'json' };
import featuredJSON from './catalog/featured.json' with { type: 'json' };

export interface Variant { id: string; label: string; price: number; stock: number; attributes: Record<string,string> }
export interface Product {
  id: string; name: string; brand: string; department: string; category: string; departmentSlug: string; categorySlug: string; group: string;
  image: string; price: number; oldPrice: number; stock: number; rating: number; seller: string; variants: Variant[];
  description: string; attributes: Record<string,string>; popularity: number; sequence: number; variantId?: string; variantLabel?: string;
}
export interface Leaf { name: string; slug: string; image: string }
export interface Department { name: string; slug: string; image: string; groups: {name:string;leaves:Leaf[]}[] }
type RawBranch=[number,string,string,string];
export type RawProduct=[string,string,string,number,string,number,number,Record<string,string>,number];
export const slugify = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const formatter = new Intl.NumberFormat('en-PK',{maximumFractionDigits:0});
export const money = (v: number) => 'Rs. '+formatter.format(v);
const rawBranches=branchesJSON as RawBranch[];
export const departments: Department[]=names.map(name=>({name,slug:slugify(name),image:'',groups:[]}));
const branchSlugs=new Set<string>();
const branchMap=rawBranches.map(([dept,group,category,image])=>{
  const department=departments[dept];
  let g=department.groups.find(x=>x.name===group);
  if(!g){g={name:group,leaves:[]};department.groups.push(g);}
  let key=department.slug+'-'+slugify(group)+'-'+slugify(category);
  while(branchSlugs.has(key))key+='-2';
  branchSlugs.add(key);
  g.leaves.push({name:category,slug:key,image});
  if(!department.image)department.image=image;
  return {department,category,group,key};
});
const namesOfSellers=['Arcade Supply','Harbour Market','Meridian Goods','Foundry Stores','Lahore Collective','The Supply Room','Karachi Trading','Northline Market','Atlas Retail','Indus Select'];
const featuredOptions:Record<string,[string,string[]]>={
 'studio-headphones':['Finish',['Graphite','Mist']], 'arc-watch':['Strap size',['18 mm','20 mm','22 mm']], 'pace-runner':['EU size',['39','40','41','42','43','44']],
 'field-camera':['Bundle',['Camera only','Travel kit']], 'form-lounge':['Upholstery',['Linen','Bouclé']], 'daypack':['Capacity',['18 L','24 L']],
 'line-sunglasses':['Lens',['Smoke','Gradient']], 'dusk-parfum':['Volume',['50 ml','100 ml']]
};
export function unpackProduct([id,name,brand,bi,image,price,oldPrice,attributes,rating]: RawProduct,i:number):Product {
 const {department,category,group,key}=branchMap[bi];
 let h=0;for(const c of id)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;
 const stock=h%27+1;
 const attrs={...attributes};
 const seller=namesOfSellers[h%namesOfSellers.length];
 let options=featuredOptions[id];
 if(!options && !attrs.Size && /clothing|footwear/i.test(department.name))options=department.slug==='footwear'?['Size',['39','40','41','42','43']]:['Size',['S','M','L','XL']];
 if(!options && id.startsWith('d') && category==='Smartphones' && /Samsung|Apple/.test(brand))options=['Storage',['128 GB','256 GB']];
 const variants=(options?options[1]:['Standard']).map((label,n)=>{
   const density=options && ['Volume','Storage','Capacity','Bundle'].includes(options[0]);
   return {id:id+'-v'+(n+1),label,price:density?Math.round((price*(1+n*.23))/10)*10:price,stock:Math.max(0,stock-n),attributes:options?{...attrs,[options[0]]:label}:attrs};
 });
 return {id,name,brand,group,department:department.name,category,departmentSlug:department.slug,categorySlug:key,image,price:variants[0].price,oldPrice,
 stock:variants.reduce((a,v)=>a+v.stock,0),seller,variants,description:name+' is available in our '+category.toLowerCase()+' collection, supplied by '+seller+'. See the listed specifications and choose an available option before adding it to your bag.',
 attributes:attrs,rating:rating || 0,popularity:h%9999,sequence:i};
}
export const featuredProducts:Product[]=(featuredJSON as RawProduct[]).map(unpackProduct);
