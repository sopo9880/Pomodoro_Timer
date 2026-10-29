import test from "node:test";
import assert from "node:assert/strict";
import { createWorldMap } from "../garden/world-map.mjs";
import { WORLD_SPEC,createGardenState,creditGardenFocus,recruitGardenCompanion } from "../garden/garden-core.mjs";
import { COMPANION_PERSONALITIES,canCompanionStand,findCompanionPath,createCompanionSimulation } from "../garden/companion-ai.mjs";

const world=createWorldMap(WORLD_SPEC);
test("six companion personalities have distinct activities and correct unlock data",()=>{
  assert.equal(Object.keys(COMPANION_PERSONALITIES).length,6);
  for(const [id,profile] of Object.entries(COMPANION_PERSONALITIES)){
    assert.ok(profile.pace>0, id);
    assert.ok(profile.activities.length>=3,id);
    assert.ok(profile.greeting);
  }
});
test("pathfinding crosses pond bridges without entering water or locked zones",()=>{
  const garden=creditGardenFocus(createGardenState(),21600);
  const route=findCompanionPath(world,garden,{x:80.5,y:105.5},{x:80.5,y:120.5},1500);
  assert.ok(route.length>0);
  assert.ok(route.some(p=>Math.floor(p.y)===112&&Math.floor(p.x)===80));
  for(const p of route)assert.ok(world.getTile(p.x,p.y).passable);
  assert.equal(canCompanionStand(world,garden,75.5,111.5),false);
  assert.equal(canCompanionStand(world,createGardenState(),112.5,80.5),false);
});
test("placed furniture prevents companion path from passing through a cell",()=>{
  const base=createGardenState();
  const garden={...base,placements:[{id:"chair",itemId:"wooden-bench",x:81.5,y:82.5,rotation:0}]};
  assert.equal(canCompanionStand(world,garden,81.5,82.5),false);
  const route=findCompanionPath(world,garden,{x:80.5,y:82.5},{x:83.5,y:82.5},1000);
  assert.ok(route.length>0);
  assert.ok(!route.some(p=>Math.hypot(p.x-81.5,p.y-82.5)<.82));
});
test("transient autonomous movement never changes saved coordinates or rewards",()=>{
  const garden=creditGardenFocus(createGardenState(),126000);
  const snapshot=JSON.stringify(garden);
  const sim=createCompanionSimulation(world);
  let first=sim.advance(garden,0),everMoved=false;
  assert.equal(first.length,1);
  for(let i=0;i<460;i++){
    const pos=sim.advance(garden,.15)[0];
    assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.y));
    assert.ok(world.getTile(pos.x,pos.y).passable);
    if(Math.hypot(pos.x-first[0].x,pos.y-first[0].y)>.5)everMoved=true;
  }
  assert.ok(everMoved,"Companions should wander after settling in");
  assert.equal(JSON.stringify(garden),snapshot,"Animation should not mutate persisted data");
  assert.equal(garden.progress.focusSeconds,126000);
});
test("reduced motion and background gaps leave companions stationary",()=>{
  const garden=createGardenState();
  const sim=createCompanionSimulation(world);
  const still=sim.advance(garden,999,{reducedMotion:true})[0];
  assert.equal(still.x,80);
  assert.equal(still.y,80);
  assert.equal(still.activity,"idle");
  const active=sim.advance(garden,Infinity);
  assert.equal(active[0].x,80);
  assert.equal(active[0].y,80);
});
test("all six recruited companions can be rendered without changing their original garden objects",()=>{
  let garden=creditGardenFocus(createGardenState(),126000);
  for(const species of ["mushroom","cat","sparrow","turtle","fox"])garden=recruitGardenCompanion(garden,species);
  const sim=createCompanionSimulation(world);
  assert.equal(sim.advance(garden,0).length,6);
  assert.equal(sim.getCount(),6);
  assert.equal(new Set(sim.snapshot().map(p=>p.speciesId)).size,6);
  assert.ok(sim.getAt(80,80));
});
