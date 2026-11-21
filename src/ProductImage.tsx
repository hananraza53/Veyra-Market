import {useState} from 'react';
import replacements from './imageReplacements.json';

const replacementUrls: Record<string,string> = replacements;

function Photo({source,name,loading}:{source:string;name:string;loading:'eager'|'lazy'}) {
  const [attempt,setAttempt] = useState(0);
  const candidates = [source];
  const match = source.match(/^https:\/\/pisces\.bbystatic\.com\/.*\/(\d{7})_[a-z0-9]+\.jpg/i);
  if (match) {
    const sku = match[1];
    for (const view of ['sd','sa','ld']) {
      const url = 'https://pisces.bbystatic.com/image2/BestBuy_US/images/products/'+sku.slice(0,4)+'/'+sku+'_'+view+'.jpg;maxHeight=560;maxWidth=560';
      if (!candidates.includes(url)) candidates.push(url);
    }
  }
  const url = candidates[attempt];
  if (!url) return <span className="vc-fallback" role="img" aria-label={name}>{name}</span>;
  return <img key={url} src={url} alt={name} loading={loading} decoding="async"
    onError={()=>setAttempt(attempt+1)}
    onLoad={({currentTarget:image})=>{
      // The supplier's boxed warning graphic has a 150 by 157 pixel canvas.
      if (match && image.naturalWidth===150 && [156,157,158].includes(image.naturalHeight)) setAttempt(attempt+1);
    }}/>;
}
export function ProductImage({src,name,loading='lazy'}:{src:string;name:string;loading?:'eager'|'lazy'}) {
  const source = replacementUrls[src] || src;
  return <Photo key={source} source={source} name={name} loading={loading}/>;
}
