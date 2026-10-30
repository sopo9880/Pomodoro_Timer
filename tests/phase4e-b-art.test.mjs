import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {avatarIllustrationSvg,AVATAR_HIRES_SIZE} from "../garden/hires-avatar.mjs";
import {companionIllustrationSvg,wildlifeIllustrationSvg,
  ILLUSTRATED_COMPANIONS,ILLUSTRATED_WILDLIFE} from "../garden/hires-companions.mjs";
import {createHighResolutionAtlas,avatarIllustrationUri,HIGH_RES_ART_STYLE,
  companionIllustrationUri,wildlifeIllustrationUri} from "../garden/hires-atlas.mjs";
import {createGardenState,normalizeGardenState,GARDEN_COMPANIONS} from "../garden/garden-core.mjs";
import {WEARABLES} from "../garden/life-core.mjs";
import {WILDLIFE_SPECIES} from "../garden/ecology.mjs";

function checkSvg(xml,width,height){
  assert.match(xml,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(xml.endsWith("</svg>"));
  assert.match(xml,new RegExp('width="'+width+'" height="'+height+'"'));
  assert.doesNotMatch(xml,/<(?:script|foreignObject)\b|on(?:load|click)=|(?:href|src)="https?:\/\//i);
  assert.ok((xml.match(/<path /g)||[]).length>=4,"Original vector geometry required");
}
test("B avatar is an actual high-res 320x432 illustration with directional costumes",()=>{
  assert.deepEqual(AVATAR_HIRES_SIZE,{width:320,height:432});
  const base={hair:"hair-natural",outfit:"outfit-linen",hat:"hat-none",shoes:"shoes-travel"};
  const front=avatarIllustrationSvg(base,"down","idle",0);
  checkSvg(front,320,432);
  assert.ok(front.includes('id="iris"'));
  assert.ok(front.includes('id="hair"'));
  for(const direction of ["up","left","right"]){
    checkSvg(avatarIllustrationSvg(base,direction,"walk",1),320,432);
    assert.notEqual(avatarIllustrationSvg(base,direction,"walk",1),front);
  }
  for(const item of WEARABLES){
    const changed=avatarIllustrationSvg({...base,[item.slot]:item.id});
    checkSvg(changed,320,432);
    if(base[item.slot]!==item.id)assert.notEqual(changed,front,"Wearable must remain visible: "+item.id);
  }
  assert.match(avatarIllustrationUri(base),/^data:image\/svg\+xml;charset=utf-8,/);
});
test("all six saved companions have individually authored 256px B-look illustrations",()=>{
  assert.equal(ILLUSTRATED_COMPANIONS.length,6);
  assert.deepEqual([...ILLUSTRATED_COMPANIONS].sort(),
    GARDEN_COMPANIONS.map(c=>c.speciesId).sort());
  const unique=new Set();
  for(const species of ILLUSTRATED_COMPANIONS){
    const svg=companionIllustrationSvg(species,"down","idle",0);
    checkSvg(svg,256,256);unique.add(svg);
    const picked=companionIllustrationSvg(species,"left","picked",1,"surprised");
    checkSvg(picked,256,256);
    assert.notEqual(svg,picked);
    assert.ok(companionIllustrationUri(species).length>2000);
  }
  assert.equal(unique.size,6);
});
test("all fourteen wildlife IDs have unique high-res local images",()=>{
  assert.equal(ILLUSTRATED_WILDLIFE.length,14);
  assert.deepEqual([...ILLUSTRATED_WILDLIFE].sort(),WILDLIFE_SPECIES.map(x=>x.id).sort());
  const unique=new Set();
  for(const species of ILLUSTRATED_WILDLIFE){
    const svg=wildlifeIllustrationSvg(species,0);
    checkSvg(svg,256,256);unique.add(svg);
    assert.ok(wildlifeIllustrationUri(species).length>2000);
  }
  assert.equal(unique.size,14);
  assert.equal(HIGH_RES_ART_STYLE.allSpecies,20);
});
test("asset loader uses local SVG data only, bounded mobile cache and safe unready fallback",()=>{
  const urls=[];
  class FakeImage{
    complete=false;naturalWidth=0;decoding="";
    set src(src){this._src=src;urls.push(src);}
    get src(){return this._src;}
  }
  const atlas=createHighResolutionAtlas({ImageClass:FakeImage,limit:16});
  assert.equal(atlas.avatar({}),null,"No unloaded SVG may be drawn");
  assert.equal(atlas.avatar({}),null,"Duplicate requests must not reload");
  assert.equal(urls.length,1);
  assert.match(urls[0],/^data:image\/svg\+xml;charset=utf-8,/);
  for(const id of ILLUSTRATED_COMPANIONS)atlas.companion(id,"down","idle",0);
  for(const id of ILLUSTRATED_WILDLIFE)atlas.wildlife(id,0);
  assert.ok(atlas.stats().cachedImages<=16);
  assert.equal(atlas.stats().capacity,16);
  assert.ok(urls.every(x=>!x.includes("https%3A%2F%2F")));
  assert.equal(createHighResolutionAtlas({ImageClass:null}).avatar({}),null);
});
test("existing save, timer, guest, inventory and wearable IDs remain unchanged",()=>{
  const original=createGardenState();
  const restored=normalizeGardenState(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored,original);
  assert.deepEqual(Object.keys(restored.avatar.equipped).sort(),["hair","hat","outfit","shoes"]);
  assert.equal(restored.wallet.timePoints,0);
  assert.equal(restored.guest.mode,"guest");
  assert.equal(restored.schemaVersion,2);
});
test("full premium interface is linked, mobile-aware, self-contained, and cached",()=>{
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  const css=readFileSync(new URL("../ui/b-theme.css",import.meta.url),"utf8");
  const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
  const runner=readFileSync(new URL("../garden/pixel-world.mjs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../garden/garden-ui.mjs",import.meta.url),"utf8");
  const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
  assert.match(html,/href="ui\/b-theme\.css"/);
  assert.match(html,/<img id="avatarPreview"/);
  assert.match(html,/<img id="bFocusAvatar"/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/\.game-mobile-nav/);
  assert.match(css,/\.game-focus-hud/);
  assert.match(css,/\.garden-companion-sprite/);
  assert.match(css,/\.avatar-shop-preview/);
  assert.match(ui,/avatarIllustrationUri/);
  assert.match(ui,/companionIllustrationUri/);
  assert.match(ui,/wildlifeIllustrationUri/);
  assert.match(runner,/hiresArt\.avatar/);
  // Phase 4H: companions are drawn only from painted art (never the older SVG mid-animation).
  assert.match(runner,/painted\.companion/);
  assert.match(runner,/painted\.wildlife/);
  // A previous phase must not block forward-compatible PWA cache updates.
  assert.match(sw,/bloomodoro-cache-v\d+/);
  for(const asset of ["garden/hires-avatar.mjs","garden/hires-companions.mjs",
       "garden/hires-atlas.mjs","ui/b-theme.css","ui/flower-ornament.svg"]){
    assert.ok(sw.includes(asset),"Missing offline asset "+asset);
  }
  for(const script of ["garden/hires-avatar.mjs","garden/hires-companions.mjs",
       "garden/hires-atlas.mjs"])assert.ok(ci.includes(script));
});
