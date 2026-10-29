import test from "node:test";
import assert from "node:assert/strict";
import { createWorldMap } from "../garden/world-map.mjs";
import { WORLD_SPEC,createGardenState,creditGardenFocus } from "../garden/garden-core.mjs";
import { WILDLIFE_SPECIES, wildlifeAvailable, createWildlifeEcology } from "../garden/ecology.mjs";
import { createCompanionSpriteAtlas } from "../garden/companion-art.mjs";
import { createPlantSpriteAtlas } from "../garden/plant-art.mjs";
import { createWildlifeSpriteAtlas } from "../garden/wildlife-art.mjs";

const map=createWorldMap(WORLD_SPEC);
const worldRect={left:0,top:0,right:160,bottom:160};
function fakeDocument(){
  const ctx={
    fillRect() {},clearRect() {},save() {},restore() {},translate() {},scale() {},
  };
  return {createElement(tag){
    assert.equal(tag,"canvas");
    return {width:0,height:0,getContext(type){assert.equal(type,"2d");return ctx;}};
  }};
}
test("fourteen original wildlife species have unique IDs, habitat and bounded populations",()=>{
 assert.equal(WILDLIFE_SPECIES.length,14);
 assert.equal(new Set(WILDLIFE_SPECIES.map(s=>s.id)).size,14);
 for(const species of WILDLIFE_SPECIES){
  assert.ok(map.getZones().some(z=>z.id===species.zone));
  assert.ok(species.count>0&&species.count<=3);
 }
 const simulation=createWildlifeEcology(map);
 assert.ok(simulation.getPopulation()>=14);
});
test("wildlife presence reacts to unlocked zone, day, season, weather",()=>{
 const ecology=createWildlifeEcology(map,{maxVisible:20});
 const garden=createGardenState();
 const base=ecology.visibleWildlife({unlockedZones:garden.unlockedZones,
   environment:{season:"spring",time:"day",weather:"clear"},viewport:worldRect});
 assert.ok(base.length>0);
 assert.ok(base.every(a=>a.zoneId==="central"));
 assert.equal(wildlifeAvailable("firefly",{season:"spring",time:"day",weather:"clear"}),false);
 assert.equal(wildlifeAvailable("firefly",{season:"spring",time:"night",weather:"clear"}),true);
 assert.equal(wildlifeAvailable("honeybee",{season:"winter",time:"day",weather:"clear"}),false);
 assert.equal(wildlifeAvailable("dragonfly",{season:"summer",time:"day",weather:"rain"}),false);
 const full=creditGardenFocus(garden,126000);
 const dark=ecology.visibleWildlife({unlockedZones:full.unlockedZones,
   environment:{season:"summer",time:"night",weather:"clear"},viewport:worldRect});
 assert.ok(dark.some(a=>a.speciesId==="firefly"),"Unlocked forest must get fireflies at night");
 assert.ok(dark.some(a=>a.speciesId==="lunamoth"),"Unlocked hill must get night moths");
 assert.ok(dark.every(a=>!["honeybee","dragonfly"].includes(a.speciesId)));
 assert.ok(dark.length<=20);
});
test("wildlife is deterministic, local, and animated only when motion is allowed",()=>{
 const ecology=createWildlifeEcology(map);
 const args={unlockedZones:["central"],environment:{season:"spring",time:"day",weather:"clear"},
    viewport:{left:64,top:64,right:96,bottom:96},elapsedSeconds:13};
 const a=ecology.visibleWildlife(args),b=ecology.visibleWildlife(args);
 assert.deepEqual(a,b);
 const still=ecology.visibleWildlife({...args,reducedMotion:true,elapsedSeconds:100});
 assert.ok(still.every(a=>a.frame===0));
 assert.deepEqual(still.map(a=>a.x),ecology.visibleWildlife({...args,reducedMotion:true,elapsedSeconds:200}).map(a=>a.x));
 assert.deepEqual(ecology.visibleWildlife({...args,viewport:{left:0,top:0,right:5,bottom:5}}),[]);
});
test("original sprite atlases cache all species and growth stages without network",()=>{
 const doc=fakeDocument();
 const friends=createCompanionSpriteAtlas(doc);
 for(const species of ["sprout","mushroom","cat","sparrow","turtle","fox"]){
   const a=friends.frame(species,"left","walk",1);
   assert.equal(a.width,32);
   assert.equal(friends.frame(species,"left","walk",1),a);
   assert.notEqual(friends.frame(species,"right","idle",0),a);
 }
 assert.equal(friends.stats().species,6);
 const plants=createPlantSpriteAtlas(doc);
 for(const flower of ["daisy","rose","tulip","clover","lavender","hydrangea","sunflower","lotus","starflower"]){
   for(let stage=0;stage<4;stage++){
     assert.equal(plants.frame(flower,stage,0,false).width,32);
   }
 }
 assert.equal(plants.stats().plants,9);
 const wildlife=createWildlifeSpriteAtlas(doc);
 for(const species of WILDLIFE_SPECIES){
   const image=wildlife.frame(species.id,2);
   assert.equal(image.width,16);
   assert.equal(image,wildlife.frame(species.id,2));
 }
 assert.equal(wildlife.stats().species,14);
});
