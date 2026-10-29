/** Original layered 32x48 player avatar (4 directions / 4 walking frames). */
import { WEARABLES } from "./life-core.mjs";
const palette=new Map(WEARABLES.map(x=>[x.id,x.color]));
const paint=(ctx,x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
export function createAvatarSpriteAtlas(doc){
  if(!doc?.createElement)throw new Error("Canvas document is required");
  const cache=new Map();
  function frame(equipped={},direction="down",step=0){
    const outfit=equipped.outfit||"outfit-linen",hair=equipped.hair||"hair-natural";
    const hat=equipped.hat||"hat-none",shoes=equipped.shoes||"shoes-travel";
    const facing=["up","down","left","right"].includes(direction)?direction:"down";
    const animation=((Math.floor(step)%4)+4)%4;
    const key=[outfit,hair,hat,shoes,facing,animation].join(":");
    if(cache.has(key))return cache.get(key);
    const canvas=doc.createElement("canvas");
    canvas.width=32;canvas.height=48;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Avatar sprite requires 2D context");
    const robe=palette.get(outfit)||"#e4d0a5",locks=palette.get(hair)||"#6f4e3b";
    const boot=palette.get(shoes)||"#795a4c",cap=palette.get(hat)||"#f0ca83";
    const bounce=animation%2===0?-1:0,side=facing==="left"||facing==="right";
    const skin="#e9b48c",deep="#4c453a",glow="#fce2b9";
    paint(ctx,7,43,18,2,"rgba(20,30,24,.25)");
    // Leg movement: left/right pair alternates without changing map position.
    paint(ctx,10+(animation===1?2:0),34+bounce,5,10,boot);
    paint(ctx,18-(animation===3?2:0),34-bounce,5,10,boot);
    paint(ctx,8,24+bounce,17,13,deep);
    paint(ctx,9,23+bounce,15,12,robe);
    paint(ctx,11,25+bounce,11,2,glow);
    paint(ctx,5,25+bounce,5,10,skin);
    paint(ctx,24,25+bounce,5,10,skin);
    if(outfit==="outfit-starlight") {
      paint(ctx,6,24+bounce,3,15,"#605b93");
      paint(ctx,24,24+bounce,3,15,"#605b93");
      paint(ctx,8,36+bounce,18,3,robe);
    }
    if(outfit==="outfit-garden"){
      paint(ctx,13,29+bounce,4,4,"#f7e5ba");
      paint(ctx,17,27+bounce,3,4,"#f3b8bb");
    }
    // Hair volume under the brim and a rounded face, ordered by direction.
    paint(ctx,7,7+bounce,19,20,locks);
    paint(ctx,9,10+bounce,15,15,skin);
    paint(ctx,9,8+bounce,17,5,locks);
    paint(ctx,8,12+bounce,4,12,locks);
    if(facing!=="up"){
      if(side){
        const eyeX=facing==="left"?11:20;
        paint(ctx,eyeX,17+bounce,2,3,deep);
        paint(ctx,facing==="left"?11:22,21+bounce,2,2,"#d88983");
      }else{
        paint(ctx,12,17+bounce,2,3,deep);
        paint(ctx,20,17+bounce,2,3,deep);
        paint(ctx,10,21+bounce,3,2,"#e6a093");
        paint(ctx,21,21+bounce,3,2,"#e6a093");
        paint(ctx,16,21+bounce,2,1,deep);
      }
    }
    if(hat!=="hat-none"){
      if(hat==="hat-straw"){
        paint(ctx,3,8+bounce,27,4,"#966b41");
        paint(ctx,6,4+bounce,21,7,cap);
        paint(ctx,9,2+bounce,15,4,cap);
        paint(ctx,9,9+bounce,17,2,"#d89870");
      }else if(hat==="hat-flower"){
        paint(ctx,7,7+bounce,20,4,"#648b5d");
        for(const x of [8,14,21]){
          paint(ctx,x,3+bounce,6,6,cap);
          paint(ctx,x+2,4+bounce,2,2,"#fff2b0");
        }
      }else{
        paint(ctx,7,5+bounce,20,6,cap);
        paint(ctx,12,0+bounce,13,7,cap);
        paint(ctx,16,1+bounce,3,7,"#f9e7b2");
        paint(ctx,5,9+bounce,24,3,"#726fa7");
      }
    }
    if(facing==="up")paint(ctx,12,9+bounce,12,9,locks);
    cache.set(key,canvas);
    return canvas;
  }
  return {frame,stats:()=>({cachedFrames:cache.size})};
}
export function drawAvatarPreview(canvas,atlas,equipped){
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=false;
  const art=atlas.frame(equipped,"down",0);
  const targetWidth=Math.min(canvas.width*.7,canvas.height*32/48*.95);
  const targetHeight=targetWidth*48/32;
  ctx.drawImage(art,(canvas.width-targetWidth)/2,(canvas.height-targetHeight)/2,targetWidth,targetHeight);
}
