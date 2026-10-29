# 🌸 Bloomodoro: Elegant Focus Rhythm

**Bloomodoro**는 감각적인 디자인과 강력한 백그라운드 안정성을 결합한 차세대 웹 포모도로 타이머입니다. 단순한 시간 측정을 넘어, 모바일 브라우저의 제약을 극복하고 사용자의 몰입(Flow)을 깨지 않는 최적의 사용자 경험을 제공합니다.


## ✨ 핵심 차별점 (Core Highlights)

### 1. 강력한 백그라운드 생존력 (Background Persistence)
모바일 OS(iOS/Android)의 엄격한 배터리 관리 정책을 우회하기 위해 **'10Hz 초저주파 무음 오디오'** 및 **'아날로그 째깍 소리(ASMR)'** 기법을 도입했습니다. 화면이 꺼져도 타이머가 중단되지 않고 정해진 시간에 정확히 알림을 보냅니다.

### 2. 잠금 화면 실시간 컨트롤 (Media Session API)
음악 재생 앱처럼 잠금 화면이나 상단 알림창에서 타이머의 남은 시간을 실시간으로 확인하고, 시작/일시정지/건너뛰기를 즉시 조작할 수 있습니다.

### 3. 하이브리드 타이머 아키텍처
- **Web Worker**: 메인 스레드 정지 시에도 정확한 연산을 유지하여 타이머 드리프트를 원천 차단합니다.
- **State Recovery**: 앱이 완전히 종료되었다가 다시 열려도 서버 시간 기반으로 누락된 세션을 계산하여 복구합니다.

### 4. 설치형 PWA (Progressive Web App)
- **Installable**: 홈 화면에 추가하여 네이티브 앱과 동일한 경험을 제공합니다.
- **Offline Ready**: 서비스 워커(Service Worker)를 통해 네트워크 연결 없이도 완벽하게 동작합니다.

---

## 🚀 주요 기능 (Features)

- **세밀한 모드 설정**: 집중(Pomodoro), 짧은 휴식, 긴 휴식 모드 및 사이클 관리.
- **나만의 리듬**: Classic(25/5), Flow(30/7), Deep(50/10) 프리셋 및 커스텀 시간 조정.
- **시청각 피드백**: 맑고 선명한 알림음 톤 선택, 안드로이드 전용 진동 패턴 지원.
- **데스크톱 최적화**: 미니 타이머(Document Picture-in-Picture) 창을 통한 상시 표시 기능.
- **통계 및 기록**: 오늘 하루 동안의 집중 누적 시간과 세션 로그 자동 기록.

---

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: Vanilla JavaScript (ES6+), CSS3 (Modern Glassmorphism UI)
- **Background**: Web Workers API, Service Workers
- **Audio**: Web Audio API, Media Session API
- **Storage**: LocalStorage (Persistent State Management)
- **Build/Deploy**: GitHub Actions, GitHub Pages

---

## 📦 설치 및 실행 (Setup)

정적 파일 구조이므로 어떤 서버 환경에서도 동작하지만, PWA와 모바일 테스트를 위해 로컬 서버 실행을 권장합니다.

```bash
# 로컬 서버 실행 (Node.js 필요)
node server.js
```

이후 브라우저에서 `http://localhost:4173`으로 접속합니다.

---

## 📄 라이선스 및 제작
- **Author**: Gwonhc (Kwon Hee-chang), Dong-a University AI Dept.
- 본 프로젝트는 교육 및 개인 몰입 도구로서 오픈소스로 제공됩니다.

---

### 💡 Tip: 백그라운드 오디오 설정
모바일에서 안정적인 알림을 받으려면 **[설정] > [백그라운드 오디오 유지]** 토글을 켜주세요. 10Hz 초저주파 또는 아날로그 시계 소리를 통해 시스템의 절전 모드 진입을 효과적으로 방지합니다.


## 🌿 Pixel Garden (phase 2)

The **나의 픽셀 정원** section below the timer includes a continuous tile world rendered with original pixel sprites (no licensed external artwork), the starter Daisy plant, editable decorations, the sunshine shop, unlockable companion characters (Sprout / Mushroom / Cat), and real-focus-time plant growth. Mouse drag or touch to pan; wheel or pinch to zoom; choose inventory items to place; click an existing object to move, rotate or return it to the inventory. Keyboard users can focus the canvas and use arrows, +/- and Enter to place at the camera center. Region selector jumps to one of six connected zones. Garden editing is paused while a focus session is active to protect concentration.

The garden data model is a versioned JSON object within `bloomodoro-state-v3`, with schema-v1 migration. Web/PWA remains the deployment target; Android APK and native notification integration have **not** been implemented. Run the lightweight unit tests with `node --test tests/*.test.mjs` (Node 22+). Visual garden assets use Canvas 2D for portability.


## 🎮 The Little World — game-first UI (phase 3)

Bloomodoro now opens on a full-screen pixel garden **instead of appending a garden panel below the old timer**. The game shell provides persistent focus HUD, a pixel-world exploration viewport, a compact backpack/companions dock, routed Focus / Journey / Settings screens, and a touch-friendly mobile bottom navigation. No previously existing timer, data or settings IDs were removed. All timer controls and saved states remain backward compatible with `bloomodoro-state-v3`.

Garden scene choices — Spring/Summer/Autumn/Winter, clear/rain/snow, day/night — run offline as **presentation-only** settings in `bloomodoro-world-display-v1`. They do not request geolocation, use a weather API, or change focus rewards. Focus time adds companion affinity each cumulative 25 minutes without penalties for breaks.

The pixel garden renderer draws only visible 32px tiles and caps weather particles; when the garden screen is hidden, animation stops. The UI respects reduced-motion settings. In Node 22+, verify with `node --test tests/*.test.mjs`. Android APK packaging is a separate future stage; web/PWA is the current supported output.

## 🌲 Phase 4A — immersive world foundations

Phase 4A builds six fully connected thematic tile-map regions **without moving the existing 160×160 world coordinates or changing user save formats**:

- 18 original fixed scenic landmarks and five biomes of detailed 32px tiles, along with pond/bridge paths, forest floor, greenhouse flowers, workshop stonework, and starlit hills.
- Deterministic lazy 16×16 map chunks and cached original pixel-art textures; only visible chunks are rendered.
- Clickable/keyboard-usable minimap with unlocked/locked region indication and viewport locator.
- Pointer-anchored wheel/pinch zoom with pan gestures, and view/camera boundaries within the playable world.
- The same focus ledger, rewards, garden schema v2, object placements and inventory. Existing saved decorations remain in place.
- New placements cannot be made on pond water or bridges, but old placements are **not** moved or erased.
- Added topology, sprite cache, minimap, legacy-save compatibility, and renderer tests.

See [docs/phase4-plan.md](docs/phase4-plan.md) for the release gate and remaining 4B/4C work. **Phase 4A is PR-only; do not publish a release until the entire Phase 4 is finished.**


## 🐾 Phase 4B — companions, flowers and local wildlife (development only)

Phase 4B extends the connected world without changing `bloomodoro-state-v3`, `GARDEN_SCHEMA_VERSION = 2`, plant planting timestamps or accumulated focus rewards.

- **Six collectable original companions:** Moa (sprout), Mori (mushroom), Naru (cat), Lulu (sparrow), Toto (turtle), Hani (fox). Three new companions become recruitable at 12/20/35 cumulative focus hours. Their 32px sprite sheets include 4-facing walk, idle and personal activities. Transient companion agents navigate grid paths around ponds and decorations; animation does **not** change stored companion positions.
- **Nine focus-grown flower types:** original Daisy, Rose and Tulip growth thresholds unchanged; new Clover (30m), Lavender (45m), Hydrangea (120m), Sunflower (150m), Lotus (160m) and Starflower (200m). Four existing growth stages are visualized by original 32px animated pixel assets. New seeds are unlocked by cumulative focus and grow only through **newly credited active focus** after planting.
- **Fourteen original ambient wildlife species:** populated by zone, season, rain/snow and day/night. The ecology is local/offline, visual-only and capped at 20 simultaneous visible inhabitants; no simulated focus credits, hidden rewards or extra storage writes.
- **Game interactions:** clicking a visible companion while not focusing shows a short, gentle greeting. The existing garden inventory and companion cards render the new species and their pixel-art thumbnails. Reduced-motion mode shows stationary original sprites.
- **PWA:** all new modules are cached for offline use, and GitHub PR CI runs Node built-in tests and syntax validation.

**Release gate:** 4B is PR-only. Phase 4C (encyclopedia, story interactions, data-recovery/multitab/offline QA and final polish) is **not** included. Formal publication remains deferred until the entire Phase 4 is approved.


## ♙ Phase 4C — avatar, time points, guest mode and garden discovery (PR-only)

- **Time currency:** one **time point (TP)** per whole minute of newly credited active focus. Historical sunshine balance is converted at the original 5-minutes-per-sunshine purchasing rate on save migration, plus its unrewarded 0-4 minute remainder. Inventory, lifetime focus and flower petals are preserved. Garden shop prices use the equivalent 5 TP per former sunshine; outfit prices are measured directly in TP. The existing sunshine field is retained as historical data and must not be removed by save migration.
- **Player avatar:** a separately controllable player character, with original layered 32×48 art, a 15-item wardrobe, purchased and equipped outfit/hair/hat/shoes slots, WASD/arrow-key stepping and pointer-to-walk route navigation (only while the garden is not locked by an active focus timer).
- **Companion interactions:** friends remain autonomous, do **not** accept player WASD input. Drag a companion to pick it up (surprised/wiggle animation), then release on a valid walkable tile for a short happy reaction. Cancel, locked zones, water and collisions restore the previous position. Companion drop writes only the single accepted position; earned focus and affinity are unchanged.
- **Local guest mode:** the existing web/PWA experience starts as a local guest automatically, without registration or backend secrets. A changeable guest nickname is stored inside the garden save and can be backed up. This **is not** an online user account or an actual MongoDB login. Cloud accounts remain a separate future project.
- **Discovery book:** plant, decorative item and companion ownership appear automatically; clicking visible wildlife or regional landmarks records the first discovery. Undiscovered entries remain concealed. The book uses additive IDs compatible with old garden JSON backups.
- **Testing and release:** Node tests cover economic migration, lifetime-versus-spendable minutes, outfit ownership, movement/drag safety, discovery idempotency, old saves, and offline cache. **Phase 4C is not a formal release; after PR CI, merge/deploy checks and browser acceptance, release all of Phase 4 once from one final commit.**

Not yet validated on real devices: visual polish, mobile touch nuance, concurrent tabs, and cloud synchronization. Do not count those as passed until independently tested.

## 🎨 Phase 4D — Polished JRPG character and game-feel pass (PR only)

The artwork direction is **B — Polished JRPG**: original botanical fantasy characters with warm cream, forest/sage green, leather-brown silhouettes, detailed layered clothing, expressive faces and shaded ornamental accents. The game sprites are hand-authored, deterministic local pixel canvases and **not** cropped from a large presentation illustration.

- **Player**: the original `avatar-art.mjs` 32×48 placeholder is now a **48×64** layered sprite with 4 facing directions and 6 walking/idle frames. The same saved `hair-*`, `outfit-*`, `hat-*` and `shoes-*` IDs work; no repurchase, reset or schema migration.
- **Six companions**: renewed **48×48** silhouettes for sprout, mushroom, cat, sparrow, turtle and fox, with unique botanical details, directional faces and picked-up/surprised/happy expressions. Existing recruitment, friendship, saved locations and purchases remain unchanged.
- **Responsive input**: holding WASD/arrow keys now moves continuously, allowing diagonal movement at normalized speed. Click-to-move uses the existing obstacle-aware routes; key input cancels a current auto-route immediately. Movement tests cover collisions with water, locked areas and objects.
- **Feedback**: improved avatar/companion body hit-boxes; high-frequency drawing while moving (frugal idle mode); soft player camera follow; highlighted selected player; visible drop-valid/drop-invalid and click-destination markers; tactile cursors and touch-safe pointer thresholds.
- **Storage safety**: animation is transient, coordinates are batch-saved and flushed on key release or loss of focus; the timer, time points, guest profile, wearables, plant growth and garden v2 schema remain untouched.
- **PWA**: cache updated to `bloomodoro-cache-v16` for offline updates.
- **Quality gates**: PR checks run all existing and new Node tests, syntax checks and offline smoke tests. A browser/mobile visual review is still required before calling the character art production-grade. The reference concept illustration is a quality target, not a promise of exact in-game raster similarity.

**Phase 4D is not a formal GitHub Release.** Do not merge this PR or publish a new tag until the requested CI/merge/release stages.


## Phase 4E — B visual overhaul (development PR; not yet a release)

**Visual direction:** the selected **B — Polished JRPG** concept and uploaded character-sheet references. This changes **game rendering assets and the full interface**, not just the mockup. The first production vector-illustration pass is botanically themed and has transparent backgrounds, flowing illustrated hair, expressive amber eyes, embroidered apron/cape, floral accessories and satchel. **It is a re-illustration and not a pixel-identical extraction of the original concept artwork.** Distinct hand-painted frame sheets would be a later art-production task.

- `garden/hires-avatar.mjs`: original local **320×432 SVG** protagonist, 4 facing directions, 3 motion variations, and color-/accessory-aware hair, outfit, hat and footwear. Existing 15 wearable IDs, ownership, prices and equip records remain authoritative; no saves are changed.
- `garden/hires-companions.mjs`: original local **256×256 SVG** artworks for sprout, mushroom, cat, sparrow, turtle and fox, including look-direction and pick-up emotions, plus 14 distinct **256×256** illustrated environmental species. Original species IDs and gameplay are preserved.
- `garden/hires-atlas.mjs`: **local data-URI SVG-to-Image cache** (96 decoded assets maximum by default), asynchronous safe fallback to original pixel sprite if the illustration has not loaded, no remote image requests or runtime build steps.
- `garden/pixel-world.mjs`: draw the new illustrations onto the actual world with correct aspect ratios and anti-aliasing; tiles, grown plants and decorations retain current authored pixel look. Larger character hit areas stay accessible for mobile drag and navigation.
- `garden/garden-ui.mjs` and `index.html`: illustrated main character portrait/wardrobe merchandise previews, six companion portraits, collectible wildlife illustrations, focus-camp avatar and B art handling via existing UI IDs.
- `ui/b-theme.css`, `ui/flower-ornament.svg`, `icons/bloomodoro-b.svg`: scalable botanical parchment/gold/forest UI for world, focus, journal, settings, desktop/mobile navigation and PWA icon/theme. Theme CSS loads **after** existing style sheets so the old UI remains a technical fallback.
- `sw.js`: version 17, all required source assets included in offline precache. Technical smoke tests cover all 20 wildlife+companion species, avatar directions/cosmetics, offline URI caching, existing saves, HTML controls and mobile theme.

### Limitations / acceptance criteria

- **AI concept illustration quality is a target, not a tested result.** Generated vector artwork is higher resolution and visually different from the previous low-resolution rectangle sprites, but no claim is made that it is a pixel-perfect copy. A full frame-by-frame hand-drawn game-art production pass would require further source art.
- Actual color fidelity, facial details and small-screen legibility must be visually checked in the deployed browser; Node CI does not prove art quality. The user handles real-device functional validation after the formal release as prescribed by project policy.
- No account/backend changes. No effect on focus rewards, time points, bought clothes, inventories, plants, companion positions or legacy backups. No APK/EXE built or released; existing `v1.0.0` GitHub Release remains unchanged.

This phase opens a PR and runs GitHub checks. Only merge after successful checks in the separate '확인해' step; final formal release follows separate approval.
