/**
 * Player-owned avatar input and transient path interpolation. Unlike companion
 * autonomy, this controller only moves the player after explicit input.
 */
import { findCompanionPath } from "./companion-ai.mjs";
import { avatarCanStand, moveAvatar } from "./life-core.mjs";
const facing=(dx,dy,fallback="down")=>Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":
  Math.abs(dy)>0?dy>0?"down":"up":fallback;
export function createAvatarMotion(map){
  if(!map?.getTile)throw new TypeError("Valid world map required");
  let position=null,route=[],direction="down",frame=0,moving=false;
  function sync(avatar){
    if(!avatar)return;
    if(!position||(!route.length&&Math.hypot(avatar.x-position.x,avatar.y-position.y)>.1)){
      position={x:avatar.x,y:avatar.y};
      direction=avatar.direction||"down";
    }
  }
  function cancel(){route=[];moving=false;}
  function step(garden,dx,dy){
    sync(garden.avatar);
    cancel();
    const x=Math.floor(position.x)+dx+.5,y=Math.floor(position.y)+dy+.5;
    direction=facing(dx,dy,direction);
    const next=moveAvatar(garden,map,x,y,direction);
    position={x,y};
    frame=(frame+1)%4;
    return next;
  }
  function goTo(garden,x,y){
    sync(garden.avatar);
    if(!avatarCanStand(garden,map,x,y))return false;
    const path=findCompanionPath(map,garden,position,{x,y},7600);
    if(!path.length)return false;
    route=path;
    moving=true;
    return true;
  }
  function advance(dt=.1){
    if(!route.length||!position)return {done:false,moving:false};
    let remaining=Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0))*4.6;
    while(remaining>0&&route.length){
      const next=route[0],dist=Math.hypot(next.x-position.x,next.y-position.y);
      const step=Math.min(remaining,dist);
      const dx=next.x-position.x,dy=next.y-position.y;
      direction=facing(dx,dy,direction);
      if(dist<.001||step>=dist){
        position={...next};
        route.shift();
      }else{
        position={x:position.x+dx/dist*step,y:position.y+dy/dist*step};
      }
      remaining-=step;
      frame=(frame+1)%4;
    }
    if(!route.length){
      moving=false;
      return {done:true,moving:false,position:{...position},direction};
    }
    return {done:false,moving};
  }
  function visual(){return position?{...position,direction,frame,moving}:null;}
  function isMoving(){return route.length>0;}
  return {sync,step,goTo,advance,visual,cancel,isMoving};
}
