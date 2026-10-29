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
export function mountGameShell({ getTimerState }) {
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
    window.dispatchEvent(new CustomEvent("bloomodoro:screenchange", { detail: { screen: next } }));
  }
  for (const link of links) {
    link.addEventListener("click", () => selectScreen(link.dataset.screen, true));
  }
  app.querySelector("[data-home]")?.addEventListener("click", (event) => {
    event.preventDefault();
    selectScreen("world", true);
  });
  function refresh() {
    const mode = getTimerState();
    const status = document.getElementById("hudStatusLabel");
    status.textContent = mode.isRunning ? (mode.mode === "focus" ? "FOCUS IN PROGRESS" : "TAKE A LITTLE BREAK") : "READY TO GROW";
    app.classList.toggle("timer-is-running", Boolean(mode.isRunning));
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
