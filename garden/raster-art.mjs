/**
 * Bloomodoro Phase 4F — actual image-file based B reference artwork.
 * These paths resolve from the PWA document root, also when this module is
 * imported from garden/. No SVG shapes or dynamic data URI is generated here.
 *
 * The art sheet currently includes front idle, right walk and front surprise.
 * Up/back and customized costume art have NOT been painted yet. Returning null
 * deliberately falls back to the previous illustration renderer so we never
 * falsely display the default costume over a different purchased one.
 */
export const RASTER_AVATAR_ASSETS = Object.freeze({
  idle: "./assets/art/avatar/base/idle-down.png",
  walk: "./assets/art/avatar/base/walk-right.png",
  surprised: "./assets/art/avatar/base/surprised-down.png",
  portrait: "./assets/art/avatar/portraits/portrait.webp",
});
export const RASTER_AVATAR_SOURCE_SIZE = Object.freeze({ width:224, height:280 });
const DEFAULT_EQUIPPED = Object.freeze({
  hair:"hair-natural",outfit:"outfit-linen",hat:"hat-none",shoes:"shoes-travel",
});
export function canUseRasterAvatar(equipped){
  const e=equipped??{};
  return Object.entries(DEFAULT_EQUIPPED).every(([slot,id])=>(e[slot]??id)===id);
}
export function rasterAvatarPreviewUrl(equipped){
  return canUseRasterAvatar(equipped)?RASTER_AVATAR_ASSETS.idle:null;
}
export function rasterAvatarPortraitUrl(equipped){
  return canUseRasterAvatar(equipped)?RASTER_AVATAR_ASSETS.portrait:null;
}
export function selectRasterAvatarAsset(equipped,direction="down",pose="idle"){
  if(!canUseRasterAvatar(equipped))return null;
  const facing=["up","down","left","right"].includes(direction)?direction:"down";
  if(facing==="up")return null; // no painted back view yet
  if(pose==="surprised" || pose==="react"){
    return facing==="down"?{src:RASTER_AVATAR_ASSETS.surprised,flipX:false,pose:"surprised"}:null;
  }
  if(pose==="walk"){
    return {src:RASTER_AVATAR_ASSETS.walk,flipX:facing==="left",pose:"walk"};
  }
  // Use the same approved B front pose as a temporary side-idle stand-in,
  // rather than flashing to a completely different art style when a key lifts.
  // The manifest marks side-specific idle sheets as unfinished.
  return {src:RASTER_AVATAR_ASSETS.idle,flipX:facing==="left",pose:"idle"};
}
export function createRasterAvatarAtlas({
  ImageClass=globalThis.Image,
  onReady=()=>{},
  limit=8,
}={}){
  const cache=new Map();
  const capacity=Math.max(3,Math.min(12,Math.floor(Number.isFinite(limit)?limit:8)));
  function imageFor(src){
    if(typeof ImageClass!=="function")return null;
    let record=cache.get(src);
    if(!record){
      const image=new ImageClass();
      record={image,failed:false};
      cache.set(src,record);
      image.decoding="async";
      image.onload=()=>{if(cache.get(src)===record)onReady(src);};
      image.onerror=()=>{record.failed=true;};
      image.src=src;
      while(cache.size>capacity)cache.delete(cache.keys().next().value);
    }
    return !record.failed&&record.image.complete&&record.image.naturalWidth>0
      ?record.image:null;
  }
  function avatar(equipped={},direction="down",pose="idle"){
    const config=selectRasterAvatarAsset(equipped,direction,pose);
    if(!config)return null;
    const image=imageFor(config.src);
    return image?{image,flipX:config.flipX,source:config.src}:null;
  }
  function preload(){
    for(const src of Object.values(RASTER_AVATAR_ASSETS))imageFor(src);
  }
  return {avatar,preload,stats:()=>({cachedImages:cache.size,capacity})};
}
