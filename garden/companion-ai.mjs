/**
 * Phase 4B: transient companion behaviour and bounded grid pathfinding.
 *
 * Animation / movement never mutate the saved garden. All earned affinity,
 * positions, purchases and focus totals remain owned by garden-core.mjs.
 */
import { WORLD_LANDMARKS, worldHash } from "./world-map.mjs";

export const COMPANION_PERSONALITIES = Object.freeze({
  sprout:   { home: "central",   pace: 1.0, activities: ["tend","observe","hop"],      greeting: "모아가 화단을 가꾸다가 반갑게 인사해요!" },
  mushroom: { home: "forest",    pace: 0.65, activities: ["read","rest","observe"],      greeting: "모리가 읽던 책을 잠시 덮고 인사해요." },
  cat:      { home: "central",   pace: 0.92, activities: ["nap","stretch","watch"],      greeting: "나루가 꼬리를 살랑이며 다가와요." },
  sparrow:  { home: "forest",    pace: 1.36, activities: ["perch","sing","flutter"],     greeting: "루루가 짹짹 노래하며 인사해요!" },
  turtle:   { home: "pond",      pace: 0.43, activities: ["rest","observe","stroll"],    greeting: "토토가 고개를 천천히 내밀어요." },
  fox:      { home: "starlight", pace: 1.12, activities: ["stargaze","watch","stretch"], greeting: "하니가 별빛 같은 눈을 반짝여요." },
});
const DIRECTIONS = Object.freeze([[0,1,"down"],[1,0,"right"],[0,-1,"up"],[-1,0,"left"]]);
const cellKey = (x,y) => x + ":" + y;
const valid = n => Number.isFinite(n);
const hashString = value => {
  let hash = 0;
  for (let i=0;i<value.length;i++) hash = (Math.imul(hash,31)+value.charCodeAt(i)) | 0;
  return hash;
};
function buildCollisionIndex(garden) {
  const buckets=new Map();
  for(const object of [...(garden.placements||[]),...(garden.plants||[])]){
    if(!valid(object?.x)||!valid(object?.y))continue;
    const key=cellKey(Math.floor(object.x),Math.floor(object.y));
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(object);
  }
  return buckets;
}
function collides(x, y, garden, ignoreStart = null, index = null) {
  if (ignoreStart && Math.abs(x - ignoreStart.x) < .5 && Math.abs(y-ignoreStart.y)<.5) return false;
  if(index){
    const cx=Math.floor(x),cy=Math.floor(y);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const nearby=index.get(cellKey(cx+dx,cy+dy))||[];
      if(nearby.some(object=>Math.hypot(object.x-x,object.y-y)<.82))return true;
    }
  }else{
    if([...(garden.placements||[]),...(garden.plants||[])].some(object =>
      Math.hypot(object.x-x,object.y-y)<.82))return true;
  }
  return WORLD_LANDMARKS.some(landmark => Math.abs(landmark.x-x)<Math.min(2.5,landmark.width*.36) &&
    Math.abs(landmark.y-y)<Math.min(2.1,landmark.width*.32));
}
export function canCompanionStand(map, garden, x, y, ignoreStart = null, index = null) {
  if (!valid(x)||!valid(y)) return false;
  const tile = map.getTile(Math.floor(x),Math.floor(y));
  return tile.passable && tile.zoneId && garden.unlockedZones?.includes(tile.zoneId) &&
    !collides(x, y, garden, ignoreStart, index);
}

/**
 * Deterministic 4-direction BFS, with a fixed work budget to avoid visible
 * frame stalls if an area is surrounded by decorations.
 * Waypoints are cell centers, suitable for smooth sprite interpolation.
 */
export function findCompanionPath(map, garden, start, goal, maxVisited = 1500) {
  const sx = Math.floor(start.x), sy = Math.floor(start.y);
  const gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  const startKey = cellKey(sx,sy), goalKey = cellKey(gx,gy);
  if(startKey===goalKey) return [];
  const occupancy=buildCollisionIndex(garden);
  if(!canCompanionStand(map,garden,gx+.5,gy+.5,null,occupancy)) return [];
  const queue = [[sx,sy]], visited = new Set([startKey]), previous = new Map();
  let reached = false;
  for(let i=0;i<queue.length && i<maxVisited;i++) {
    const [x,y]=queue[i];
    if(cellKey(x,y)===goalKey) { reached = true; break; }
    for(const [dx,dy] of DIRECTIONS){
      const nx=x+dx,ny=y+dy,key=cellKey(nx,ny);
      if(visited.has(key))continue;
      if(!canCompanionStand(map,garden,nx+.5,ny+.5,{x:sx+.5,y:sy+.5},occupancy))continue;
      previous.set(key,cellKey(x,y));
      visited.add(key);
      queue.push([nx,ny]);
    }
  }
  if(!reached)return [];
  const result=[];
  let cursor=goalKey;
  while(cursor!==startKey && result.length<maxVisited){
    const [x,y]=cursor.split(":").map(Number);
    result.push({x:x+.5,y:y+.5});
    cursor=previous.get(cursor);
    if(!cursor)return [];
  }
  return result.reverse();
}
function newState(companion, clock) {
  const profile=COMPANION_PERSONALITIES[companion.speciesId]||COMPANION_PERSONALITIES.sprout;
  return {
    id:companion.id, speciesId:companion.speciesId,
    x:valid(companion.x)?companion.x:80,
    y:valid(companion.y)?companion.y:80,
    direction:"down", activity:"idle",
    route:[], decision:0,
    nextActionAt:clock+1.5, pace:profile.pace,
  };
}
export function createCompanionSimulation(map) {
  if(!map?.getTile)throw new TypeError("Valid world map is required");
  const agents=new Map();
  let clock=0;
  function sync(garden){
    const desired = new Set();
    for(const companion of garden.companions || []){
      if(!companion?.id || !COMPANION_PERSONALITIES[companion.speciesId])continue;
      desired.add(companion.id);
      if(!agents.has(companion.id)) agents.set(companion.id,newState(companion,clock));
    }
    for(const id of agents.keys())if(!desired.has(id))agents.delete(id);
  }
  function selectAction(agent,garden,environment={}) {
    const profile=COMPANION_PERSONALITIES[agent.speciesId];
    agent.decision += 1;
    const salt=hashString(agent.id);
    const seed=worldHash(agent.decision,salt,17);
    const chosen=profile.activities[Math.floor(worldHash(agent.decision,salt,47)*profile.activities.length)];
    const nightActivity={sprout:"rest",mushroom:"read",cat:"nap",sparrow:"perch",turtle:"rest",fox:"stargaze"};
    agent.activity=environment.time==="night" ? nightActivity[agent.speciesId]||chosen : chosen;
    agent.nextActionAt=clock+2.5+worldHash(agent.decision,salt,21)*4;
    agent.route=[];
    if(seed<(environment.time==="night"?.65:.36))return;
    // Walks usually remain near their last saved starting zone. This prevents
    // unseen teleports between newly unlocked zones while still using A* routes.
    const radius=3+Math.floor(worldHash(agent.decision,salt,44)*5);
    const heading=worldHash(agent.decision,salt,52)*Math.PI*2;
    const target={x:Math.floor(agent.x+Math.cos(heading)*radius)+.5,
      y:Math.floor(agent.y+Math.sin(heading)*radius)+.5};
    const path=findCompanionPath(map,garden,agent,target,1400);
    if(path.length){
      agent.route=path;
      agent.activity="walk";
    }
  }
  function advance(garden,deltaSeconds=0,{reducedMotion=false,environment={}}={}){
    sync(garden);
    const dt=valid(deltaSeconds)?Math.min(.25,Math.max(0,deltaSeconds)):0;
    if(reducedMotion) {
      return (garden.companions||[]).filter(c=>agents.has(c.id)).map(c=>({
        id:c.id,speciesId:c.speciesId,x:c.x,y:c.y,activity:"idle",direction:"down",frame:0,
      }));
    }
    clock+=dt;
    for(const agent of agents.values()){
      if(!agent.route.length && clock>=agent.nextActionAt)selectAction(agent,garden,environment);
      if(agent.route.length && dt>0){
        const destination=agent.route[0],distance=Math.hypot(destination.x-agent.x,destination.y-agent.y);
        const travel=Math.min(distance,agent.pace*dt);
        if(distance<.03||travel>=distance){
          agent.x=destination.x;agent.y=destination.y;
          agent.route.shift();
          if(!agent.route.length){
            agent.activity="idle";
            agent.nextActionAt=clock+1.4;
          }
        }else{
          const dx=(destination.x-agent.x)/distance,dy=(destination.y-agent.y)/distance;
          agent.direction=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";
          agent.x+=dx*travel;agent.y+=dy*travel;
        }
      }
    }
    return snapshot();
  }
  function snapshot(){
    return [...agents.values()].map(agent=>({
      id:agent.id,speciesId:agent.speciesId,
      x:agent.x,y:agent.y,activity:agent.activity,direction:agent.direction,
      frame:Math.floor(clock*(agent.activity==="walk"?7:3))%4,
      greeting:COMPANION_PERSONALITIES[agent.speciesId].greeting,
    }));
  }
  function getAt(x,y,radius=1.1){
    return snapshot().filter(agent=>Math.hypot(agent.x-x,agent.y-y)<=radius)
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0] || null;
  }
  return {advance,snapshot,getAt,getCount:()=>agents.size};
}
