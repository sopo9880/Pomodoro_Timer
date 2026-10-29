import test from "node:test";
import assert from "node:assert/strict";
import { WORLD_SPEC,createGardenState,creditGardenFocus } from "../garden/garden-core.mjs";
import { createWorldMap } from "../garden/world-map.mjs";
import { createAvatarMotion } from "../garden/avatar-motion.mjs";
import { createAvatarSpriteAtlas } from "../garden/avatar-art.mjs";
import { createCompanionSimulation } from "../garden/companion-ai.mjs";

const map=createWorldMap(WORLD_SPEC);
test("avatar WASD step uses one tile and never mutates the original garden",()=>{
  const garden=createGardenState();
  const navigation=createAvatarMotion(map);
  navigation.sync(garden.avatar);
  const moved=navigation.step(garden,1,0);
  assert.equal(moved.avatar.x,83.5);
  assert.equal(moved.avatar.y,84.5);
  assert.equal(garden.avatar.x,82.5);
  assert.equal(navigation.visual().direction,"right");
  assert.throws(()=>navigation.step(garden,-50,0),RangeError);
});
test("click-to-move computes bounded collision-safe route and settles at the destination",()=>{
  const garden=createGardenState(),nav=createAvatarMotion(map);
  nav.sync(garden.avatar);
  assert.equal(nav.goTo(garden,87.5,84.5),true);
  let done=null;
  for(let i=0;i<60;i++){
    const step=nav.advance(.15);
    if(step.done){done=step;break;}
  }
  assert.ok(done,"Route should finish");
  assert.equal(done.position.x,87.5);
  assert.equal(done.position.y,84.5);
  assert.equal(nav.isMoving(),false);
  assert.equal(nav.goTo(garden,75.5,111.5),false);
});
test("new sprites render original equipped wearable layers, cache exact frames",()=>{
  const ctx={fillRect(){},clearRect(){},drawImage(){}};
  const doc={createElement(tag){assert.equal(tag,"canvas");return {width:0,height:0,getContext(){return ctx;}}}};
  const art=createAvatarSpriteAtlas(doc);
  const skin=art.frame({outfit:"outfit-linen",hat:"hat-none"},"down",0);
  assert.equal(skin.width,48);
  assert.equal(skin.height,64);
  assert.equal(art.frame({outfit:"outfit-linen",hat:"hat-none"},"down",0),skin);
  assert.notEqual(art.frame({outfit:"outfit-forest",hat:"hat-star"},"left",1),skin);
});
test("companion picked reaction is temporary; no save mutation until explicit drop",()=>{
  const garden=createGardenState();
  const original=JSON.stringify(garden);
  const sim=createCompanionSimulation(map);
  sim.advance(garden,0);
  assert.equal(sim.beginDrag("starter-sprout"),true);
  assert.equal(sim.dragTo("starter-sprout",84.5,85.5),true);
  let holding=sim.snapshot()[0];
  assert.equal(holding.activity,"picked");
  assert.equal(holding.x,84.5);
  assert.equal(JSON.stringify(garden),original);
  sim.endDrag("starter-sprout",false);
  assert.equal(sim.snapshot()[0].x,80);
  assert.ok(sim.snapshot()[0].reaction);
  sim.beginDrag("starter-sprout");
  sim.dragTo("starter-sprout",86.5,85.5);
  sim.endDrag("starter-sprout",true,{x:86.5,y:85.5});
  assert.equal(sim.snapshot()[0].x,86.5);
  assert.equal(garden.companions[0].x,80);
});
