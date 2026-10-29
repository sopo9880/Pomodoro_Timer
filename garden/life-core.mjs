/**
 * Phase 4C - local guest, earned time points, original wearable shop and codex.
 * Pure state operations; no network, user secrets or cloud authentication.
 */
import { WORLD_LANDMARKS } from "./world-map.mjs";

const STARTER = Object.freeze({
  hair: "hair-natural", outfit: "outfit-linen", hat: "hat-none", shoes: "shoes-travel",
});
export const WEARABLES = Object.freeze([
  {id:"hair-natural",name:"자연스러운 머리",slot:"hair",price:0,color:"#6f4e3b"},
  {id:"hair-chestnut",name:"밤색 단발",slot:"hair",price:12,color:"#a67556"},
  {id:"hair-silver",name:"은빛 머리",slot:"hair",price:35,color:"#d7dad7"},
  {id:"hair-bloom",name:"분홍빛 머리",slot:"hair",price:45,color:"#df98a7"},
  {id:"outfit-linen",name:"산책용 린넨",slot:"outfit",price:0,color:"#e4d0a5"},
  {id:"outfit-forest",name:"숲지기 코트",slot:"outfit",price:25,color:"#5c956a"},
  {id:"outfit-garden",name:"꽃무늬 멜빵",slot:"outfit",price:40,color:"#e9b5ad"},
  {id:"outfit-starlight",name:"별빛 망토",slot:"outfit",price:80,color:"#8383ba"},
  {id:"hat-none",name:"모자 없음",slot:"hat",price:0,color:""},
  {id:"hat-straw",name:"밀짚모자",slot:"hat",price:20,color:"#f0ca83"},
  {id:"hat-flower",name:"꽃 화관",slot:"hat",price:35,color:"#f7b9bb"},
  {id:"hat-star",name:"별 모자",slot:"hat",price:70,color:"#c1b5ec"},
  {id:"shoes-travel",name:"기본 신발",slot:"shoes",price:0,color:"#795a4c"},
  {id:"shoes-boots",name:"숲속 장화",slot:"shoes",price:30,color:"#ac7a59"},
  {id:"shoes-sky",name:"하늘 운동화",slot:"shoes",price:45,color:"#8dbbbd"},
]);
const GUEST = Object.freeze({mode:"guest",displayName:"정원 여행자"});
const CATEGORIES = Object.freeze(["plants","companions","wildlife","decorations","landmarks"]);
const safeInteger=(n,fallback=0)=>Number.isSafeInteger(n)&&n>=0?n:fallback;
const validId=id=>typeof id==="string"&&id.length>0&&id.length<=90;
const catalogue = () => new Map(WEARABLES.map(item=>[item.id,item]));
export function createGuestProfile(){return {...GUEST};}
export function normalizeGuestProfile(raw){
  return {
    mode:"guest",
    displayName:typeof raw?.displayName==="string"&&raw.displayName.trim()
      ?raw.displayName.trim().slice(0,22):GUEST.displayName,
  };
}
export function renameGuest(garden,displayName){
  if(typeof displayName!=="string"||!displayName.trim())throw new Error("사용할 이름을 입력해 주세요.");
  return {...garden,guest:{mode:"guest",displayName:displayName.trim().slice(0,22)}};
}
export function createAvatar(){
  return {x:82.5,y:84.5,direction:"down",equipped:{...STARTER},
    ownedWearables:[...new Set(Object.values(STARTER))]};
}
export function normalizeAvatar(raw){
  const base=createAvatar(),all=catalogue(),owned=new Set(base.ownedWearables);
  if(Array.isArray(raw?.ownedWearables)){
    for(const id of raw.ownedWearables.slice(0,WEARABLES.length))
      if(all.has(id))owned.add(id);
  }
  const equipped={...STARTER};
  for(const slot of Object.keys(STARTER)){
    const id=raw?.equipped?.[slot];
    if(all.get(id)?.slot===slot&&owned.has(id))equipped[slot]=id;
  }
  const zoneNumber=n=>Number.isFinite(n)&&n>=0&&n<160;
  return {
    x:zoneNumber(raw?.x)?raw.x:base.x,
    y:zoneNumber(raw?.y)?raw.y:base.y,
    direction:["up","down","left","right"].includes(raw?.direction)?raw.direction:"down",
    ownedWearables:[...owned],equipped,
  };
}
export function normalizeTimeWallet(rawWallet,focusSeconds){
  const focusMinutes=Math.floor(Math.max(0,Number.isFinite(focusSeconds)?focusSeconds:0)/60);
  // Before time points existed, 1 sunshine represented 5 focused minutes.
  // The remainder (<5 mins) was not yet rewarded in sunshine and is recovered.
  const oldSunshine=safeInteger(rawWallet?.sunshine,Math.floor(focusMinutes/5));
  return safeInteger(rawWallet?.timePoints,oldSunshine*5+(focusMinutes%5));
}
export function timePointsEarnedBetween(previous,next){
  if(!Number.isFinite(previous)||!Number.isFinite(next)||next<=previous)return 0;
  return Math.floor(next/60)-Math.floor(Math.max(0,previous)/60);
}
export function purchaseWearable(garden,id){
  const item=catalogue().get(id);
  if(!item)throw new Error("존재하지 않는 의상입니다.");
  if(garden.avatar.ownedWearables.includes(id))return garden;
  if((garden.wallet.timePoints||0)<item.price)throw new Error("시간 포인트가 부족해요.");
  return {
    ...garden,
    wallet:{...garden.wallet,timePoints:garden.wallet.timePoints-item.price},
    avatar:{...garden.avatar,ownedWearables:[...garden.avatar.ownedWearables,id]},
  };
}
export function equipWearable(garden,id){
  const item=catalogue().get(id);
  if(!item||!garden.avatar.ownedWearables.includes(id))
    throw new Error("먼저 의상을 구매해야 해요.");
  return {...garden,avatar:{...garden.avatar,equipped:{...garden.avatar.equipped,[item.slot]:id}}};
}
export function avatarCanStand(garden,map,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!map?.getTile)return false;
  const tile=map.getTile(x,y);
  if(!tile.passable||!garden.unlockedZones.includes(tile.zoneId))return false;
  if([...(garden.placements||[]),...(garden.plants||[])].some(obj=>Math.hypot(obj.x-x,obj.y-y)<.85))return false;
  if(WORLD_LANDMARKS.some(obj=>Math.abs(obj.x-x)<Math.min(2,obj.width*.36)&&Math.abs(obj.y-y)<Math.min(2,obj.width*.3)))return false;
  return true;
}
export function moveAvatar(garden,map,x,y,direction){
  if(!avatarCanStand(garden,map,x,y))throw new RangeError("이곳으로는 이동할 수 없어요.");
  const avatar=normalizeAvatar(garden.avatar);
  return {...garden,avatar:{...avatar,x,y,direction:["up","down","left","right"].includes(direction)?direction:avatar.direction}};
}
export function moveCompanionDrop(garden,map,id,x,y){
  const friend=garden.companions.find(c=>c.id===id);
  if(!friend)throw new Error("정원에 없는 동료입니다.");
  if(!avatarCanStand(garden,map,x,y)||Math.hypot(garden.avatar.x-x,garden.avatar.y-y)<.65)
    throw new RangeError("친구를 놓을 수 없는 곳이에요.");
  if(garden.companions.some(c=>c.id!==id&&Math.hypot(c.x-x,c.y-y)<.8))
    throw new Error("다른 친구와 너무 가까워요.");
  return {...garden,companions:garden.companions.map(c=>c.id===id?{...c,x,y}:c)};
}
export function createDiscoveryState(){return Object.fromEntries(CATEGORIES.map(category=>[category,[]]));}
export function normalizeDiscovery(raw){
  const result=createDiscoveryState();
  for(const category of CATEGORIES){
    if(Array.isArray(raw?.[category]))
      result[category]=[...new Set(raw[category].filter(validId))].slice(0,256);
  }
  return result;
}
export function discover(garden,category,id){
  if(!CATEGORIES.includes(category)||!validId(id))throw new Error("알 수 없는 도감 항목이에요.");
  const existing=garden.discovery?.[category]||[];
  if(existing.includes(id))return garden;
  return {...garden,discovery:{...normalizeDiscovery(garden.discovery),[category]:[...existing,id].slice(0,256)}};
}
export function collectionSnapshot(garden,{items=[],companions=[],wildlife=[],landmarks=[]}={}){
  const found={
    plants:new Set(garden.discovery?.plants||[]),
    companions:new Set(garden.discovery?.companions||[]),
    wildlife:new Set(garden.discovery?.wildlife||[]),
    decorations:new Set(garden.discovery?.decorations||[]),
    landmarks:new Set(garden.discovery?.landmarks||[]),
  };
  for(const entry of garden.inventory||[]){
    if(entry.quantity<=0)continue;
    const item=items.find(x=>x.id===entry.itemId);
    if(item)found[item.kind==="plant"?"plants":"decorations"].add(item.id);
  }
  for(const entry of garden.plants||[])found.plants.add(entry.itemId);
  for(const entry of garden.placements||[])found.decorations.add(entry.itemId);
  for(const friend of garden.companions||[])found.companions.add(friend.speciesId);
  const catalogs={
    plants:items.filter(x=>x.kind==="plant").map(x=>({id:x.id,name:x.name})),
    decorations:items.filter(x=>x.kind==="decor").map(x=>({id:x.id,name:x.name})),
    companions:companions.map(x=>({id:x.speciesId,name:x.name})),
    wildlife:wildlife.map(x=>({id:x.id,name:x.name})),
    landmarks:landmarks.map(x=>({id:x.id,name:x.name})),
  };
  return Object.fromEntries(CATEGORIES.map(category=>[category,catalogs[category].map(item=>({
    ...item,discovered:found[category].has(item.id),
  }))]));
}
