type Listing = {id:string;name:string;brand:string;price:number;stock:number;variants?:{price:number;stock:number}[]};
const filler=new Set('i a an the here can could you me my we please just need want show find looking for in on do have has any with of is are to buy available stock open budget model specific no it them ones your store and under below than less rs pkr max maximum cheapest which one those these'.split(' '));
function words(text:string){return text.toLowerCase().replace(/\biapd\b/g,'ipad').replace(/\bi\s+pad\b/g,'ipad').match(/[a-z0-9]+/g)||[]}
export function storeLookup(message:string,prior:string[],inventory:Listing[]){
 const follow=/\b(open budget|any model|show me any|any will do|which of (those|these)|cheapest one|no preference)\b/i.test(message);
 const original=follow?[...prior].reverse().find(q=>words(q).some(w=>!filler.has(w))):message;
 if(!original)return null;
 const priceText=follow&&!/open budget/i.test(message)?original+' '+message:message;
 const ceiling=priceText.replaceAll(',','').match(/(?:under|below|less than|max(?:imum)?)\s*(?:pkr|rs\.?)?\s*(\d+)/i);
 const keys=words(original.replace(/(?:under|below|less than|max(?:imum)?)\s*(?:pkr|rs\.?)?\s*[\d,]+/ig,'')).filter(w=>!filler.has(w));
 if(!keys.length||keys.length>9)return null;
 const matches=inventory.flatMap(p=>{
   const name=words(p.name+' '+p.brand);
   if(!keys.every(k=>name.some(n=>n===k||n===k+'s'||n+'s'===k)))return [];
   if(!/case|cover|protector|adapter|cable|charger|band|strap/i.test(keys.join(' '))&&/\b(case|cover|protector|adapter|cable|charger) for\b/i.test(p.name))return [];
   const prices=(p.variants?.length?p.variants:[p]).filter(v=>v.stock>0&&(!ceiling||v.price<=Number(ceiling[1]))).map(v=>v.price);
   return prices.length?[{id:p.id,name:p.name,price:Math.min(...prices)}]:[];
 }).sort((a,b)=>a.price-b.price);
 if(!matches.length)return null;
 const items=matches.slice(0,4);
 return {answer:'Here '+(items.length===1?'is a matching listing':'are matching listings')+' on Veyra, starting at Rs. '+items[0].price.toLocaleString('en-PK')+'. Select a product below to see its details.',products:items,sources:items.map(p=>({label:p.name+' · Rs. '+p.price.toLocaleString('en-PK'),url:'/product/'+encodeURIComponent(p.id)}))};
}
