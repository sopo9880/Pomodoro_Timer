/**
 * Phase 4B region ecology. Everything here is visual-only, deterministic,
 * offline and capped: wildlife never affects focus rewards, garden saves
 * or the number of earned discoveries (the encyclopedia is Phase 4C).
 */
import { worldHash } from "./world-map.mjs";

export const WILDLIFE_SPECIES = Object.freeze([
  {id:"butterfly",name:"정원 나비",zone:"central",motion:"flutter",count:2,period:"day",seasons:["spring","summer","autumn"]},
  {id:"robin",name:"동글새",zone:"central",motion:"hop",count:1,period:"day"},
  {id:"honeybee",name:"꽃밭 꿀벌",zone:"greenhouse",motion:"flutter",count:2,period:"day",seasons:["spring","summer"]},
  {id:"ladybug",name:"무당벌레",zone:"greenhouse",motion:"crawl",count:2,period:"day",seasons:["spring","summer","autumn"]},
  {id:"dragonfly",name:"연못 잠자리",zone:"pond",motion:"flutter",count:2,period:"day",seasons:["spring","summer"]},
  {id:"frog",name:"초록 개구리",zone:"pond",motion:"hop",count:1,seasons:["spring","summer","autumn"]},
  {id:"carp",name:"작은 잉어",zone:"pond",motion:"swim",count:2,terrain:"water"},
  {id:"firefly",name:"숲 반딧불",zone:"forest",motion:"glow",count:3,period:"night",weathers:["clear","snow"]},
  {id:"owl",name:"숲 부엉이",zone:"forest",motion:"perch",count:1,period:"night"},
  {id:"squirrel",name:"다람쥐",zone:"forest",motion:"hop",count:1,period:"day"},
  {id:"fieldmouse",name:"들쥐",zone:"workshop",motion:"crawl",count:2},
  {id:"wren",name:"공방 굴뚝새",zone:"workshop",motion:"hop",count:1,period:"day"},
  {id:"lunamoth",name:"달빛 나방",zone:"starlight",motion:"flutter",count:2,period:"night",weathers:["clear"]},
  {id:"glowbug",name:"별빛 벌레",zone:"starlight",motion:"glow",count:3,period:"night"},
]);
const SAFE_WEATHER = new Set(["clear","rain","snow"]);
const EMPTY = Object.freeze([]);
function allows(spec, environment){
  const season=environment.season||"spring",weather=SAFE_WEATHER.has(environment.weather)?environment.weather:"clear";
  const period=environment.time||"day";
  if(spec.period && spec.period!==period)return false;
  if(spec.seasons && !spec.seasons.includes(season))return false;
  if(spec.weathers && !spec.weathers.includes(weather))return false;
  if(weather==="rain" && ["flutter","perch"].includes(spec.motion))return false;
  if(weather==="snow" && spec.id==="frog")return false;
  return true;
}
export function wildlifeAvailable(speciesId,environment={}){
  const species=WILDLIFE_SPECIES.find(entry=>entry.id===speciesId);
  return Boolean(species&&allows(species,environment));
}
function visible(x,y,rect,padding=1){
  return x>=rect.left-padding&&x<=rect.right+padding&&
    y>=rect.top-padding&&y<=rect.bottom+padding;
}
/** Locate a stable environment-appropriate home tile. Never spawn in locked zones. */
function originFor(species,index,map){
  const zone=map.getZones().find(z=>z.id===species.zone);
  if(!zone)return null;
  const salt=species.id.split("").reduce((sum,c)=>sum+c.charCodeAt(0),0);
  for(let attempt=0;attempt<30;attempt++){
    const x=zone.x+3+Math.floor(worldHash(index+attempt,salt,3)*(zone.width-6));
    const y=zone.y+3+Math.floor(worldHash(index+attempt,salt,7)*(zone.height-6));
    const tile=map.getTile(x,y);
    if(species.terrain==="water" ? tile.kind==="water" : tile.passable){
      return {x:x+.5,y:y+.5,seed:worldHash(index,salt,23)};
    }
  }
  return null;
}
export function createWildlifeEcology(map,{maxVisible=20}={}){
  if(!map?.getTile||!map.getZones)throw new TypeError("World map required");
  const origins=new Map();
  const limit=Math.max(0,Math.min(48,Math.floor(maxVisible)));
  for(const species of WILDLIFE_SPECIES){
    origins.set(species.id,Array.from({length:species.count},(_,index)=>originFor(species,index,map)).filter(Boolean));
  }
  function visibleWildlife({unlockedZones=EMPTY,environment={},viewport,elapsedSeconds=0,reducedMotion=false}={}){
    if(!viewport)return [];
    const unlocked=new Set(unlockedZones);
    const t=Number.isFinite(elapsedSeconds)?Math.max(0,elapsedSeconds):0;
    const result=[];
    for(const species of WILDLIFE_SPECIES){
      if(!unlocked.has(species.zone)||!allows(species,environment))continue;
      for(const [index,home] of (origins.get(species.id)||[]).entries()){
        const cycle=t*.5+home.seed*7.5+index;
        const sway=reducedMotion?0:Math.sin(cycle);
        const bob=reducedMotion?0:Math.cos(cycle*1.2);
        const mobile=species.motion==="flutter"||species.motion==="swim"||species.motion==="glow";
        const spread=mobile?.45:.16;
        const x=home.x+sway*spread,y=home.y+bob*spread*.6;
        if(!visible(x,y,viewport,2))continue;
        result.push({
          id:species.id+"-"+index,speciesId:species.id,name:species.name,zoneId:species.zone,
          x,y,motion:species.motion,frame:reducedMotion?0:Math.floor(t*5+home.seed*7)%4,
        });
        if(result.length>=limit)return result;
      }
    }
    return result;
  }
  function getPopulation(){return [...origins.values()].reduce((sum,list)=>sum+list.length,0);}
  return {visibleWildlife,getPopulation,getSpecies:()=>WILDLIFE_SPECIES};
}
