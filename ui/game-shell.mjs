// Pure UI shell: navigation and local presentation preferences only.
// Timer and garden state remain owned by their respective existing controllers.
const PREFS_KEY = "bloomodoro-world-display-v1";
const KNOWN_SCREENS = Object.freeze(["world", "focus", "journal", "settings"]);
const ALLOWED = Object.freeze({
  season: ["auto", "spring", "summer", "autumn", "winter"],
  weather: ["clear", "rain", "snow"],
  time: ["auto", "day", "night"],
});
const SEASON_LABELS = Object.freeze({ spring: "봄꽃이 피는 계절", summer: "초록이 가득한 여름", autumn: "단풍 물든 가을", winter: "눈 내리는 겨울" });
const WEATHER_LABELS = Object.freeze({ clear: "맑은 하늘", rain: "촉촉한 비", snow: "포근한 눈" });

export function sanitizeWorldDisplayPreferences(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const key of Object.keys(ALLOWED)) {
    out[key] = ALLOWED[key].includes(data[key]) ? data[key] : ALLOWED[key][0];
  }
  return out;
}
export function resolveWorldDisplayPreferences(raw, at = new Date()) {
  const preferences = sanitizeWorldDisplayPreferences(raw);
  const month = at.getMonth();
  const season = preferences.season === "auto"
    ? month < 2 || month === 11 ? "winter" : month < 5 ? "spring" : month < 8 ? "summer" : "autumn"
    : preferences.season;
  const time = preferences.time === "auto" ? (at.getHours() >= 19 || at.getHours() < 6 ? "night" : "day") : preferences.time;
  return { season, weather: preferences.weather, time };
}
export function buildWeekFocusSummary(dailyStats, at = new Date()) {
  const base = new Date(at.getFullYear(), at.getMonth(), at.getDate(), 12);
  const days = [];
  const formatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(base);
    date.setDate(base.getDate() - offset);
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const seconds = Number(dailyStats?.[key]?.focusSeconds) || 0;
    days.push({ day: key, label: formatter.format(date), minutes: Math.max(0, Math.floor(seconds / 60)) });
  }
  return { days, totalMinutes: days.reduce((total, day) => total + day.minutes, 0) };
}
export function mountGameShell({ getTimerState, getDailyStats = () => ({}) }) {
  const app = document.getElementById("gameApp");
  if (!app) throw new Error("Bloomodoro game shell was not found");
  const links = [...app.querySelectorAll(".screen-link")];
  const sections = [...app.querySelectorAll(".game-screen")];
  const labels = {
    season: document.getElementById("environmentSeason"),
    weather: document.getElementById("environmentWeather"),
    time: document.getElementById("environmentTime"),
  };
  let preferences = sanitizeWorldDisplayPreferences();
  try {
    preferences = sanitizeWorldDisplayPreferences(JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
  } catch {
    // Browser storage may be disabled. Keep a functional in-memory default.
  }
  let currentScreen = "world";
  let lastWeekFingerprint = "";
  function renderWeekSummary() {
    const summary = buildWeekFocusSummary(getDailyStats());
    const fingerprint = JSON.stringify(summary);
    if (fingerprint === lastWeekFingerprint) return;
    lastWeekFingerprint = fingerprint;
    const total = document.getElementById("journalWeekTotal");
    const bars = document.getElementById("journalWeekBars");
    if (!total || !bars) return;
    total.textContent = summary.totalMinutes.toLocaleString("ko-KR") + "분";
    const maximum = Math.max(1, ...summary.days.map((day) => day.minutes));
    const fragment = document.createDocumentFragment();
    summary.days.forEach((day, index) => {
      const column = document.createElement("div");
      column.className = "week-day" + (index === 6 ? " today" : "");
      const amount = document.createElement("strong");
      amount.textContent = day.minutes + "분";
      const track = document.createElement("div");
      track.className = "week-bar-track";
      const bar = document.createElement("div");
      bar.className = "week-bar";
      bar.style.height = (day.minutes ? Math.max(6, Math.round(day.minutes / maximum * 100)) : 0) + "%";
      bar.title = day.day + " · " + day.minutes + "분";
      track.append(bar);
      const caption = document.createElement("span");
      caption.textContent = day.label;
      column.append(amount, track, caption);
      fragment.append(column);
    });
    bars.replaceChildren(fragment);
  }
  const getEnvironment = () => resolveWorldDisplayPreferences(preferences);
  function updateEnvironment() {
    const resolved = getEnvironment();
    app.dataset.season = resolved.season;
    app.dataset.weather = resolved.weather;
    app.dataset.time = resolved.time;
    document.getElementById("worldSeasonLabel").textContent = SEASON_LABELS[resolved.season] + " · " + WEATHER_LABELS[resolved.weather];
    for (const [name, select] of Object.entries(labels)) select.value = preferences[name];
    window.dispatchEvent(new CustomEvent("bloomodoro:environmentchange", { detail: resolved }));
  }
  function savePreferences() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch { /* read-only UI is fine */ }
  }
  for (const [name, select] of Object.entries(labels)) {
    select.addEventListener("change", () => {
      preferences = sanitizeWorldDisplayPreferences({ ...preferences, [name]: select.value });
      savePreferences();
      updateEnvironment();
    });
  }
  function selectScreen(next, moveFocus = false) {
    if (!KNOWN_SCREENS.includes(next)) return;
    currentScreen = next;
    app.dataset.activeScreen = next;
    for (const section of sections) {
      const shown = section.dataset.view === next;
      section.hidden = !shown;
      section.classList.toggle("is-active", shown);
    }
    for (const link of links) {
      const active = link.dataset.screen === next;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    // Make tab panels usable with keyboard and screen readers, without changing timer state.
    if (moveFocus) {
      const activePanel = sections.find((section) => section.dataset.view === next);
      activePanel?.querySelector("h1")?.setAttribute("tabindex", "-1");
      activePanel?.querySelector("h1")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (next === "journal") renderWeekSummary();
    window.dispatchEvent(new CustomEvent("bloomodoro:screenchange", { detail: { screen: next } }));
  }
  for (const link of links) {
    link.addEventListener("click", () => selectScreen(link.dataset.screen, true));
  }
  // Collection drawer (a bottom sheet on phones). Opening it never pauses the timer.
  const collectionToggle = document.getElementById("collectionToggle");
  const collectionClose = document.getElementById("collectionClose");
  const narrow = window.matchMedia("(max-width: 900px)");
  function setCollection(open) {
    app.classList.toggle("collection-open", open);
    collectionToggle?.setAttribute("aria-expanded", String(open));
    try { localStorage.setItem(PREFS_KEY + ":collection", open && !narrow.matches ? "1" : "0"); } catch { /* optional */ }
  }
  collectionToggle?.addEventListener("click", () => setCollection(!app.classList.contains("collection-open")));
  collectionClose?.addEventListener("click", () => { setCollection(false); collectionToggle?.focus(); });
  app.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && app.classList.contains("collection-open")) setCollection(false);
  });
  // On phones the sheet covers the map, so step aside as soon as something is picked to place.
  app.addEventListener("click", (event) => {
    if (narrow.matches && event.target.closest?.('[data-garden-action="place"]')) setCollection(false);
  });
  app.addEventListener("pointerdown", (event) => {
    if (narrow.matches && app.classList.contains("collection-open") && !event.target.closest?.(".world-right-dock, #collectionToggle")) setCollection(false);
  });
  try { if (!narrow.matches && localStorage.getItem(PREFS_KEY + ":collection") === "1") setCollection(true); } catch { /* optional */ }
  app.querySelector("[data-home]")?.addEventListener("click", (event) => {
    event.preventDefault();
    selectScreen("world", true);
  });
  function refresh() {
    const mode = getTimerState();
    const status = document.getElementById("hudStatusLabel");
    status.textContent = mode.isRunning ? (mode.mode === "focus" ? "집중하는 중" : "쉬는 중") : "준비됐어요";
    app.classList.toggle("timer-is-running", Boolean(mode.isRunning));
    if (currentScreen === "journal") renderWeekSummary();
  }
  function updateClock() {
    const current = new Date();
    const label = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(current);
    document.getElementById("worldClock").textContent = label;
    updateEnvironment();
  }
  updateClock();
  selectScreen("world");
  refresh();
  // Only visual clock and local season are refreshed. No rewards or timer progress are created here.
  window.setInterval(updateClock, 60_000);
  return { refresh, getEnvironment, selectScreen, getScreen: () => currentScreen };
}
