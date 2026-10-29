/**
 * Bloomodoro / Phase 4D — original Polished JRPG pixel art.
 *
 * A hand-authored 48x64 character system (4 directions, 6 motion/idle frames)
 * with a unified botanical palette, outfit layering and readable silhouettes.
 * All art is generated and cached locally; existing wearable IDs and saves remain
 * unchanged. This is actual in-game pixel artwork, not the large concept poster.
 */
import { WEARABLES } from "./life-core.mjs";

export const AVATAR_ART_STYLE = Object.freeze({
  name: "Bloomodoro Polished JRPG",
  width: 48, height: 64, frames: 6,
  outline: "#4c3c38", shadow: "#8b7465",
});
const W = AVATAR_ART_STYLE.width, H = AVATAR_ART_STYLE.height;
const COLOR = new Map(WEARABLES.map(item => [item.id, item.color]));
const INK = AVATAR_ART_STYLE.outline;
const SKIN = "#f4c5a3";
const SKIN_SHADOW = "#d99480";
const SKIN_LIGHT = "#ffe1be";
const CREAM = "#fff0d6";
const GOLD = "#e8c785";
const STEEL = "#b6d0b0";
const CLOAKS = Object.freeze({
  "outfit-linen": { base: "#547361", light: "#849d75", dark: "#3f5b50", trim: "#ddc594", lining: "#f5e5ca" },
  "outfit-forest": { base: "#3e6954", light: "#709678", dark: "#2a4c43", trim: "#d8b783", lining: "#dbcfb0" },
  "outfit-garden": { base: "#88715f", light: "#ba967a", dark: "#685448", trim: "#f1c6a2", lining: "#fff1d6" },
  "outfit-starlight": { base: "#646c91", light: "#9e9dbd", dark: "#464d74", trim: "#e8d8aa", lining: "#e7deeb" },
});
function block(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function cross(ctx,x,y,size,color) {
  block(ctx,x+size,y,1,size*3+1,color);
  block(ctx,x,y+size,size*3+1,1,color);
}
function flower(ctx,x,y,petal="#f4d6c5",center=GOLD) {
  block(ctx,x+2,y,3,2,petal);
  block(ctx,x,y+2,2,3,petal);
  block(ctx,x+5,y+2,2,3,petal);
  block(ctx,x+2,y+5,3,2,petal);
  block(ctx,x+2,y+2,3,3,center);
  block(ctx,x+3,y+3,1,1,CREAM);
}
function leaf(ctx,x,y) {
  block(ctx,x,y+2,7,3,"#426750");
  block(ctx,x+1,y,4,4,"#80a581");
  block(ctx,x+3,y+1,3,2,"#adca9b");
}
function drawBoots(ctx, shoe, stride, stance, palette) {
  const boot = COLOR.get(shoe) || "#795a4c";
  const off = stance==="walk" ? [0,-2,0,2,-1,1][stride] : 0;
  // Stockings with thin cuff, two separate feet and buckled leather.
  for(const [x,dy] of [[15,off],[28,-off]]) {
    block(ctx,x,47+dy,6,7,INK);
    block(ctx,x+1,47+dy,4,6,"#f7e5d5");
    block(ctx,x-1,52+dy,9,8,INK);
    block(ctx,x,53+dy,7,6,boot);
    block(ctx,x+1,54+dy,3,1,GOLD);
    block(ctx,x-1,59+dy,10,2,"#644a3d");
  }
}
function drawCape(ctx,palette,stride,walking,side) {
  const sway = walking ? [-1,0,2,1,-2,0][stride] : 0;
  const x = side==="left" ? 4 : 7;
  // Flowing forest-green cloak broken into thick 2px-edged petals.
  block(ctx,x,29,35,14,INK);
  block(ctx,x+2,30,31,16,palette.base);
  block(ctx,x+1+sway,42,8,10,palette.dark);
  block(ctx,x+2+sway,48,7,5,palette.base);
  block(ctx,35-sway,38,8,13,palette.dark);
  block(ctx,35-sway,47,8,5,palette.base);
  block(ctx,x+4,34,2,13,palette.light);
  block(ctx,36-sway,40,2,11,palette.light);
  block(ctx,10+sway,51,27,3,palette.trim);
  for(let xx=12;xx<37;xx+=5)block(ctx,xx+sway,51,2,2,CREAM);
  if(palette===CLOAKS["outfit-starlight"]) {
    cross(ctx,8,41,1,GOLD);cross(ctx,36,40,1,CREAM);
    block(ctx,37,47,2,2,GOLD);
  } else {
    for(const [px,py]of [[8,39],[37,44],[10,47]]) {
      block(ctx,px,py,2,3,"#afd0a1");block(ctx,px+2,py+1,2,2,palette.trim);
    }
  }
}
function drawDress(ctx,palette,outfit,frame) {
  const hem = outfit==="outfit-starlight" ? "#dcd6e8" : "#f8e8ce";
  block(ctx,12,31,25,20,INK);
  block(ctx,13,31,23,19,hem);
  block(ctx,17,33,15,7,CREAM);
  block(ctx,15,40,20,12,CREAM);
  block(ctx,13,48,25,4,"#ddc4a5");
  block(ctx,13,50,25,2,hem);
  block(ctx,17,31,3,11,SKIN_LIGHT);
  block(ctx,30,31,3,11,SKIN_LIGHT);
  block(ctx,22,31,6,16,palette.base);
  block(ctx,23,33,4,13,palette.dark);
  block(ctx,20,39,14,2,palette.trim);
  block(ctx,19,40,16,2,INK);
  block(ctx,20,41,14,2,"#936c4b");
  block(ctx,31,39,2,3,GOLD);
  // Embroidered botanical hems: small but distinct between outfits.
  for(let i=0;i<4;i++){
    const x=16+i*6;
    block(ctx,x,47,2,2,palette.base);
    block(ctx,x+1,46,1,2,palette.light);
    block(ctx,x+3,49,2,1,palette.trim);
  }
  if(outfit==="outfit-garden") {
    flower(ctx,21,42,"#e7a7a4",GOLD);
  }else if(outfit==="outfit-starlight"){
    cross(ctx,22,43,1,GOLD);
  }else{
    leaf(ctx,24,43);
  }
}
function drawSatchel(ctx,side,frame){
  const x=side==="left"?6:36;
  const lift=frame===2?1:0;
  block(ctx,x,38+lift,9,12,INK);
  block(ctx,x+1,39+lift,7,10,"#865b43");
  block(ctx,x+1,39+lift,7,3,"#b78661");
  block(ctx,x+4,43+lift,2,3,GOLD);
  block(ctx,x+2,48+lift,5,1,"#c49b75");
  flower(ctx,x+1,35+lift,"#eee3c5","#dcb981");
  block(ctx,side==="left"?14:30,30,2,11,"#aa815b");
}
function drawHeadAndHair(ctx,hair,hat,direction,step,pose,bounce) {
  const hairColor = COLOR.get(hair)||"#6f4e3b";
  const highlights = {
    "hair-natural":"#ac8267","hair-chestnut":"#d9a07b",
    "hair-silver":"#f4eee4","hair-bloom":"#f6bdc8"
  };
  const hairHighlight=highlights[hair]||"#b18b70";
  const hairShadow=hair==="hair-silver"?"#9ba0a0":hair==="hair-bloom"?"#af738b":"#483c3b";
  const side=direction==="left"||direction==="right";
  const swish=pose==="walk" ? [0,1,2,0,-2,-1][step] : 0;
  const bob=pose==="walk"?bounce:pose==="idle"&&step===4?-1:0;
  // Unmistakable long, layered JRPG hair silhouette, visible behind the cape.
  block(ctx,9,15+bob,28,26,INK);
  block(ctx,8+swish,31+bob,9,14,INK);
  block(ctx,9+swish,32+bob,7,14,hairColor);
  block(ctx,32-swish,29+bob,9,18,INK);
  block(ctx,33-swish,30+bob,7,16,hairColor);
  block(ctx,11+swish,36+bob,4,9,hairHighlight);
  block(ctx,36-swish,35+bob,2,10,hairHighlight);
  // Head shape and ears: distinct tapered jaw with warm skin and blush.
  block(ctx,12,13+bob,25,21,INK);
  block(ctx,13,14+bob,23,18,SKIN);
  block(ctx,14,16+bob,21,14,SKIN_LIGHT);
  block(ctx,15,29+bob,19,4,SKIN);
  block(ctx,18,32+bob,13,2,SKIN_SHADOW);
  block(ctx,10,22+bob,5,8,SKIN);
  block(ctx,35,22+bob,5,8,SKIN);
  // Cascading highlights / side pony strands and curved bangs.
  block(ctx,11,10+bob,27,8,INK);
  block(ctx,12,8+bob,25,10,hairColor);
  block(ctx,15,6+bob,20,7,hairColor);
  block(ctx,16,7+bob,17,4,hairHighlight);
  block(ctx,13,15+bob,6,11,hairColor);
  block(ctx,17,13+bob,8,5,hairColor);
  block(ctx,27,13+bob,8,5,hairColor);
  block(ctx,32,15+bob,6,9,hairColor);
  block(ctx,17,17+bob,4,5,hairHighlight);
  block(ctx,31,17+bob,3,6,hairShadow);
  block(ctx,12,20+bob,3,8,hairShadow);
  if(hair==="hair-chestnut"){
    block(ctx,20,15+bob,6,5,hairHighlight);
    block(ctx,10+swish,42+bob,6,3,hairColor);
  }else if(hair==="hair-silver"){
    block(ctx,13,10+bob,5,3,CREAM);
    block(ctx,36-swish,39+bob,3,5,CREAM);
  }else if(hair==="hair-bloom"){
    block(ctx,14,12+bob,5,3,"#ffe6e0");
    block(ctx,38-swish,43+bob,2,3,"#f9ccd6");
  }
  // Face is always readable, even at native resolution.
  if(direction!=="up"){
    const blink=pose!=="walk"&&step===5;
    if(side){
      const eyeX=direction==="left"?17:30;
      block(ctx,eyeX-1,23+bob,5,2,hairShadow);
      if(blink){
        block(ctx,eyeX,25+bob,4,1,INK);
      }else{
        block(ctx,eyeX,23+bob,4,6,INK);
        block(ctx,eyeX+1,24+bob,2,3,"#a57258");
        block(ctx,eyeX+1,24+bob,1,2,CREAM);
      }
      block(ctx,direction==="left"?15:33,29+bob,3,2,"#ebaaa0");
    }else{
      for(const x of [18,29]){
        block(ctx,x-1,22+bob,7,2,hairShadow);
        if(blink){
          block(ctx,x,26+bob,5,1,INK);
        }else{
          block(ctx,x,23+bob,5,7,INK);
          block(ctx,x+1,24+bob,3,4,"#965d4c");
          block(ctx,x+2,24+bob,2,2,CREAM);
          block(ctx,x+1,28+bob,3,1,"#d9a38f");
        }
      }
      block(ctx,15,28+bob,3,2,"#eda4a0");
      block(ctx,34,28+bob,3,2,"#eda4a0");
      block(ctx,25,30+bob,3,1,"#a36b61");
    }
  }else {
    block(ctx,14,17+bob,22,15,hairColor);
    block(ctx,16,19+bob,6,9,hairHighlight);
    block(ctx,30,19+bob,4,11,hairShadow);
  }
  // Botanical ribbon, leaves and a small floral hair ornament.
  block(ctx,10,8+bob,7,5,"#43644e");
  leaf(ctx,8,7+bob);
  flower(ctx,8,11+bob,"#f4d4c9",GOLD);
  flower(ctx,14,7+bob,"#f5ece1","#efb782");
  if(hat==="hat-straw"){
    block(ctx,7,10+bob,34,5,INK);
    block(ctx,8,10+bob,32,3,"#d8b778");
    block(ctx,12,4+bob,24,9,"#eacb8a");
    block(ctx,14,3+bob,20,4,"#f8dda2");
    block(ctx,13,11+bob,23,2,"#967355");
    flower(ctx,31,5+bob,"#f4c3af",GOLD);
  }else if(hat==="hat-flower"){
    block(ctx,10,6+bob,27,4,"#477451");
    for(const x of [10,18,26]){
      flower(ctx,x,4+bob,x===18?"#ffede0":"#edb9bb",GOLD);
    }
  }else if(hat==="hat-star"){
    block(ctx,10,11+bob,28,5,"#5b5784");
    block(ctx,13,7+bob,23,6,"#9291b8");
    block(ctx,19,1+bob,17,8,"#a6a4cc");
    block(ctx,27,0+bob,6,4,"#e4d6f7");
    cross(ctx,27,6+bob,1,GOLD);
  }
}
export function createAvatarSpriteAtlas(doc) {
  if(!doc?.createElement)throw new TypeError("A document is required for sprite canvases");
  const cache=new Map();
  function frame(equipped={},direction="down",index=0,pose="idle"){
    const ids={
      hair:COLOR.has(equipped?.hair)?equipped.hair:"hair-natural",
      outfit:COLOR.has(equipped?.outfit)?equipped.outfit:"outfit-linen",
      hat:COLOR.has(equipped?.hat)?equipped.hat:"hat-none",
      shoes:COLOR.has(equipped?.shoes)?equipped.shoes:"shoes-travel",
    };
    const facing=["down","up","left","right"].includes(direction)?direction:"down";
    const step=((Math.floor(Number.isFinite(index)?index:0)%6)+6)%6;
    const state=pose==="walk"?"walk":"idle";
    const key=[ids.hair,ids.outfit,ids.hat,ids.shoes,facing,state,step].join(":");
    if(cache.has(key))return cache.get(key);
    const canvas=doc.createElement("canvas");canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Avatar canvas 2D context is required");
    const cape=CLOAKS[ids.outfit];
    const bounce=state==="walk"?[-1,0,1,0,-1,0][step]:0;
    const side=facing==="left"?"left":"right";
    // Shadow, layered cape, boots, embroidered skirt, hair & face, accessories.
    block(ctx,12,61,25,2,"rgba(32,40,30,.23)");
    drawBoots(ctx,ids.shoes,step,state,cape);
    drawCape(ctx,cape,step,state==="walk",side);
    drawDress(ctx,cape,ids.outfit,step);
    block(ctx,9,31+bounce,7,12,INK);
    block(ctx,10,32+bounce,5,10,CREAM);
    block(ctx,36,31+bounce,6,12,INK);
    block(ctx,37,32+bounce,4,10,CREAM);
    block(ctx,10,39+bounce,5,4,SKIN);
    block(ctx,37,39+bounce,4,4,SKIN);
    block(ctx,19,29+bounce,11,6,SKIN_LIGHT);
    block(ctx,17,32+bounce,15,3,cape.dark);
    block(ctx,18,33+bounce,14,2,cape.trim);
    flower(ctx,21,32+bounce,"#f5d7cb","#e3bb76");
    drawSatchel(ctx,side,step);
    drawHeadAndHair(ctx,ids.hair,ids.hat,facing,step,state,bounce);
    cache.set(key,canvas);
    return canvas;
  }
  return {frame,stats:()=>({cachedFrames:cache.size,style:AVATAR_ART_STYLE.name})};
}
export function drawAvatarPreview(canvas,atlas,equipped){
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=false;
  const sprite=atlas.frame(equipped,"down",0);
  const height=Math.min(canvas.height*.87,canvas.width*.83*H/W);
  const width=height*W/H;
  ctx.drawImage(sprite,Math.round((canvas.width-width)/2),Math.round((canvas.height-height)/2),width,height);
}
