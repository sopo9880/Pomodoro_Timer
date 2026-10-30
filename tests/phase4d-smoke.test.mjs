import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("4D uses continuous keyboard input, bounded saves, camera easing and drag/drop indicators",()=>{
  const ui=readFileSync(new URL("../garden/garden-ui.mjs",import.meta.url),"utf8");
  const renderer=readFileSync(new URL("../garden/pixel-world.mjs",import.meta.url),"utf8");
  const motion=readFileSync(new URL("../garden/avatar-motion.mjs",import.meta.url),"utf8");
  assert.match(ui,/avatarMotion\.setHeld\(direction,true\)/);
  assert.match(ui,/avatarMotion\.setHeld\(direction,false\)/);
  assert.match(ui,/saveAvatarPosition\(true\)/);
  // 4I replaced the dead-zone snap with a frame-rate independent spring.
  assert.match(ui,/function followCamera\(/);
  assert.match(ui,/1-Math\.exp\(-elapsed\*4\.5\)/);
  assert.match(ui,/dropPreview=\{x:pos\.x,y:pos\.y,allowed\}/);
  assert.match(renderer,/drawInteractionMarker/);
  assert.match(renderer,/getAvatarAt/);
  assert.match(motion,/const parts=Math\.max\(1,Math\.ceil\(distance\/\.12\)\)/);
});
test("4D keeps the legacy save data and refreshes PWA source cache",()=>{
  const core=readFileSync(new URL("../garden/garden-core.mjs",import.meta.url),"utf8");
  const script=readFileSync(new URL("../script.js",import.meta.url),"utf8");
  const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
  assert.match(core,/GARDEN_SCHEMA_VERSION = 2/);
  assert.match(script,/bloomodoro-state-v3/);
  // Phase 4D checks that a versioned cache exists; newer visual releases bump it.
  assert.match(sw,/bloomodoro-cache-v\d+/);
  for(const path of ["garden/avatar-art.mjs","garden/companion-art.mjs","garden/avatar-motion.mjs","garden/garden-ui.mjs"]){
    assert.ok(sw.includes(path),"Offline module missing: "+path);
  }
});
