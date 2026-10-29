# Bloomodoro Phase 4 — staged development, single formal release

## Policy

Phase 4 is divided into 4A (world), 4B (companions and plant ecology), and 4C (collections, interactions, final quality). Each subphase gets its own development PR and lightweight CI. **Do not publish a new formal GitHub Release or release binaries until all 4A/4B/4C checks are complete.** Existing `v1.0.0` assets/tags are immutable.

There is no Android APK build in this work. GitHub Pages can deploy on changes merged into main, but a Pages preview/deployment is not a signed/formal GitHub Release. Real-device feature verification is performed by the user following the final formal release.

## Phase 4A — world art and engine (this PR)

### World geometry
- Preserve `WORLD_SPEC` with width=160, height=160, tileSize=32; preserve all six region rectangles, unlock thresholds and IDs.
- All six region scenes have three originally designed landmarks, a thematic 32×32 floor palette, original 64px landmark pixel motifs, and an explicit local region descriptor.
- A single network of stone paths/wood bridges connects region centers. Forest, workshop, greenhouse, pond and starlight regions have distinct ground types.
- Deterministic procedural scenery does not enter saved state. The same coordinates always resolve to the same floor.

### Rendering
- `garden/world-map.mjs`: 16×16 lazy chunks, visible-chunk queries, region topology and map placement surface flags.
- `garden/tile-atlas.mjs`: original pre-rendered 32px terrain tiles and 64px landmark canvases, cached by season/kind.
- `garden/pixel-world.mjs`: renders only visible chunks with scenic landmark layers under users' placed objects and companions.
- `garden/minimap.mjs`: capped lightweight world overview with region fog, landmarks, viewport outline and click-based camera navigation.
- `garden/garden-ui.mjs`: togglable mini-map, region heading, anchored pan/pinch zoom, and navigation keyboard controls.
- Cache updated to include all new modules for offline PWA execution.

### Save compatibility contract
- `bloomodoro-state-v3` is unchanged; `GARDEN_SCHEMA_VERSION` remains 2.
- Existing `placements`, `plants`, `companions`, `progress`, `wallet`, `inventory` and unlocks are not altered.
- New placement checks reject underwater/bridge tiles. Normalizing an existing save **does not** apply the new placement restriction, preserving previously owned objects with old coordinates.
- No focus reward code or settings logic is modified by this phase.

### Verification
- `node --test tests/*.test.mjs`: deterministic terrain, six-region reachability, chunk cache, original artwork, camera zoom, minimap and old-save preservation.
- `node --check`: core, world, atlas, renderer, minimap, UI and other JavaScript.
- Browser QA remains required after CI: Desktop Chrome/Edge (map, pointer anchor, cache, region labels), Android Chrome (two-finger pinch, single-finger pan, map toggle, PWA offline) and save migration. No claim of actual hardware testing during PR development.

## Phase 4B — not implemented in 4A

- Character sprite sheets, 4-direction animations and pathfinding/idle activity.
- Plant growth presentation and new plant species (retaining actual focus-time logic).
- Zone-dependent wildlife, ecology and meaningful day/night interactions.

## Phase 4C — not implemented in 4A

- Plant/companion/nature/decoration discovery encyclopedia, item expansions, and interaction stories.
- Usability/accessibility performance pass and formal QA for existing saves, multiple tabs, background timer and offline PWA.
- After all Phase 4 checks pass, create the **single** requested formal release from the final approved commit; no rebuild/overwrite of earlier releases.

## Next actions

After PR CI starts, report the Actions link and end the development turn. On the user's next `확인해`, inspect the exact HEAD run and follow the PR merge/deployment workflow. Begin Phase 4B only on an explicit development instruction. Do not create duplicate releases.


## Phase 4B implementation details (pending PR CI)

- `garden/companion-ai.mjs`: transient, bounded BFS obstacle avoidance and individual activity selection; no save writes; a companion's authoritative coordinates and affinity remain in v2 garden state.
- `garden/companion-art.mjs`: entirely original 32px four-direction animated companion pixel sprites, lazy cached.
- `garden/plant-art.mjs`: entirely original nine-species four-stage growth sprite atlas; preserves `growSeconds` arrays for all existing plants.
- `garden/ecology.mjs` and `garden/wildlife-art.mjs`: deterministic 14-species weather/season/time habitat sampling and cached 16px animated fauna.
- The existing renderer combines placements, plants, friends and wildlife by Y depth and avoids rendering invisible world actors; region map/minimap from 4A remain intact.
- Core catalog adds six new plants and three new companions, but the save format remains `GARDEN_SCHEMA_VERSION=2`. Existing item IDs, inventories, planted timestamps, user placement coordinates, accumulated focus and wallet amounts are preserved.
- Node tests must verify all new plant thresholds, friend recruitment/legacy saves, obstacle navigation, species conditions, sprite-atlas caching, data persistence and visual test mocks.
- Required later: browser visual validation on desktop/mobile and genuine multi-tab / offline validation in 4C. A release is not authorized by this PR.


## Phase 4C feature implementation (pending PR CI and browser QA)

- Keeps `bloomodoro-state-v3` and garden `GARDEN_SCHEMA_VERSION=2`; optional additive `avatar`, `guest`, `discovery` and `wallet.timePoints` fields normalize safely from prior data.
- Time points are minted only on actual credited focus minute boundaries, never on wall-clock time or user gestures. Historical sunshine spending power converts at 5 TP/sunshine only when a pre-4C save has no `timePoints` field. Once created, the spendable balance remains authoritative, including zero; reopening does not mint points again. Old items/inventories, petals and total focus stay intact.
- Player avatar has a 15-item wearable catalog (four slots), original art and direct user motion separate from autonomous companion AI. Companions support touch/mouse drag only, with temporary emotional animations, safe placement validation and persistence on accepted drops.
- Codex holds wildlife and landmark first encounters, deduces owned plants/decorations/companions from actual save to prevent duplicate counters, and retains unearned discoveries as silhouettes.
- Local guest identity requires no server and never promises remote login. MongoDB and cross-device sync remain out of Phase 4.
- Phase 4 final release should happen **only once** after PR CI, merged deploy tests, existing-save and guest-backup restoration, and user approval. Browser/device functional validation remains the user's post-release responsibility per project rules; before release perform automated tech checks and manual visual QA where accessible.
- Revisit multi-tab state conflicts and PWA offline storage behavior as explicit QA risks; PR CI unit tests alone do not prove real-browser consistency. Existing `v1.0.0` GitHub Release is preserved.

## Phase 4D — approved visual/interaction revision

### Design acceptance criteria

1. Original Polished JRPG direction (B) — botanically themed, elegant, detailed, soft premium colors; no reuse of non-original game character artwork. Player hair/cape/satchel/flowers, outfit shading, facial expression and accessories must read clearly at native scale.
2. All six companions have distinct silhouette and emotional states when picked up, released safely, or invalidly dropped.
3. Player held-key input is continuous; diagonal speed is normalized; animation and movement are independent of OS keyboard repeat and frame rate; walking/click target use current unlocked-zone collision rules.
4. A mouse or touch pointer shows an accepted/rejected companion drop marker before release. The avatar click target, current selection, destination and invalid destination are visible.
5. Keep the existing browser event routes and 4C state schema. When the input is not actively controlled, the ecosystem renderer uses a lower frame rate. Reduced motion must not change earned time or make avatar input slower.
6. No save reset, no duplicate earned time points, no change to optional guest identity or wearable ownership. No new APK/EXE build in this phase.
7. Keep both world camera pan and pinch zoom working alongside dragging companions. Test mobile taps and two-finger cancel. All keyboard actions should ignore typing into forms.

### Technical changes

- `garden/avatar-art.mjs`: original 48×64 premium botanical JRPG player sprite, 6-frame layered palette, all original wearable ID variants, and precise wardrobe preview.
- `garden/companion-art.mjs`: original 48×48 expressive full roster, directional face and reactions.
- `garden/avatar-motion.mjs`: held-key continuous movement with conservative substeps, sliding collision, normalized diagonals, explicit cancel and path override, stable 6-frame animation.
- `garden/pixel-world.mjs`: draw sprites at correct proportions, larger physical hit zones, elliptical selection ring, goal and drop validity marks.
- `garden/garden-ui.mjs`: combined pointer/keyboard control, immediate first motion, batched safe-save, camera follow deadzone, adaptive animation refresh.
- `sw.js`: v16 asset cache; original manifest and storage key unchanged.
- `tests/phase4d-*.`: collision, input, animation cache, save invariants, PWA smoke and HTML/wiring verification.

### Release gate

Keep original formal `v1.0.0` intact. After Phase 4D development CI, merge and deploy verification, assess the combined Phase 4A–4D baseline and prepare **one approved formal release**; do not publish another release or recompile APK/EXE here. Real-device verification is performed by the user after final release per project policy.
