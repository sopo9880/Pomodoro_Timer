import test from "node:test";
import assert from "node:assert/strict";
import { createAvatarSpriteAtlas, AVATAR_ART_STYLE, drawAvatarPreview } from "../garden/avatar-art.mjs";
import { createCompanionSpriteAtlas, COMPANION_ART_STYLE, drawCompanionThumbnail } from "../garden/companion-art.mjs";
import { GARDEN_COMPANIONS } from "../garden/garden-core.mjs";
import { WEARABLES } from "../garden/life-core.mjs";

function fakeCanvas(){
  const trace=[];
  const ctx={
    fillStyle:"#000000",imageSmoothingEnabled:true,
    fillRect(x,y,w,h){trace.push([x,y,w,h,this.fillStyle]);},
    clearRect(){},save(){},restore(){},translate(){},scale(){},drawImage(){},
  };
  return {width:0,height:0,trace,getContext(){return ctx;}};
}
function fakeDocument(){
  return {createElement(tag){assert.equal(tag,"canvas");return fakeCanvas();}};
}
const signature=canvas=>JSON.stringify(canvas.trace);
test("4D JRPG avatar has 48x64 detail, distinct hair/outfit/hat/boots and six motion frames",()=>{
  assert.deepEqual([AVATAR_ART_STYLE.width,AVATAR_ART_STYLE.height,AVATAR_ART_STYLE.frames],[48,64,6]);
  const atlas=createAvatarSpriteAtlas(fakeDocument());
  const defaults={hair:"hair-natural",outfit:"outfit-linen",hat:"hat-none",shoes:"shoes-travel"};
  const standard=atlas.frame(defaults,"down",0);
  assert.equal(standard.width,48);assert.equal(standard.height,64);
  assert.ok(standard.trace.length>100,"The JRPG sprite needs layered hair and clothing details");
  assert.equal(atlas.frame(defaults,"down",0),standard,"Frame cache must be stable");
  const worn=[
    atlas.frame({...defaults,hair:"hair-silver"},"down",0),
    atlas.frame({...defaults,outfit:"outfit-forest"},"down",0),
    atlas.frame({...defaults,hat:"hat-flower"},"down",0),
    atlas.frame({...defaults,shoes:"shoes-boots"},"down",0),
    atlas.frame(defaults,"up",0),
    atlas.frame(defaults,"left",0),
    atlas.frame(defaults,"down",2,"walk"),
    atlas.frame(defaults,"down",5),
  ];
  for(const frame of worn)assert.notEqual(signature(frame),signature(standard));
  const palettes=new Set(standard.trace.map(p=>p[4]));
  assert.ok(palettes.size>=12,"Use a cohesive multi-shade palette");
});
test("4D friend artwork has original 48px expressive silhouettes for all six existing species",()=>{
  const atlas=createCompanionSpriteAtlas(fakeDocument());
  assert.equal(COMPANION_ART_STYLE.width,48);
  const signatures=[];
  for(const c of GARDEN_COMPANIONS){
    const sprite=atlas.frame(c.speciesId,"down","idle",0);
    assert.deepEqual([sprite.width,sprite.height],[48,48]);
    assert.ok(sprite.trace.length>=30);
    assert.ok(new Set(sprite.trace.map(p=>p[4])).size>=6);
    signatures.push(signature(sprite));
    assert.equal(atlas.frame(c.speciesId,"down","idle",0),sprite);
    assert.notEqual(signature(atlas.frame(c.speciesId,"left","walk",2)),signature(sprite));
    assert.notEqual(signature(atlas.frame(c.speciesId,"down","picked",1,"wiggle")),signature(sprite));
  }
  assert.equal(new Set(signatures).size,6,"All six silhouettes should be visually unique");
});
test("4D original sprites remain compatible with existing 72px inventory and wardrobe canvases",()=>{
  const atlas=createCompanionSpriteAtlas(fakeDocument());
  const player=createAvatarSpriteAtlas(fakeDocument());
  const friend=fakeCanvas();friend.width=friend.height=72;
  drawCompanionThumbnail(friend,atlas,"cat");
  const avatar=fakeCanvas();avatar.width=120;avatar.height=140;
  drawAvatarPreview(avatar,player,{outfit:"outfit-starlight",hat:"hat-star"});
  assert.equal(avatar.width,120);
  assert.equal(friend.height,72);
  assert.equal(WEARABLES.length,15,"All original purchased cosmetics remain supported");
});
