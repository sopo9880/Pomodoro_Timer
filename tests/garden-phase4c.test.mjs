import test from "node:test";
import assert from "node:assert/strict";
import {
  createGardenState,normalizeGardenState,creditGardenFocus,
  purchaseGardenItem,GARDEN_ITEMS,GARDEN_COMPANIONS,WORLD_SPEC,
} from "../garden/garden-core.mjs";
import {
  createGuestProfile,normalizeGuestProfile,renameGuest,
  createAvatar,normalizeAvatar,WEARABLES,
  normalizeTimeWallet,timePointsEarnedBetween,
  purchaseWearable,equipWearable,avatarCanStand,moveAvatar,moveCompanionDrop,
  createDiscoveryState,normalizeDiscovery,discover,collectionSnapshot,
} from "../garden/life-core.mjs";
import { createWorldMap, WORLD_LANDMARKS } from "../garden/world-map.mjs";
import { WILDLIFE_SPECIES } from "../garden/ecology.mjs";

const map=createWorldMap(WORLD_SPEC);

test("historical sunshine balance migrates at five minutes per sunshine without losing assets",()=>{
  const original=creditGardenFocus(createGardenState(),5400);
  const legacy=JSON.parse(JSON.stringify(original));
  legacy.wallet.sunshine=11; // old garden purchases spent 7 of the 18 earned sunshines
  delete legacy.wallet.timePoints;
  delete legacy.avatar;
  delete legacy.guest;
  delete legacy.discovery;
  legacy.placements=[{id:"heritage-bench",itemId:"wooden-bench",x:80.25,y:88.5,rotation:90}];
  const restored=normalizeGardenState(legacy);
  assert.equal(restored.wallet.timePoints,55);
  assert.equal(restored.wallet.sunshine,11);
  assert.equal(restored.progress.focusSeconds,5400);
  assert.deepEqual(restored.placements,legacy.placements);
  assert.equal(restored.avatar.equipped.outfit,"outfit-linen");
  assert.equal(restored.guest.mode,"guest");
  assert.deepEqual(normalizeGardenState(JSON.parse(JSON.stringify(restored))),restored);
});
test("legacy 1-4 minute focus remainder is credited once, but spent zero stays zero",()=>{
  assert.equal(normalizeTimeWallet({sunshine:2},9*60),9);
  assert.equal(normalizeTimeWallet({sunshine:2,timePoints:0},9*60),0);
  assert.equal(timePointsEarnedBetween(59,60),1);
  assert.equal(timePointsEarnedBetween(60,119),0);
  assert.equal(timePointsEarnedBetween(119,121),1);
  assert.equal(timePointsEarnedBetween(121,121),0);
  let garden=createGardenState();
  garden=creditGardenFocus(garden,119);
  assert.equal(garden.wallet.timePoints,1);
  garden=creditGardenFocus(garden,1);
  assert.equal(garden.wallet.timePoints,2);
  garden=creditGardenFocus(garden,0);
  assert.equal(garden.wallet.timePoints,2);
});
test("one minute is one time point; garden purchases retain historic five minute cost",()=>{
  const garden=creditGardenFocus(createGardenState(),2000);
  assert.equal(garden.wallet.timePoints,33);
  const after=purchaseGardenItem(garden,"lantern");
  assert.equal(after.wallet.timePoints,3);
  assert.equal(after.wallet.sunshine,garden.wallet.sunshine);
  assert.equal(after.progress.focusSeconds,garden.progress.focusSeconds);
  assert.equal(after.inventory.find(x=>x.itemId==="lantern").quantity,1);
  assert.throws(()=>purchaseGardenItem(after,"lantern"),/시간 포인트/);
  assert.equal(normalizeGardenState(after).wallet.timePoints,3);
});
test("wardrobe purchases and equipping cannot mint points or equip unowned items",()=>{
  assert.equal(WEARABLES.length,15);
  const base=creditGardenFocus(createGardenState(),31*60);
  const bought=purchaseWearable(base,"outfit-forest");
  assert.equal(bought.wallet.timePoints,6);
  assert.equal(base.wallet.timePoints,31);
  assert.equal(bought.wallet.sunshine,base.wallet.sunshine);
  assert.equal(purchaseWearable(bought,"outfit-forest"),bought);
  assert.throws(()=>equipWearable(base,"hat-star"),/구매/);
  assert.throws(()=>purchaseWearable(bought,"hat-star"),/부족/);
  const equipped=equipWearable(bought,"outfit-forest");
  assert.equal(equipped.avatar.equipped.outfit,"outfit-forest");
  assert.equal(equipped.avatar.equipped.hair,"hair-natural");
  assert.equal(normalizeGardenState(equipped).avatar.equipped.outfit,"outfit-forest");
});
test("guest mode is local only, sanitizes names and preserves the current save",()=>{
  assert.deepEqual(createGuestProfile(),{mode:"guest",displayName:"정원 여행자"});
  assert.equal(normalizeGuestProfile({mode:"cloud",displayName:"  하늘  "}).mode,"guest");
  const garden=createGardenState();
  const renamed=renameGuest(garden,"  숲속 여행자  ");
  assert.equal(renamed.guest.displayName,"숲속 여행자");
  assert.equal(renamed.progress.focusSeconds,garden.progress.focusSeconds);
  assert.throws(()=>renameGuest(garden,"  "),/이름/);
  assert.ok(renameGuest(garden,"가".repeat(50)).guest.displayName.length<=22);
});
test("player navigation validates water, obstacles and locked regions",()=>{
  let garden=createGardenState();
  assert.equal(avatarCanStand(garden,map,75.5,112.5),false);
  assert.equal(avatarCanStand(garden,map,112.5,80.5),false);
  assert.equal(avatarCanStand(garden,map,83.5,83.5),true);
  const moved=moveAvatar(garden,map,83.5,83.5,"right");
  assert.equal(moved.avatar.direction,"right");
  assert.equal(moved.avatar.x,83.5);
  assert.equal(garden.avatar.x,82.5);
  garden={...garden,placements:[{id:"table",itemId:"wooden-bench",x:84.5,y:84.5,rotation:0}]};
  assert.equal(avatarCanStand(garden,map,84.5,84.5),false);
});
test("companion drag-drop validates final tile, keeps friendship and preserves other friends",()=>{
  let garden=createGardenState();
  const started=JSON.stringify(garden);
  assert.throws(()=>moveCompanionDrop(garden,map,"starter-sprout",75.5,111.5),/놓을 수/);
  assert.equal(JSON.stringify(garden),started);
  const moved=moveCompanionDrop(garden,map,"starter-sprout",85.5,82.5);
  assert.equal(moved.companions[0].x,85.5);
  assert.equal(moved.companions[0].affinity,garden.companions[0].affinity);
  assert.equal(moved.wallet.timePoints,garden.wallet.timePoints);
  assert.equal(normalizeGardenState(moved).companions[0].x,85.5);
});
test("discoveries are additive, unique and survive guest backup restoration",()=>{
  let garden=createGardenState();
  garden=discover(garden,"wildlife","butterfly");
  const once=garden;
  assert.equal(discover(garden,"wildlife","butterfly"),once);
  garden=discover(garden,"landmarks","central-cottage");
  garden=discover(garden,"companions","sparrow");
  assert.throws(()=>discover(garden,"not-a-category","foo"),/도감/);
  assert.equal(normalizeDiscovery({wildlife:["butterfly","butterfly",null]}).wildlife.length,1);
  assert.deepEqual(createDiscoveryState().wildlife,[]);
  const before=collectionSnapshot(garden,{
    items:GARDEN_ITEMS,companions:GARDEN_COMPANIONS,
    wildlife:WILDLIFE_SPECIES,landmarks:WORLD_LANDMARKS,
  });
  assert.equal(before.wildlife.find(x=>x.id==="butterfly").discovered,true);
  assert.equal(before.wildlife.find(x=>x.id==="owl").discovered,false);
  assert.equal(before.landmarks.find(x=>x.id==="central-cottage").discovered,true);
  const backup=JSON.parse(JSON.stringify(garden));
  assert.deepEqual(normalizeGardenState(backup).discovery,garden.discovery);
});
