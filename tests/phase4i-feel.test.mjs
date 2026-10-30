import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NECK } from "../garden/avatar-rig.mjs";

const ui = readFileSync(new URL("../garden/garden-ui.mjs", import.meta.url), "utf8");

test("walking does not repaint the collection drawer", () => {
  const fp = ui.slice(ui.indexOf("const fingerprint = JSON.stringify({"), ui.indexOf("if (force || fingerprint !== lastFingerprint)"));
  assert.ok(fp.length > 0);
  assert.doesNotMatch(fp, /avatar:\s*garden\.avatar[,}\s]/, "avatar position must not be part of the card fingerprint");
  assert.match(fp, /equipped:garden\.avatar\?\.equipped/);
});

test("held keys and taps do not force a full UI repaint", () => {
  assert.match(ui, /if\(event\.repeat\)return;/);
  const keydown = ui.slice(ui.indexOf('document.addEventListener("keydown"'), ui.indexOf('document.addEventListener("keyup"'));
  assert.doesNotMatch(keydown, /refresh\(true\)/);
  assert.match(ui, /const AVATAR_SAVE_INTERVAL = \d{4};/);
});

test("camera follows with a spring and look-ahead, and yields to a manual pan", () => {
  assert.match(ui, /function followCamera\(player,elapsed,now\)/);
  assert.match(ui, /camera\.following=false;/);
  assert.doesNotMatch(ui, /rect\.width\*\.18/, "the old dead-zone is gone");
});

test("the head sits low on a neck that matches the jaw", () => {
  for (const v of ["front", "side"]) {
    assert.ok(NECK[v].chin < 0.25, v + " chin stays close to the collar");
    assert.ok(NECK[v].width > 1.05, v + " neck is widened to the jaw");
  }
});
