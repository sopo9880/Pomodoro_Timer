import test from "node:test";
import assert from "node:assert/strict";
import { WORLD_SPEC, createGardenState, creditGardenFocus } from "../garden/garden-core.mjs";
import { createWorldMap } from "../garden/world-map.mjs";
import { createAvatarMotion, AVATAR_WALK_SPEED } from "../garden/avatar-motion.mjs";
import { moveAvatar } from "../garden/life-core.mjs";

const world=createWorldMap(WORLD_SPEC);
test("4D continuous held-key movement advances smoothly without key repeat",()=>{
  const garden=createGardenState(),controller=createAvatarMotion(world);
  const initial=JSON.stringify(garden);
  controller.sync(garden.avatar);
  assert.equal(controller.setHeld("right",true),true);
  let last=controller.visual().x;
  for(let i=0;i<20;i++){
    const result=controller.advance(.05,garden);
    assert.equal(result.moving,true);
    assert.ok(result.position.x>last);
    assert.ok(result.position.x-last<.4,"No multi-tile teleport");
    last=result.position.x;
  }
  const moved=controller.visual();
  assert.ok(moved.x>87.1&&moved.x<87.9,"Expected about 5 tiles after one second");
  assert.equal(moved.pose,"walk");
  assert.equal(controller.isControlled(),true);
  assert.equal(JSON.stringify(garden),initial,"Visual movement does not mutate saved data");
  controller.setHeld("right",false);
  assert.equal(controller.isControlled(),false);
  const saved=moveAvatar(garden,world,moved.x,moved.y,moved.direction);
  assert.equal(saved.avatar.x,moved.x);
  assert.equal(saved.wallet.timePoints,garden.wallet.timePoints);
  assert.equal(saved.progress.focusSeconds,garden.progress.focusSeconds);
});
test("4D diagonal movement normalizes speed and retains arrow direction",()=>{
  const garden=createGardenState(),nav=createAvatarMotion(world);
  nav.sync(garden.avatar);
  nav.setHeld("right",true);
  nav.setHeld("down",true);
  for(let n=0;n<20;n++)nav.advance(.05,garden);
  const p=nav.visual();
  const distance=Math.hypot(p.x-82.5,p.y-84.5);
  assert.ok(distance>4.6 && distance<=AVATAR_WALK_SPEED+.001,"Diagonal movement must not be faster");
  assert.ok(Math.abs((p.x-82.5)-(p.y-84.5))<.01);
  nav.releaseAll();
  assert.equal(nav.isControlled(),false);
});
test("4D swept collisions stop at the edge of locked regions",()=>{
  const garden=createGardenState(),nav=createAvatarMotion(world);
  nav.sync({...garden.avatar,x:65.5,y:86.5},true);
  nav.setHeld("left",true);
  for(let n=0;n<90;n++)nav.advance(.05,garden);
  const p=nav.visual();
  assert.ok(p.x>=64,"Avatar cannot exit the central unlocked zone");
  assert.ok(world.getTile(p.x,p.y).passable);
  assert.ok(garden.unlockedZones.includes(world.getTile(p.x,p.y).zoneId));
});
test("4D movement cannot tunnel through pond water even after slow frames",()=>{
  const garden=creditGardenFocus(createGardenState(),21600);
  const nav=createAvatarMotion(world);
  nav.sync({...garden.avatar,x:75.5,y:105.5},true);
  nav.setHeld("down",true);
  for(let n=0;n<120;n++){
    nav.advance(.22,garden);
    const p=nav.visual();
    assert.notEqual(world.getTile(p.x,p.y).kind,"water");
  }
  assert.ok(nav.visual().y<113);
});
test("4D held direction overrides an existing click-walk route",()=>{
  const garden=createGardenState(),nav=createAvatarMotion(world);
  nav.sync(garden.avatar);
  assert.equal(nav.goTo(garden,87.5,84.5),true);
  assert.ok(nav.target());
  nav.setHeld("up",true);
  assert.equal(nav.target(),null,"Manual input cancels auto-navigation instantly");
  nav.advance(.05,garden);
  assert.equal(nav.visual().direction,"up");
  nav.releaseAll();
  nav.cancel();
  assert.equal(nav.isMoving(),false);
});
test("4D frame-rate variations yield similar world distance",()=>{
  const garden=createGardenState();
  function travel(dt,frames){
    const nav=createAvatarMotion(world);nav.sync(garden.avatar);nav.setHeld("right",true);
    for(let i=0;i<frames;i++)nav.advance(dt,garden);
    return nav.visual().x;
  }
  const a=travel(.016,60),b=travel(.05,20),c=travel(.2,5);
  assert.ok(Math.abs(a-b)<.25);
  assert.ok(Math.abs(b-c)<.25);
});
