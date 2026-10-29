import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import {
  RASTER_AVATAR_ASSETS,RASTER_AVATAR_SOURCE_SIZE,canUseRasterAvatar,
  rasterAvatarPreviewUrl,rasterAvatarPortraitUrl,selectRasterAvatarAsset,
  createRasterAvatarAtlas,
} from "../garden/raster-art.mjs";
import { createGardenState, normalizeGardenState, creditGardenFocus } from "../garden/garden-core.mjs";

const files=[
  ["assets/art/avatar/base/idle-down.png","idle",224,280],
  ["assets/art/avatar/base/walk-right.png","walk",224,280],
  ["assets/art/avatar/base/surprised-down.png","surprised",224,280],
];
test("4F: real PNG frames are nonempty, transparent and use a common 224×280 canvas",()=>{
  assert.deepEqual(RASTER_AVATAR_SOURCE_SIZE,{width:224,height:280});
  for(const [path] of files){
    const asset=readFileSync(new URL("../"+path,import.meta.url));
    assert.ok(asset.length>10000 && asset.length<100000,path+" should contain original raster art");
    assert.equal(asset.subarray(0,8).toString("hex"),"89504e470d0a1a0a",path+" PNG magic");
    assert.equal(asset.subarray(12,16).toString("ascii"),"IHDR",path+" PNG header");
    assert.equal(asset.readUInt32BE(16),224);
    assert.equal(asset.readUInt32BE(20),280);
    const type=asset[25];
    assert.ok(type===3||type===6,"PNG must retain palette/RGBA color");
    if(type===3)assert.ok(asset.includes(Buffer.from("tRNS","ascii")),"Indexed PNG requires alpha transparency");
  }
});
test("4F: UI portrait is a real WebP file rather than code-drawn SVG",()=>{
  const file=readFileSync(new URL("../assets/art/avatar/portraits/portrait.webp",import.meta.url));
  assert.ok(file.length>20000&&file.length<90000);
  assert.equal(file.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(file.subarray(8,12).toString("ascii"),"WEBP");
  const manifest=JSON.parse(readFileSync(new URL("../assets/art/avatar/manifest.json",import.meta.url),"utf8"));
  assert.equal(manifest.version,1);
  assert.equal(manifest.assets.length,4);
  assert.equal(manifest.canvas.width,224);
  assert.ok(manifest.notYetProduced.length>0);
});
test("4F: raster selection is explicit and never overwrites purchased clothing",()=>{
  const original=createGardenState().avatar.equipped;
  assert.equal(canUseRasterAvatar(original),true);
  assert.equal(rasterAvatarPreviewUrl(original),RASTER_AVATAR_ASSETS.idle);
  assert.equal(rasterAvatarPortraitUrl(original),RASTER_AVATAR_ASSETS.portrait);
  assert.deepEqual(selectRasterAvatarAsset(original,"down","idle"),
    {src:RASTER_AVATAR_ASSETS.idle,flipX:false,pose:"idle"});
  assert.deepEqual(selectRasterAvatarAsset(original,"left","walk"),
    {src:RASTER_AVATAR_ASSETS.walk,flipX:true,pose:"walk"});
  assert.deepEqual(selectRasterAvatarAsset(original,"right","walk"),
    {src:RASTER_AVATAR_ASSETS.walk,flipX:false,pose:"walk"});
  assert.deepEqual(selectRasterAvatarAsset(original,"down","surprised"),
    {src:RASTER_AVATAR_ASSETS.surprised,flipX:false,pose:"surprised"});
  assert.equal(selectRasterAvatarAsset(original,"up","idle"),null);
  assert.deepEqual(selectRasterAvatarAsset(original,"left","idle"),
    {src:RASTER_AVATAR_ASSETS.idle,flipX:true,pose:"idle"});
  assert.deepEqual(selectRasterAvatarAsset(original,"right","idle"),
    {src:RASTER_AVATAR_ASSETS.idle,flipX:false,pose:"idle"});
  assert.equal(selectRasterAvatarAsset({...original,hair:"hair-silver"},"down","walk"),null);
  assert.equal(selectRasterAvatarAsset({...original,outfit:"outfit-starlight"},"down","idle"),null);
  assert.equal(rasterAvatarPreviewUrl({...original,hat:"hat-flower"}),null);
});
test("4F: asynchronous image loader uses bounded decoded assets and safe fallback",()=>{
  let requests=0,ready=0;
  class ImageStub{
    constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}
    set src(value){this._src=value;requests++;}
    get src(){return this._src;}
  }
  const atlas=createRasterAvatarAtlas({ImageClass:ImageStub,limit:3,onReady:()=>ready++});
  const equipped=createGardenState().avatar.equipped;
  assert.equal(atlas.avatar(equipped,"down","idle"),null);
  assert.equal(atlas.avatar(equipped,"down","idle"),null);
  assert.equal(requests,1);
  atlas.preload();
  assert.equal(atlas.stats().cachedImages,3);
  assert.equal(atlas.stats().capacity,3);
  assert.equal(atlas.avatar({...equipped,outfit:"outfit-forest"},"down","idle"),null);
  assert.equal(createRasterAvatarAtlas({ImageClass:null}).avatar(equipped),null);
});
test("4F: new raster source files are wired into canvas, wardrobe, focus and offline PWA",()=>{
  const world=readFileSync(new URL("../garden/pixel-world.mjs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../garden/garden-ui.mjs",import.meta.url),"utf8");
  const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
  const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
  assert.match(world,/rasterArt\.avatar/);
  assert.match(world,/reaction==="surprised"/);
  assert.match(world,/raster\?\.image/);
  assert.match(ui,/rasterAvatarPreviewUrl/);
  assert.match(ui,/rasterAvatarPortraitUrl/);
  assert.match(sw,/bloomodoro-cache-v18/);
  for(const path of [
    "garden/raster-art.mjs",...files.map(x=>x[0]),
    "assets/art/avatar/portraits/portrait.webp",
    "assets/art/avatar/manifest.json",
  ]){
    assert.ok(sw.includes(path),"Missing offline asset "+path);
  }
  assert.ok(ci.includes("node --check garden/raster-art.mjs"));
});
test("4F: raster art does not change earned focus or existing saved inventory",()=>{
  const original=creditGardenFocus(createGardenState(),63*60);
  const before=JSON.stringify(original);
  const atlas=createRasterAvatarAtlas({ImageClass:null});
  atlas.avatar(original.avatar.equipped,"down","idle");
  assert.equal(JSON.stringify(original),before);
  const normalized=normalizeGardenState(JSON.parse(JSON.stringify(original)));
  assert.equal(normalized.progress.focusSeconds,original.progress.focusSeconds);
  assert.equal(normalized.wallet.timePoints,original.wallet.timePoints);
  assert.deepEqual(normalized.avatar,original.avatar);
  assert.deepEqual(normalized.companions,original.companions);
});
