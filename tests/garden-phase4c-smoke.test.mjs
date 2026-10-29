import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("all phase 4C controls exist exactly once, and old timer controls remain",()=>{
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  const core=readFileSync(new URL("../script.js",import.meta.url),"utf8");
  const garden=readFileSync(new URL("../garden/garden-ui.mjs",import.meta.url),"utf8");
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,"Duplicate ids");
  const refs=[
    ...core.matchAll(/document\.getElementById\("([^"]+)"\)/g),
    ...garden.matchAll(/byId\("([^"]+)"\)/g),
  ].map(x=>x[1]);
  for(const id of refs)assert.ok(ids.includes(id),"Missing ID "+id);
  for(const id of ["avatarSelectButton","avatarPreview","gardenCodexEntries","guestDisplayName",
     "guestNickname","gardenSunshine","gardenAvatar","gardenCodex","gardenWorld"]){
    assert.ok(ids.includes(id),id);
  }
});
test("phase 4C offline cache lists new modules and Node CI checks them",()=>{
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
 for(const path of ["garden/life-core.mjs","garden/avatar-art.mjs","garden/avatar-motion.mjs"]){
   assert.ok(sw.includes(path),"Uncached: "+path);
   assert.ok(ci.includes(path),"Unchecked: "+path);
 }
 assert.match(sw,/bloomodoro-cache-v15/);
});
