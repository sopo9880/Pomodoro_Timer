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
