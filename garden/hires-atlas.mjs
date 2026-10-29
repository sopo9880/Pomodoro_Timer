/**
 * B-look illustration image loader. Pure local SVG data URIs and a bounded
 * decoded-image cache avoid any network dependency or external image host.
 * Fall back to original atlas until the async image is decoded, including
 * in Node tests where global Image is not defined.
 */
import { avatarIllustrationSvg, AVATAR_HIRES_SIZE } from "./hires-avatar.mjs";
import { companionIllustrationSvg, wildlifeIllustrationSvg,
  ILLUSTRATED_COMPANIONS, ILLUSTRATED_WILDLIFE } from "./hires-companions.mjs";

export { AVATAR_HIRES_SIZE, ILLUSTRATED_COMPANIONS, ILLUSTRATED_WILDLIFE };
export const HIGH_RES_ART_STYLE = Object.freeze({
  name:"Bloomodoro B / Botanical Polished JRPG",
  avatar:[320,432],companion:[256,256],wildlife:[256,256],
  allSpecies:ILLUSTRATED_COMPANIONS.length+ILLUSTRATED_WILDLIFE.length,
});
export function illustrationUri(markup) {
  if(typeof markup!=="string"||!markup.startsWith("<svg")||!markup.endsWith("</svg>"))
    throw new TypeError("An SVG image is required");
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(markup);
}
export function avatarIllustrationUri(equipped,direction="down",pose="idle",frame=0){
  return illustrationUri(avatarIllustrationSvg(equipped,direction,pose,frame));
}
export function companionIllustrationUri(species,direction="down",activity="idle",frame=0,reaction=null){
  return illustrationUri(companionIllustrationSvg(species,direction,activity,frame,reaction));
}
export function wildlifeIllustrationUri(species,frame=0){
  return illustrationUri(wildlifeIllustrationSvg(species,frame));
}
const normalizedFrame=frame=>Math.abs(Math.floor(Number.isFinite(frame)?frame:0))%3;
export function createHighResolutionAtlas({ImageClass=globalThis.Image,onReady=()=>{},limit=96}={}){
  const capacity=Math.max(16,Math.min(192,Math.floor(limit)));
  const cache=new Map();
  function get(key,makeMarkup){
    if(typeof ImageClass!=="function")return null;
    let image=cache.get(key);
    if(!image){
      image=new ImageClass();
      image.decoding="async";
      image.onload=()=>{if(cache.get(key)===image)onReady(key);};
      image.onerror=()=>{if(cache.get(key)===image)cache.delete(key);};
      cache.set(key,image);
      image.src=illustrationUri(makeMarkup());
      if(cache.size>capacity)cache.delete(cache.keys().next().value);
    }else{
      cache.delete(key);
      cache.set(key,image);
    }
    return image.complete&&image.naturalWidth>0 ? image : null;
  }
  function avatar(equipped={},direction="down",pose="idle",frame=0){
    const n=normalizedFrame(frame),e=equipped||{};
    const key=["avatar",e.hair||"hair-natural",e.outfit||"outfit-linen",
      e.hat||"hat-none",e.shoes||"shoes-travel",direction,pose,n].join(":");
    return get(key,()=>avatarIllustrationSvg(e,direction,pose,n));
  }
  function companion(species="sprout",direction="down",activity="idle",frame=0,reaction=null){
    const state=activity==="picked"?"picked":activity==="walk"?"walk":
      reaction==="happy"||activity==="react"?"happy":"idle";
    const n=normalizedFrame(frame);
    const key=["friend",species,direction,state,n,reaction||""].join(":");
    return get(key,()=>companionIllustrationSvg(species,direction,state,n,reaction));
  }
  function wildlife(species,frame=0){
    const n=normalizedFrame(frame);
    return get("wildlife:"+species+":"+n,()=>wildlifeIllustrationSvg(species,n));
  }
  return {avatar,companion,wildlife,stats:()=>({cachedImages:cache.size,capacity})};
}
