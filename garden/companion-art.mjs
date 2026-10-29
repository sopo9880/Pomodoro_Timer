/**
 * Bloomodoro Phase 4D — original botanical JRPG companions.
 *
 * The six persistent species IDs are unchanged; silhouettes, shading, emotion
 * and 4-direction 6-frame pixel art are deliberately species-specific.
 */
const W=48, H=48;
export const COMPANION_ART_STYLE=Object.freeze({width:W,height:H,frames:6,style:"Polished JRPG"});
const COLORS=Object.freeze({
 sprout:  {ink:"#345449",body:"#76b783",light:"#c6dea2",shade:"#50866a",blush:"#edaba0",accent:"#91c97c"},
 mushroom:{ink:"#604b52",body:"#f1dfc0",light:"#fff2da",shade:"#d2b7a7",blush:"#eeaaa0",accent:"#ca8088"},
 cat:     {ink:"#65493d",body:"#e2ad75",light:"#f8d9a5",shade:"#b97a56",blush:"#e8a096",accent:"#d6a66c"},
 sparrow: {ink:"#5c5049",body:"#af8a67",light:"#e7d3a2",shade:"#856148",blush:"#efaea2",accent:"#f9edcb"},
 turtle:  {ink:"#3e6557",body:"#84b28b",light:"#c6d9ad",shade:"#5f8467",blush:"#e9a69a",accent:"#9a815f"},
 fox:     {ink:"#674a40",body:"#dd9b73",light:"#f8d4aa",shade:"#b46b52",blush:"#f2aaa2",accent:"#f4bb78"},
});
function block(ctx,x,y,w,h,color){
  ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
}
function blossom(ctx,x,y,color="#f4c7c6"){
  block(ctx,x+2,y,3,3,color);block(ctx,x,y+2,3,3,color);block(ctx,x+4,y+2,3,3,color);
  block(ctx,x+2,y+4,3,3,color);block(ctx,x+3,y+3,2,2,"#ffe8a6");
}
function face(ctx,c,facing,frame,emotion,top=0){
  if(facing==="up")return;
  const surprised=emotion==="surprised"||emotion==="wiggle",happy=emotion==="happy";
  const blink=emotion==="idle"&&frame===5;
  if(facing==="right"){
    if(happy)block(ctx,31,21+top,7,2,c.ink);
    else if(surprised) {block(ctx,31,18+top,5,7,c.ink);block(ctx,32,19+top,2,4,"#fff6e2");}
    else if(blink)block(ctx,32,23+top,5,1,c.ink);
    else{block(ctx,31,19+top,6,6,c.ink);block(ctx,33,19+top,2,3,"#fff6e2");}
    block(ctx,35,27+top,4,2,c.blush);
    return;
  }
  for(const eyeX of [16,29]){
    if(happy) {
      block(ctx,eyeX,23+top,6,2,c.ink);
      block(ctx,eyeX+2,21+top,2,2,c.ink);
    }else if(surprised){
      block(ctx,eyeX,18+top,6,8,c.ink);
      block(ctx,eyeX+2,19+top,2,4,"#fff6e2");
    }else if(blink) block(ctx,eyeX,23+top,6,1,c.ink);
    else {
      block(ctx,eyeX,19+top,6,7,c.ink);
      block(ctx,eyeX+2,20+top,3,4,"#93634d");
      block(ctx,eyeX+2,20+top,2,2,"#fff6e2");
    }
  }
  block(ctx,13,27+top,4,2,c.blush);
  block(ctx,36,27+top,4,2,c.blush);
  if(surprised){
    block(ctx,25,28+top,4,5,c.ink);
    block(ctx,26,29+top,2,3,"#b27672");
  }else if(happy){
    block(ctx,24,29+top,5,2,c.ink);
    block(ctx,25,30+top,3,1,c.blush);
  }else{
    block(ctx,25,29+top,3,1,c.ink);
  }
}
function drawSpecies(ctx,species,direction,activity,frame,emotion){
  const c=COLORS[species]||COLORS.sprout;
  const held=activity==="picked",walk=activity==="walk";
  const bounce=held?(frame%2?-1:-4):walk?[-1,0,1,0,-1,0][frame]:0;
  const facing=direction==="left"?"right":direction;
  ctx.save();
  if(direction==="left"){ctx.translate(W,0);ctx.scale(-1,1);}
  // No appearance can collapse into the same rectangle: unique silhouettes.
  block(ctx,11,42,27,3,"rgba(25,49,32,.22)");
  const leg=walk?[0,2,-1,1,-2,0][frame]:0;
  block(ctx,14+leg,37+bounce,7,7,c.ink);
  block(ctx,29-leg,37-bounce,7,7,c.ink);
  block(ctx,15+leg,38+bounce,5,5,c.shade);
  block(ctx,30-leg,38-bounce,5,5,c.shade);
  if(species==="cat"||species==="fox"){
    // Large curving fluffy tail is distinctive at native size.
    block(ctx,35,25+bounce,10,6,c.ink);
    block(ctx,38,17+bounce,8,13,c.body);
    block(ctx,42,18+bounce,4,7,c.light);
    if(species==="fox")block(ctx,39,19+bounce,6,5,"#fbe3cd");
  }
  if(species==="sparrow"){
    block(ctx,11,22+bounce,26,17,c.ink);
    block(ctx,13,23+bounce,22,14,c.body);
    const up=activity==="flutter"||held ? (frame%2?9:3):0;
    block(ctx,5,24+bounce-up,12,12,c.shade);
    block(ctx,33,24+bounce-up,12,12,c.shade);
    block(ctx,6,26+bounce-up,10,5,c.light);
    block(ctx,35,26+bounce-up,9,5,c.light);
  }else if(species==="turtle"){
    block(ctx,8,24+bounce,34,17,c.ink);
    block(ctx,10,22+bounce,30,18,c.accent);
    block(ctx,14,23+bounce,22,13,c.shade);
    block(ctx,21,24+bounce,9,11,c.accent);
    for(const [x,y]of [[14,27],[30,27],[22,36]])block(ctx,x,y+bounce,7,3,c.light);
  }else {
    block(ctx,11,23+bounce,26,17,c.ink);
    block(ctx,13,23+bounce,22,15,c.body);
    block(ctx,17,26+bounce,14,8,c.light);
    block(ctx,8,27+bounce,8,10,c.shade);
    block(ctx,34,27+bounce,8,10,c.shade);
  }
  // Bigger expressive head with a warm, hand-shaded face.
  block(ctx,9,12+bounce,32,22,c.ink);
  block(ctx,11,13+bounce,28,19,c.body);
  block(ctx,13,16+bounce,24,14,c.light);
  block(ctx,14,27+bounce,21,5,c.body);
  // Every species carries a botanical story within its silhouette.
  if(species==="sprout"){
    block(ctx,23,7+bounce,4,10,c.ink);
    block(ctx,9,7+bounce,16,8,c.ink);
    block(ctx,11,5+bounce,14,7,c.body);
    block(ctx,12,7+bounce,10,4,c.light);
    block(ctx,25,4+bounce,15,7,c.ink);
    block(ctx,27,3+bounce,12,6,c.body);
    block(ctx,29,4+bounce,8,3,c.light);
    blossom(ctx,7,12+bounce);
  }else if(species==="mushroom"){
    block(ctx,5,13+bounce,38,8,c.ink);
    block(ctx,7,8+bounce,34,11,c.accent);
    block(ctx,12,4+bounce,25,8,c.accent);
    block(ctx,18,3+bounce,13,4,"#e9aeb1");
    for(const [x,y]of [[13,10],[26,6],[35,12]]){
      block(ctx,x,y+bounce,7,4,c.light);
      block(ctx,x+2,y+1+bounce,3,2,"#fff8e8");
    }
    block(ctx,9,19+bounce,31,3,c.shade);
  }else if(species==="cat"||species==="fox"){
    block(ctx,9,4+bounce,11,16,c.ink);
    block(ctx,31,4+bounce,11,16,c.ink);
    block(ctx,11,7+bounce,7,9,c.body);
    block(ctx,33,7+bounce,7,9,c.body);
    block(ctx,13,8+bounce,3,7,c.blush);
    block(ctx,35,8+bounce,3,7,c.blush);
    if(species==="fox"){
      block(ctx,17,28+bounce,17,6,c.light);
      block(ctx,23,31+bounce,5,2,c.ink);
    }else{
      block(ctx,20,30+bounce,12,3,c.light);
      for(const x of [9,35])block(ctx,x,27+bounce,6,1,c.ink);
    }
  }else if(species==="sparrow"){
    block(ctx,15,11+bounce,25,7,c.shade);
    block(ctx,20,9+bounce,17,6,c.body);
    block(ctx,15,30+bounce,22,7,c.light);
    block(ctx,39,24+bounce,8,4,"#edba71");
    block(ctx,41,25+bounce,5,2,"#f9e5a8");
    blossom(ctx,10,12+bounce,"#e7c2af");
  }else if(species==="turtle"){
    block(ctx,16,9+bounce,20,8,c.ink);
    block(ctx,17,10+bounce,19,7,c.body);
    block(ctx,20,12+bounce,12,5,c.light);
    block(ctx,38,30+bounce,7,5,c.body);
    blossom(ctx,8,10+bounce,"#f5d2ae");
  }
  // Ears/feathers differ, but faces share one premium expression language.
  const expression=held?(frame%2?"wiggle":"surprised"):(emotion||(activity==="react"?"happy":"idle"));
  face(ctx,c,facing,frame,expression,bounce);
  if(held){
    block(ctx,5,23+(frame%2?-4:0),9,12,c.ink);
    block(ctx,7,24+(frame%2?-4:0),6,10,c.light);
    block(ctx,37,20+(frame%2?3:-2),8,12,c.ink);
    block(ctx,38,22+(frame%2?3:-2),6,9,c.light);
    block(ctx,41,7,3,8,c.blush);
    block(ctx,40,6,5,2,"#fff4e2");
  }else if(activity==="read"){
    block(ctx,16,34+bounce,20,10,c.ink);
    block(ctx,17,35+bounce,18,8,"#f7e7ca");
    block(ctx,25,35+bounce,2,8,c.shade);
  }else if(activity==="tend"){
    blossom(ctx,38,33+bounce,"#efbdc2");
  }else if(activity==="stargaze"){
    block(ctx,41,10+bounce,3,9,"#ffe7a3");
    block(ctx,38,13+bounce,9,3,"#fff5d6");
  }else if(activity==="sing"||activity==="perch"){
    block(ctx,40,7+bounce,2,9,c.ink);
    block(ctx,42,6+bounce,4,3,c.ink);
  }else if(activity==="nap"||activity==="rest"){
    block(ctx,39,8+bounce,5,2,c.ink);
    block(ctx,42,4+bounce,4,2,c.ink);
  }
  ctx.restore();
}
export function createCompanionSpriteAtlas(doc){
  if(!doc?.createElement)throw new TypeError("A document is required for companion sprites");
  const cache=new Map();
  function frame(species,direction="down",activity="idle",index=0,reaction=null){
    const kind=COLORS[species]?species:"sprout";
    const facing=["down","up","left","right"].includes(direction)?direction:"down";
    const pose=typeof activity==="string"&&/^[a-z]+$/.test(activity)?activity:"idle";
    const emotion=["happy","surprised","wiggle"].includes(reaction)?reaction:null;
    const step=((Math.floor(Number.isFinite(index)?index:0)%6)+6)%6;
    const key=[kind,facing,pose,emotion||"",step].join(":");
    if(cache.has(key))return cache.get(key);
    const canvas=doc.createElement("canvas");canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Companion sprites need canvas 2D");
    drawSpecies(ctx,kind,facing,pose,step,emotion);
    cache.set(key,canvas);
    return canvas;
  }
  return {frame,stats:()=>({cachedFrames:cache.size,species:Object.keys(COLORS).length})};
}
export function drawCompanionThumbnail(canvas,atlas,species){
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=false;
  const image=atlas.frame(species,"down","idle",0);
  const size=Math.min(canvas.width,canvas.height)*.87;
  ctx.drawImage(image,(canvas.width-size)/2,(canvas.height-size)/2,size,size);
}
