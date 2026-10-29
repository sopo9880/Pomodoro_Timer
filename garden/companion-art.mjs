/**
 * Original hand-coded 32px sprites. Four directions, 4 walking/idle/action
 * frames for each of six companion species; no remote/licensed art.
 */
const PALETTES = Object.freeze({
  sprout: {outline:"#27453a",body:"#73ae78",light:"#b4db96",dark:"#518e61",cheek:"#ec9c8d",accent:"#a1cf8d"},
  mushroom: {outline:"#4c3e3e",body:"#f1d9b5",light:"#fff0d3",dark:"#ccac92",cheek:"#d8857d",accent:"#cf8389"},
  cat: {outline:"#5d4334",body:"#e1a065",light:"#fbd29a",dark:"#b97146",cheek:"#ed998a",accent:"#f6c684"},
  sparrow: {outline:"#4e5148",body:"#b68b6a",light:"#e8cb94",dark:"#825d46",cheek:"#e9a28a",accent:"#fff0c9"},
  turtle: {outline:"#385747",body:"#7eab7a",light:"#c2d3a0",dark:"#537c5c",cheek:"#d89b8e",accent:"#9e7d58"},
  fox: {outline:"#604634",body:"#d18a67",light:"#ffe0af",dark:"#a75b46",cheek:"#e7a4a0",accent:"#f8dfb0"},
});
const TILE = 32;
const pixel=(ctx,x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
function drawFace(ctx,direction,frame,colors,offset=0){
  if(direction==="up")return;
  const eyeY=12+offset;
  if(direction==="left" || direction==="right"){
    const eyeX=direction==="left"?11:20;
    pixel(ctx,eyeX,eyeY,2,3,colors.outline);
    if(frame%4===3)pixel(ctx,eyeX,eyeY+1,3,1,colors.dark);
    pixel(ctx,direction==="left"?9:23,eyeY+4,2,2,colors.cheek);
    return;
  }
  pixel(ctx,11,eyeY,2,3,colors.outline);
  pixel(ctx,19,eyeY,2,3,colors.outline);
  if(frame%4===3){
    pixel(ctx,10,eyeY+1,4,1,colors.outline);
    pixel(ctx,18,eyeY+1,4,1,colors.outline);
  }
  pixel(ctx,9,eyeY+4,2,2,colors.cheek);
  pixel(ctx,21,eyeY+4,2,2,colors.cheek);
  pixel(ctx,15,eyeY+5,2,1,colors.outline);
}
function drawFriend(ctx,species,direction,activity,frame){
  const c=PALETTES[species] || PALETTES.sprout;
  const walk=activity==="walk",held=activity==="picked",react=activity==="react",
    nap=activity==="nap"||activity==="rest";
  const flip=direction==="left";
  const nudge=walk?(frame===1?-1:frame===3?1:0):nap?2:0;
  ctx.save();
  if(flip){ctx.translate(32,0);ctx.scale(-1,1);}
  const facing=flip?"right":direction;
  const bounce=held?(frame%2===0?-3:2):walk&&frame%2===0?-1:activity==="hop"&&frame%2===0?-2:0;
  // Directional legs, tail, shadow
  pixel(ctx,9,28,14,2,"rgba(28,46,37,.27)");
  pixel(ctx,10+(walk&&frame%2?2:0),24+nudge,4,5,c.dark);
  pixel(ctx,19-(walk&&frame%2?2:0),24-nudge,4,5,c.dark);
  if(species==="cat"||species==="fox"){
    pixel(ctx,22,18+bounce,7,5,c.outline);
    pixel(ctx,24,17+bounce,5,4,c.body);
    if(species==="fox")pixel(ctx,26,15+bounce,3,5,c.light);
  }
  // Body silhouette, with species-specific colors/limbs.
  pixel(ctx,8,16+bounce,17,11,c.outline);
  pixel(ctx,10,16+bounce,13,9,c.body);
  pixel(ctx,12,19+bounce,9,6,c.light);
  if(species==="sparrow"){
    pixel(ctx,5,16+bounce,9,7,c.dark);pixel(ctx,20,16+bounce,9,7,c.dark);
    if(activity==="flutter"||activity==="walk"){
      const up=frame%2?4:0;
      pixel(ctx,4,12+bounce-up,7,7,c.body);pixel(ctx,23,12+bounce-up,7,7,c.body);
    }
  }else if(species==="turtle"){
    pixel(ctx,7,15+bounce,19,12,c.dark);
    pixel(ctx,9,14+bounce,15,10,c.accent);
    for(const [x,y] of [[12,17],[19,18],[15,22]])pixel(ctx,x,y+bounce,4,3,c.dark);
  }else{
    pixel(ctx,7,17+bounce,4,6,c.body);
    pixel(ctx,22,17+bounce,4,6,c.body);
  }
  // Head, ears and plant/mushroom features.
  pixel(ctx,7,8+bounce,18,12,c.outline);
  pixel(ctx,9,9+bounce,14,10,c.light);
  if(species==="sprout"){
    pixel(ctx,15,2+bounce,3,8,c.dark);
    pixel(ctx,8,2+bounce,10,5,c.body);
    pixel(ctx,8,4+bounce,6,3,c.light);
    pixel(ctx,17,1+bounce,9,6,c.body);
    pixel(ctx,20,2+bounce,6,3,c.light);
  }else if(species==="mushroom"){
    pixel(ctx,4,6+bounce,24,6,c.outline);
    pixel(ctx,6,3+bounce,20,8,c.accent);
    pixel(ctx,10,1+bounce,13,5,c.accent);
    pixel(ctx,12,4+bounce,5,3,c.light);
    pixel(ctx,21,7+bounce,4,2,c.light);
  }else if(species==="cat"||species==="fox"){
    pixel(ctx,7,3+bounce,7,8,c.outline);pixel(ctx,19,3+bounce,7,8,c.outline);
    pixel(ctx,9,5+bounce,3,5,species==="fox"?c.cheek:c.body);
    pixel(ctx,21,5+bounce,3,5,species==="fox"?c.cheek:c.body);
    if(species==="fox"){
      pixel(ctx,12,14+bounce,9,4,c.light);
      pixel(ctx,15,17+bounce,3,2,c.outline);
    }
  }else if(species==="sparrow"){
    pixel(ctx,14,6+bounce,7,4,c.dark);
    pixel(ctx,22,12+bounce,5,3,"#d9a26d");
    pixel(ctx,12,16+bounce,10,6,c.light);
  }else if(species==="turtle"){
    pixel(ctx,9,7+bounce,14,5,c.body);
    pixel(ctx,11,8+bounce,10,4,c.light);
  }
  drawFace(ctx,facing,frame,c,bounce);
  // Short activities: each partner displays its own simple tell.
  if(held){
    // Each companion wiggles its limbs, while its face looks surprised.
    pixel(ctx,4,frame%2===0?11:14,5,8,c.body);
    pixel(ctx,25,frame%2===0?14:10,5,8,c.body);
    pixel(ctx,12,11+bounce,3,4,c.outline);
    pixel(ctx,20,11+bounce,3,4,c.outline);
    pixel(ctx,16,17+bounce,3,3,c.outline);
    pixel(ctx,27,3+bounce,2,6,c.cheek);
  }else if(react){
    pixel(ctx,26,4+bounce,4,5,c.cheek);
    pixel(ctx,25,5+bounce,6,2,c.light);
  }else if(activity==="read"){
    pixel(ctx,10,21+bounce,13,6,"#f2e4c4");
    pixel(ctx,10,21+bounce,6,6,"#8aa48d");
    pixel(ctx,16,21+bounce,1,6,c.outline);
  }else if(activity==="tend"){
    pixel(ctx,24,21+bounce,6,4,"#a5c8a7");
    pixel(ctx,25,19+bounce,4,3,"#d7efcc");
    pixel(ctx,5,26+bounce,2,3,c.dark);
  }else if(activity==="sing"||activity==="perch"){
    pixel(ctx,26,4+bounce,2,6,c.dark);
    pixel(ctx,29,3+bounce,2,2,c.dark);
  }else if(activity==="stargaze"){
    pixel(ctx,26,4+bounce,4,6,"#f8e6ad");
    pixel(ctx,24,6+bounce,8,2,"#f8e6ad");
  }else if(activity==="flutter"){
    pixel(ctx,4,6+bounce,3,5,c.light);
    pixel(ctx,25,6+bounce,3,5,c.light);
  }else if(nap){
    pixel(ctx,26,6+bounce,4,2,c.dark);
    pixel(ctx,27,4+bounce,3,2,c.dark);
    pixel(ctx,28,2+bounce,3,2,c.dark);
  }else if(activity==="observe"||activity==="watch"){
    pixel(ctx,27,8+bounce,3,3,"#fbdf9a");
  }else if(activity==="stretch"){
    pixel(ctx,4,15+bounce,4,3,c.body);
    pixel(ctx,24,15+bounce,4,3,c.body);
  }
  ctx.restore();
}
export function createCompanionSpriteAtlas(doc) {
  if(!doc?.createElement)throw new TypeError("A document is required for sprite canvases");
  const cache=new Map();
  function frame(species,direction="down",activity="idle",index=0){
    const safeSpecies=PALETTES[species]?species:"sprout";
    const facing=["down","up","left","right"].includes(direction)?direction:"down";
    const step=((Math.floor(index)%4)+4)%4;
    const action=typeof activity==="string"&&/^[a-z]+$/.test(activity)?activity:"idle";
    const key=[safeSpecies,facing,action,step].join(":");
    if(cache.has(key))return cache.get(key);
    const canvas=doc.createElement("canvas");canvas.width=canvas.height=TILE;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Companion sprite requires 2D context");
    drawFriend(ctx,safeSpecies,facing,action,step);
    cache.set(key,canvas);
    return canvas;
  }
  return {frame,stats:()=>({cachedFrames:cache.size,species:Object.keys(PALETTES).length})};
}
export function drawCompanionThumbnail(canvas, atlas, species){
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas.frame(species,"down","idle",0),0,0,canvas.width,canvas.height);
}
