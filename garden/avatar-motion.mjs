/**
 * Phase 4D — responsive direct player movement, low-latency key holds, and
 * click-to-walk interpolation. Transient motion does not mint any focus time
 * or spend currency; only the final legal world coordinate is saved.
 *
 * Backwards compatible with 4C: step(), goTo(), advance(), visual(), sync().
 */
import { findCompanionPath } from "./companion-ai.mjs";
import { avatarCanStand, moveAvatar } from "./life-core.mjs";

export const AVATAR_WALK_SPEED = 5.1; // world tiles per second
const DIRECTIONS = Object.freeze(["up","down","left","right"]);
const vectors = Object.freeze({up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]});
const EPS = 1e-5;
const clamp = value => Number.isFinite(value) ? Math.min(.08,Math.max(0,value)) : 0;
function face(dx,dy,fallback="down"){
  if(Math.abs(dx)>Math.abs(dy))return dx>0?"right":"left";
  if(Math.abs(dy)>EPS)return dy>0?"down":"up";
  return fallback;
}
function pointFrom(value) {
  return {x:value.x,y:value.y};
}
export function createAvatarMotion(map){
  if(!map?.getTile)throw new TypeError("A valid garden world map is required");
  let position=null,route=[],direction="down",frame=0,walked=0,pose="idle";
  const keys=new Set();
  function isControlled(){return keys.size>0;}
  function isMoving(){return isControlled()||route.length>0;}
  function sync(avatar,force=false){
    if(!avatar)return;
    if(force||!position||(!isMoving()&&Math.hypot(avatar.x-position.x,avatar.y-position.y)>.09)){
      position=pointFrom(avatar);
      direction=avatar.direction||"down";
      if(force){route=[];keys.clear();pose="idle";}
    }
  }
  function cancel(){route=[];keys.clear();pose="idle";}
  function releaseAll(){keys.clear();}
  function setHeld(key,pressed){
    if(!DIRECTIONS.includes(key))return false;
    if(pressed){
      route=[];
      keys.add(key);
    }else keys.delete(key);
    if(!keys.size&&!route.length)pose="idle";
    return true;
  }
  function inputVector(){
    let dx=Number(keys.has("right"))-Number(keys.has("left"));
    let dy=Number(keys.has("down"))-Number(keys.has("up"));
    const scale=Math.hypot(dx,dy)||1;
    return {dx:dx/scale,dy:dy/scale};
  }
  function record(delta){
    if(delta<=EPS)return;
    walked+=delta;
    frame=Math.floor(walked*5.5)%6;
    pose="walk";
  }
  // Legacy one-cell API stays available to existing tests and integrations.
  function step(garden,dx,dy){
    sync(garden.avatar);
    cancel();
    const x=Math.floor(position.x)+dx+.5;
    const y=Math.floor(position.y)+dy+.5;
    const facing=face(dx,dy,direction);
    const next=moveAvatar(garden,map,x,y,facing);
    position={x,y};direction=facing;
    record(Math.hypot(dx,dy));
    return next;
  }
  function goTo(garden,x,y){
    sync(garden.avatar);
    releaseAll();
    if(!avatarCanStand(garden,map,x,y)||!position)return false;
    // Original grid route starts from the player's current fractional cell;
    // valid endpoints are centered on tile coordinates for clean final saves.
    const destination={x:Math.floor(x)+.5,y:Math.floor(y)+.5};
    if(Math.hypot(position.x-destination.x,position.y-destination.y)<.15){
      route=[];pose="idle";return false;
    }
    const path=findCompanionPath(map,garden,position,destination,7600);
    if(!path.length)return false;
    route=path;pose="walk";
    return true;
  }
  function slide(garden,dx,dy){
    if(!position)return false;
    const distance=Math.hypot(dx,dy);
    if(distance<EPS)return false;
    // Substeps ensure even slow frame delivery cannot tunnel through
    // narrow water channels, buildings, plants or locked region boundaries.
    const parts=Math.max(1,Math.ceil(distance/.12));
    const stepX=dx/parts,stepY=dy/parts;
    let didMove=false;
    for(let i=0;i<parts;i++){
      const p=position;
      if(avatarCanStand(garden,map,p.x+stepX,p.y+stepY)){
        position={x:p.x+stepX,y:p.y+stepY};
        record(Math.hypot(stepX,stepY));
        didMove=true;
      }else if(Math.abs(stepX)>EPS&&avatarCanStand(garden,map,p.x+stepX,p.y)){
        position={x:p.x+stepX,y:p.y};
        record(Math.abs(stepX));
        didMove=true;
      }else if(Math.abs(stepY)>EPS&&avatarCanStand(garden,map,p.x,p.y+stepY)){
        position={x:p.x,y:p.y+stepY};
        record(Math.abs(stepY));
        didMove=true;
      }else break;
    }
    return didMove;
  }
  /**
   * advance() returns a current visual coordinate every simulation step.
   * The controller never calls setGarden — the UI batches commits.
   */
  function advance(dt=.1,garden=null){
    if(!position)return {done:false,moving:false,changed:false};
    const time=clamp(dt);
    if(keys.size){
      const {dx,dy}=inputVector();
      const before=pointFrom(position);
      if(dx!==0||dy!==0) {
        direction=face(dx,dy,direction);
        if(garden)slide(garden,dx*AVATAR_WALK_SPEED*time,dy*AVATAR_WALK_SPEED*time);
      }
      const changed=Math.hypot(before.x-position.x,before.y-position.y)>EPS;
      if(!changed)pose="idle";
      return {done:false,moving:true,changed,position:pointFrom(position),direction};
    }
    if(!route.length){
      pose="idle";
      return {done:false,moving:false,changed:false,position:pointFrom(position),direction};
    }
    let remaining=time*AVATAR_WALK_SPEED;
    const before=pointFrom(position);
    while(remaining>EPS&&route.length){
      const next=route[0];
      const vx=next.x-position.x,vy=next.y-position.y;
      const distance=Math.hypot(vx,vy);
      if(distance<EPS){route.shift();continue;}
      if(garden&&!avatarCanStand(garden,map,next.x,next.y)){
        route=[];pose="idle";return {done:false,moving:false,blocked:true,changed:false,position:pointFrom(position),direction};
      }
      const actual=Math.min(distance,remaining);
      direction=face(vx,vy,direction);
      const moved=actual>=distance?{...next}:{
        x:position.x+(vx/distance)*actual,
        y:position.y+(vy/distance)*actual,
      };
      position=moved;
      record(actual);
      remaining-=actual;
      if(actual>=distance-EPS)route.shift();
    }
    const changed=Math.hypot(before.x-position.x,before.y-position.y)>EPS;
    const done=route.length===0;
    if(done)pose="idle";
    return {done,moving:!done,changed,position:pointFrom(position),direction};
  }
  function visual(){
    return position?{...position,direction,frame,moving:isMoving(),pose}:null;
  }
  function target(){
    return route.length?{...route[route.length-1]}:null;
  }
  return {
    sync,cancel,releaseAll,setHeld,isControlled,isMoving,
    step,goTo,advance,visual,target,
  };
}
