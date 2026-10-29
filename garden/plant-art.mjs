/** Original animated 32px plants.
 * Shared four-stage plants from garden-core are rendered without changing their
 * credited-focus growth thresholds or saved planting time.
 */
const FLOWERS=Object.freeze({
 daisy:      {stem:"#5b9b67",leaf:"#7cbd7f",petal:"#fff7e4",heart:"#efc968",height:20},
 rose:       {stem:"#59875b",leaf:"#80a75e",petal:"#dc7784",heart:"#ffc4a3",height:23},
 tulip:      {stem:"#5f9c5c",leaf:"#91bf69",petal:"#f0a0bc",heart:"#ffd4aa",height:24},
 clover:     {stem:"#448650",leaf:"#69b979",petal:"#83ca8f",heart:"#e2efb4",height:16},
 lavender:   {stem:"#608c67",leaf:"#85b07d",petal:"#9d90d7",heart:"#d4bce9",height:25},
 hydrangea:  {stem:"#4f9a6b",leaf:"#87b87e",petal:"#9eb9e5",heart:"#f5d7bc",height:22},
 sunflower:  {stem:"#578c54",leaf:"#83af64",petal:"#f9cd62",heart:"#674b36",height:27},
 lotus:      {stem:"#4d8b83",leaf:"#76b4a1",petal:"#f3b8c4",heart:"#ffeac0",height:18},
 starflower: {stem:"#6b7a9a",leaf:"#8ebfa6",petal:"#e0cdf5",heart:"#fff5ad",height:24},
});
const paint=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))};
function roundFlower(ctx,cx,cy,palette,frame=0){
 const shake=frame%4===0?-1:frame%4===2?1:0;
 for(const [dx,dy] of [[-6,0],[5,0],[0,-6],[0,5],[-4,-4],[4,-4],[-4,4],[4,4]]){
   paint(ctx,cx+dx+(dy>0?shake:0),cy+dy,6,6,palette.petal);
 }
 paint(ctx,cx-1,cy-1,5,5,palette.heart);
 paint(ctx,cx,cy,2,2,"#fff2b3");
}
function sprig(ctx,x,y,color,frame) {
 const offset=frame%4===0?-1:frame%4===2?1:0;
 paint(ctx,x-6,y+2,6,3,color);
 paint(ctx,x+1+offset,y+1,6,3,color);
 paint(ctx,x-4,y-1,4,2,color);
}
function drawPlant(ctx,species,stage,frame,night){
 const palette=FLOWERS[species]||FLOWERS.daisy;
 const seedColor="#755438";
 if(stage===0){
   paint(ctx,11,25,10,4,"#a18057");paint(ctx,14,22,5,4,seedColor);
   paint(ctx,14,25,4,2,"#d2a77e");return;
 }
 if(species==="lotus"){
   // Lily pad and pond flower live on buildable banks, never water tiles.
   paint(ctx,5,25,22,4,"#4a9f93");
   paint(ctx,8,22,17,6,palette.leaf);
   paint(ctx,20,22,6,4,"#76b8ae");
 }
 const height=stage===1?10:stage===2?Math.floor(palette.height*.7):palette.height;
 const top=27-height;
 paint(ctx,15,top,3,height+1,palette.stem);
 if(stage>=1) sprig(ctx,15,21,palette.leaf,frame);
 if(stage>=2) sprig(ctx,16,18,palette.leaf,frame);
 if(stage===1){
   paint(ctx,12,top,7,5,palette.leaf);paint(ctx,14,top-2,4,4,palette.stem);return;
 }
 if(stage===2){
   paint(ctx,12,top,10,7,palette.petal);
   paint(ctx,15,top-3,4,5,palette.heart);
   paint(ctx,11,top+6,11,2,palette.stem);
   return;
 }
 switch(species){
  case "daisy":roundFlower(ctx,14,top+5,palette,frame);break;
  case "rose":
    paint(ctx,10,top+1,13,11,palette.petal);
    paint(ctx,13,top-2,10,6,palette.petal);
    paint(ctx,12,top+4,6,5,palette.heart);
    paint(ctx,15,top+2,4,4,"#c25c70");
    break;
  case "tulip":
    paint(ctx,9,top+4,17,10,palette.petal);
    paint(ctx,9,top,5,10,palette.petal);
    paint(ctx,20,top,5,10,palette.petal);
    paint(ctx,15,top-1,5,10,"#d77d9d");
    paint(ctx,12,top+7,11,6,palette.petal);
    break;
  case "clover":
    for(const [dx,dy] of [[-7,-2],[3,-2],[-7,6],[3,6]]){
       paint(ctx,15+dx,top+dy+1,9,7,palette.petal);
       paint(ctx,18+dx,top+dy-1,4,4,palette.leaf);
    }
    paint(ctx,15,top+7,4,4,palette.heart);break;
  case "lavender":
    for(let i=0;i<5;i++){
      const stagger=i%2?3:-1;
      paint(ctx,12+stagger,top+i*3,9,5,i%2?palette.petal:palette.heart);
    }
    paint(ctx,16,top-2,4,5,palette.petal);break;
  case "hydrangea":
    for(const [dx,dy] of [[-7,6],[-4,0],[2,-3],[7,3],[-2,10],[5,10]]){
      paint(ctx,15+dx,top+dy,8,8,palette.petal);
      paint(ctx,18+dx,top+dy+3,3,3,palette.heart);
    }
    break;
  case "sunflower":
    for(const [dx,dy] of [[-9,1],[8,1],[-6,-7],[4,-7],[-6,9],[4,9],[0,-10],[0,11]]){
      paint(ctx,14+dx,top+dy+4,6,7,palette.petal);
    }
    paint(ctx,10,top+1,12,12,palette.heart);
    for(let i=0;i<3;i++)paint(ctx,12+i*3,top+3+(i%2)*3,2,2,"#a17a47");
    break;
  case "lotus":
    paint(ctx,10,top+7,14,7,palette.petal);
    paint(ctx,8,top+1,7,10,palette.petal);
    paint(ctx,19,top+1,7,10,palette.petal);
    paint(ctx,13,top-3,8,13,"#f9d5d5");
    paint(ctx,16,top+3,3,6,palette.heart);
    break;
  case "starflower":
    for(const [dx,dy] of [[0,-10],[-9,-2],[8,-2],[-5,8],[5,8]]){
      paint(ctx,14+dx,top+dy+3,6,10,palette.petal);
    }
    paint(ctx,14,top+3,7,7,palette.heart);
    if(night){for(const [x,y] of [[5,4],[25,7],[26,18],[8,20]]){
      paint(ctx,x,y,2,3,"#fdf1ae");paint(ctx,x-1,y+1,4,1,"#f6eebc");
    }}
    break;
 }
 // Petals glint from the wind in just a few frames, without changing growth.
 if(frame%4===2 && species!=="clover")paint(ctx,25,top+3,2,3,palette.petal);
}
export function createPlantSpriteAtlas(doc){
 if(!doc?.createElement)throw new TypeError("A canvas document is required");
 const cache=new Map();
 function frame(species,stage=0,animationFrame=0,night=false){
   const flower=FLOWERS[species]?species:"daisy";
   const growth=Math.max(0,Math.min(3,Math.floor(stage)));
   const animation=((Math.floor(animationFrame)%4)+4)%4;
   const key=[flower,growth,animation,Boolean(night)].join(":");
   if(cache.has(key))return cache.get(key);
   const canvas=doc.createElement("canvas");canvas.width=canvas.height=32;
   const ctx=canvas.getContext("2d");
   if(!ctx)throw new Error("Plant sprite requires Canvas 2D");
   drawPlant(ctx,flower,growth,animation,night);
   cache.set(key,canvas);
   return canvas;
 }
 return {frame,stats:()=>({cachedFrames:cache.size,plants:Object.keys(FLOWERS).length})};
}
export function drawPlantThumbnail(canvas,atlas,species){
 if(!canvas)return;
 const ctx=canvas.getContext("2d");
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(atlas.frame(species,3,0,false),0,0,canvas.width,canvas.height);
}
