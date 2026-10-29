/** Original tiny 16px wildlife sprites, cached as canvases.
 * Frames animate wings, hops and tiny glow, without external images.
 */
const PALETTES=Object.freeze({
 butterfly:["#cf95be","#eac5dc","#5b496a"],robin:["#b88460","#eacb99","#5a483d"],
 honeybee:["#d6aa5a","#f4d684","#544836"],ladybug:["#bc6d62","#eeaaa3","#553f3c"],
 dragonfly:["#8cb5c8","#d2edef","#476b79"],frog:["#74a776","#b7d3a4","#3d7653"],
 carp:["#a6abb5","#f0d29b","#5c7a80"],firefly:["#f4d17d","#fff4b8","#6e7f55"],
 owl:["#8e806d","#d6c8a5","#63584d"],squirrel:["#ba8e68","#e5ba8e","#715441"],
 fieldmouse:["#aaa29b","#e8d5ca","#756c71"],wren:["#9e937e","#e8dbbd","#665846"],
 lunamoth:["#9abdb1","#e0e8cb","#637f79"],glowbug:["#a2ab8d","#f4edb3","#778a67"],
});
function block(ctx,x,y,w,h,color){
 ctx.fillStyle=color;ctx.fillRect(x,y,Math.max(1,w),Math.max(1,h));
}
function paintWildlife(ctx,id,frame){
 const [base,highlight,dark]=PALETTES[id]||PALETTES.butterfly;
 const up=frame%2===0?0:2;
 if(["butterfly","lunamoth"].includes(id)){
   block(ctx,2,3+up,5,7,base);block(ctx,9,3+up,5,7,base);
   block(ctx,1,9-up,6,4,highlight);block(ctx,9,9-up,6,4,highlight);
   block(ctx,7,3,2,11,dark);block(ctx,6,1,1,4,dark);block(ctx,9,1,1,4,dark);
   block(ctx,4,5+up,2,2,highlight);block(ctx,10,5+up,2,2,highlight);
 }else if(id==="honeybee"){
   block(ctx,3,5+up,5,4,highlight);block(ctx,8,3+up,5,5,highlight);
   block(ctx,3,8,11,5,base);block(ctx,6,8,2,5,dark);block(ctx,11,8,2,5,dark);
   block(ctx,12,9,2,2,dark);
 }else if(id==="ladybug"){
   block(ctx,3,6,10,8,dark);block(ctx,4,5,8,7,base);
   block(ctx,7,5,2,8,dark);block(ctx,5,7,2,2,dark);block(ctx,10,7,2,2,dark);
   block(ctx,6,3,5,4,dark);
 }else if(id==="dragonfly"){
   block(ctx,7,4,2,11,dark);
   block(ctx,3,5+up,6,2,highlight);block(ctx,8,5+up,6,2,highlight);
   block(ctx,2,8-up,6,2,base);block(ctx,8,8-up,6,2,base);
   block(ctx,6,2,4,4,base);
 }else if(id==="frog"){
   block(ctx,2,8,12,6,base);block(ctx,4,5,8,7,highlight);
   block(ctx,4,3,3,4,base);block(ctx,9,3,3,4,base);
   block(ctx,5,5,1,2,dark);block(ctx,10,5,1,2,dark);
   block(ctx,1,11+up,4,3,base);block(ctx,11,11+up,4,3,base);
 }else if(id==="carp"){
   block(ctx,2,7,11,5,base);block(ctx,5,5,5,8,highlight);
   block(ctx,1,4+up,4,5,base);block(ctx,1,10-up,4,5,base);
   block(ctx,12,8,2,2,dark);block(ctx,6,5,3,2,dark);
 }else if(id==="firefly"||id==="glowbug"){
   block(ctx,6,6,5,7,dark);block(ctx,7,5,3,6,base);
   block(ctx,7,11,3,3,highlight);block(ctx,2,4-up,5,4,highlight);
   block(ctx,10,4-up,5,4,highlight);
   if(frame%2===0){block(ctx,6,2,4,2,highlight);block(ctx,7,0,2,4,highlight);}
 }else if(id==="squirrel"){
   block(ctx,2,5+up,5,10,base);block(ctx,3,4+up,5,5,highlight);
   block(ctx,8,6,6,8,base);block(ctx,10,3,3,5,highlight);
   block(ctx,10,7,2,2,dark);block(ctx,8,11,2,3,dark);
 }else if(id==="fieldmouse"){
   block(ctx,2,6,5,5,base);block(ctx,8,6,5,5,base);
   block(ctx,3,9,10,5,highlight);block(ctx,4,4,4,5,base);
   block(ctx,10,4,4,5,base);block(ctx,5,9,2,2,dark);
   block(ctx,10,9,2,2,dark);block(ctx,8,12,2,2,dark);
 }else{
   // Robin / wren / owl with distinctive head, feet and wing beats.
   block(ctx,4,5+up,9,9,base);block(ctx,5,3+up,8,7,highlight);
   block(ctx,3,10+up,6,5,base);block(ctx,10,10+up,5,4,base);
   block(ctx,8,6+up,2,2,dark);block(ctx,13,8+up,3,2,"#e7ac77");
   if(id==="owl"){
     block(ctx,4,1+up,4,5,base);block(ctx,11,1+up,4,5,base);
     block(ctx,6,7,2,3,dark);block(ctx,11,7,2,3,dark);
   }else{
     block(ctx,4,9+up,4,5,frame%2?highlight:base);
   }
   block(ctx,6,14,2,2,dark);block(ctx,10,14,2,2,dark);
 }
}
export function createWildlifeSpriteAtlas(doc){
 if(!doc?.createElement)throw new TypeError("Document required for wildlife sprites");
 const cache=new Map();
 function frame(species,cycle=0){
   const id=PALETTES[species]?species:"butterfly",step=((Math.floor(cycle)%4)+4)%4;
   const key=id+":"+step;
   if(cache.has(key))return cache.get(key);
   const canvas=doc.createElement("canvas");canvas.width=canvas.height=16;
   const ctx=canvas.getContext("2d");
   if(!ctx)throw new Error("Wildlife 2D rendering unavailable");
   paintWildlife(ctx,id,step);
   cache.set(key,canvas);
   return canvas;
 }
 return {frame,stats:()=>({cachedFrames:cache.size,species:Object.keys(PALETTES).length})};
}
