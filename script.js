const STORAGE_KEY = "bloomodoro-state-v1";

const MODE_META = {
  focus: {
    label: "집중 시간",
    hint: "한 번의 몰입이 하루의 결을 만듭니다.",
  },
  shortBreak: {
    label: "짧은 휴식",
    hint: "숨을 고르고 리듬을 이어가요.",
  },
  longBreak: {
    label: "긴 휴식",
    hint: "충분히 쉬고 다시 넓게 몰입할 차례예요.",
  },
};

const PRESETS = {
  classic: {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
    cycleLength: 4,
  },
  flow: {
    focus: 30 * 60,
    shortBreak: 7 * 60,
    longBreak: 20 * 60,
    cycleLength: 4,
  },
  deep: {
    focus: 50 * 60,
    shortBreak: 10 * 60,
    longBreak: 25 * 60,
    cycleLength: 4,
  },
};

const state = {
  settings: { ...PRESETS.classic },
  mode: "focus",
  remainingSeconds: PRESETS.classic.focus,
  isRunning: false,
  completedFocusSessions: 0,
  completedToday: 0,
  focusSecondsToday: 0,
  autoAdvance: true,
  soundEnabled: true,
  vibrationEnabled: true,
  soundTone: "bright",
  soundVolume: 60,
  vibrationPattern: "standard",
  selectedPreset: "classic",
  focusIntent: "",
  log: [],
  todayKey: getTodayKey(),
};

let timerId = null;
let endTime = null;
let audioContext = null;
let deferredInstallPrompt = null;

const elements = {
  body: document.body,
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  modeLabel: document.getElementById("modeLabel"),
  timerHint: document.getElementById("timerHint"),
  timerRing: document.getElementById("timerRing"),
  startPauseButton: document.getElementById("startPauseButton"),
  resetButton: document.getElementById("resetButton"),
  skipButton: document.getElementById("skipButton"),
  autoAdvance: document.getElementById("autoAdvance"),
  soundEnabled: document.getElementById("soundEnabled"),
  vibrationEnabled: document.getElementById("vibrationEnabled"),
  completedToday: document.getElementById("completedToday"),
  focusMinutesToday: document.getElementById("focusMinutesToday"),
  nextModeLabel: document.getElementById("nextModeLabel"),
  longBreakCountdown: document.getElementById("longBreakCountdown"),
  cycleCaption: document.getElementById("cycleCaption"),
  sessionDots: document.getElementById("sessionDots"),
  focusIntent: document.getElementById("focusIntent"),
  focusIntentPreview: document.getElementById("focusIntentPreview"),
  installButton: document.getElementById("installButton"),
  installStatus: document.getElementById("installStatus"),
  installHint: document.getElementById("installHint"),
  eventLog: document.getElementById("eventLog"),
  focusDurationMinutes: document.getElementById("focusDurationMinutes"),
  focusDurationSeconds: document.getElementById("focusDurationSeconds"),
  shortBreakDurationMinutes: document.getElementById("shortBreakDurationMinutes"),
  shortBreakDurationSeconds: document.getElementById("shortBreakDurationSeconds"),
  longBreakDurationMinutes: document.getElementById("longBreakDurationMinutes"),
  longBreakDurationSeconds: document.getElementById("longBreakDurationSeconds"),
  cycleLength: document.getElementById("cycleLength"),
  soundTone: document.getElementById("soundTone"),
  soundVolume: document.getElementById("soundVolume"),
  soundVolumeValue: document.getElementById("soundVolumeValue"),
  vibrationPattern: document.getElementById("vibrationPattern"),
  modeButtons: Array.from(document.querySelectorAll(".mode-pill")),
  presetButtons: Array.from(document.querySelectorAll(".preset-chip")),
};

function init() {
  loadState();
  bindEvents();
  bindInstallEvents();
  registerServiceWorker();
  render();
}

function bindEvents() {
  elements.startPauseButton.addEventListener("click", toggleTimer);
  elements.resetButton.addEventListener("click", resetTimer);
  elements.skipButton.addEventListener("click", () => advanceMode(false));

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode, true));
  });

  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  elements.autoAdvance.addEventListener("change", () => {
    state.autoAdvance = elements.autoAdvance.checked;
    saveState();
  });

  elements.soundEnabled.addEventListener("change", () => {
    state.soundEnabled = elements.soundEnabled.checked;
    if (state.soundEnabled) {
      unlockAudio();
    }
    saveState();
  });

  elements.vibrationEnabled.addEventListener("change", () => {
    state.vibrationEnabled = elements.vibrationEnabled.checked;
    saveState();
  });

  elements.focusIntent.addEventListener("input", () => {
    state.focusIntent = elements.focusIntent.value.trim();
    renderFocusIntent();
    saveState();
  });

  elements.focusDurationMinutes.addEventListener("change", () => updateSetting());
  elements.focusDurationSeconds.addEventListener("change", () => updateSetting());
  elements.shortBreakDurationMinutes.addEventListener("change", () => updateSetting());
  elements.shortBreakDurationSeconds.addEventListener("change", () => updateSetting());
  elements.longBreakDurationMinutes.addEventListener("change", () => updateSetting());
  elements.longBreakDurationSeconds.addEventListener("change", () => updateSetting());
  elements.cycleLength.addEventListener("change", () => updateSetting());
  elements.soundTone.addEventListener("change", () => {
    state.soundTone = elements.soundTone.value;
    saveState();
  });
  elements.soundVolume.addEventListener("input", () => {
    state.soundVolume = sanitizeNumber(elements.soundVolume.value, 10, 100);
    renderControls();
    saveState();
  });
  elements.vibrationPattern.addEventListener("change", () => {
    state.vibrationPattern = elements.vibrationPattern.value;
    saveState();
  });

  document.addEventListener("keydown", (event) => {
    const isTyping =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;

    if (event.code === "Space" && !isTyping) {
      event.preventDefault();
      toggleTimer();
    }

    if (event.key.toLowerCase() === "r" && !isTyping) {
      resetTimer();
    }

    if (event.key.toLowerCase() === "n" && !isTyping) {
      advanceMode(false);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (state.isRunning) {
      syncTimer();
    }
  });
}

function bindInstallEvents() {
  if (elements.installButton) {
    elements.installButton.addEventListener("click", installApp);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallState();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    renderInstallState();
    addLog({
      title: "앱 설치 완료",
      detail: "홈 화면에서 Bloomodoro를 바로 열 수 있어요.",
    });
    renderEventLog();
    saveState();
  });

  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  if (typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", renderInstallState);
  } else if (typeof standaloneQuery.addListener === "function") {
    standaloneQuery.addListener(renderInstallState);
  }
}

async function installApp() {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();

  try {
    await deferredInstallPrompt.userChoice;
  } catch (error) {
    // Some browsers may reject if the prompt is dismissed or unavailable.
  }

  deferredInstallPrompt = null;
  renderInstallState();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) {
    return;
  }

  state.selectedPreset = presetKey;
  state.settings = { ...preset };

  if (!state.isRunning) {
    state.remainingSeconds = getDurationSeconds(state.mode);
  } else {
    state.remainingSeconds = getDurationSeconds(state.mode);
    endTime = Date.now() + state.remainingSeconds * 1000;
  }

  addLog({
    title: "프리셋 적용",
    detail: `${presetKey === "classic" ? "Classic" : presetKey === "flow" ? "Flow" : "Deep"} 리듬으로 전환했어요.`,
  });

  render();
  saveState();
}

function updateSetting() {
  state.settings = {
    focus: combineDurationInputs(
      elements.focusDurationMinutes.value,
      elements.focusDurationSeconds.value,
      1,
      90 * 60,
    ),
    shortBreak: combineDurationInputs(
      elements.shortBreakDurationMinutes.value,
      elements.shortBreakDurationSeconds.value,
      1,
      30 * 60,
    ),
    longBreak: combineDurationInputs(
      elements.longBreakDurationMinutes.value,
      elements.longBreakDurationSeconds.value,
      5,
      60 * 60,
    ),
    cycleLength: sanitizeNumber(elements.cycleLength.value, 2, 8),
  };
  state.selectedPreset = getPresetMatch() || "custom";

  const nextDuration = getDurationSeconds(state.mode);
  if (!state.isRunning) {
    state.remainingSeconds = nextDuration;
  } else {
    state.remainingSeconds = nextDuration;
    endTime = Date.now() + state.remainingSeconds * 1000;
  }

  addLog({
    title: "설정 변경",
    detail: `${MODE_META[state.mode].label}을 ${formatDurationLabel(nextDuration)}으로 맞췄어요.`,
  });

  render();
  saveState();
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  unlockAudio();

  if (state.remainingSeconds <= 0) {
    state.remainingSeconds = getDurationSeconds(state.mode);
  }

  if (!state.isRunning) {
    addLog({
      title: `${MODE_META[state.mode].label} 시작`,
      detail: `${formatDurationLabel(state.remainingSeconds)} 타이머를 시작했어요.`,
    });
  }

  state.isRunning = true;
  endTime = Date.now() + state.remainingSeconds * 1000;
  clearInterval(timerId);
  timerId = window.setInterval(syncTimer, 250);
  render();
  saveState();
}

function pauseTimer() {
  if (state.isRunning && endTime) {
    state.remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  }

  if (state.isRunning) {
    addLog({
      title: `${MODE_META[state.mode].label} 일시정지`,
      detail: `${formatDurationLabel(state.remainingSeconds)} 남은 상태로 멈췄어요.`,
    });
  }

  state.isRunning = false;
  clearInterval(timerId);
  timerId = null;
  endTime = null;
  render();
  saveState();
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  endTime = null;
  state.isRunning = false;
  state.remainingSeconds = getDurationSeconds(state.mode);
  addLog({
    title: `${MODE_META[state.mode].label} 리셋`,
    detail: `${formatDurationLabel(state.remainingSeconds)}으로 다시 맞췄어요.`,
  });
  render();
  saveState();
}

function switchMode(mode, fromManualSelection = false) {
  if (!MODE_META[mode]) {
    return;
  }

  clearInterval(timerId);
  timerId = null;
  endTime = null;
  state.isRunning = false;
  state.mode = mode;
  state.remainingSeconds = getDurationSeconds(mode);

  if (fromManualSelection) {
    addLog({
      title: `${MODE_META[mode].label}으로 전환`,
      detail: "직접 모드를 선택했어요.",
    });
  }

  render();
  saveState();
}

function syncTimer() {
  if (!state.isRunning || !endTime) {
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  state.remainingSeconds = secondsLeft;
  renderTimer();

  if (secondsLeft <= 0) {
    clearInterval(timerId);
    timerId = null;
    endTime = null;
    handleCompletion();
  }
}

function handleCompletion() {
  state.isRunning = false;

  if (state.soundEnabled) {
    playCompletionSound();
  }

  if (state.vibrationEnabled) {
    vibrateOnCompletion();
  }

  showNotification();
  advanceMode(true);
}

function advanceMode(markComplete) {
  const previousMode = state.mode;

  if (markComplete && previousMode === "focus") {
    state.completedFocusSessions += 1;
    state.completedToday += 1;
    state.focusSecondsToday += state.settings.focus;
    addLog({
      title: `${state.completedToday}번째 집중 완료`,
      detail: `${formatDurationLabel(state.settings.focus)} 몰입을 끝냈어요.`,
    });
  } else if (markComplete) {
    addLog({
      title: `${MODE_META[previousMode].label} 완료`,
      detail: "다음 흐름으로 자연스럽게 넘어갑니다.",
    });
  } else {
    addLog({
      title: `${MODE_META[previousMode].label} 건너뜀`,
      detail: "다음 세션으로 바로 이동했어요.",
    });
  }

  state.mode = getNextMode(previousMode, markComplete);
  state.remainingSeconds = getDurationSeconds(state.mode);
  render();
  saveState();

  if (markComplete && state.autoAdvance) {
    startTimer();
  }
}

function getNextMode(mode, markComplete) {
  if (mode === "focus") {
    if (!markComplete) {
      return "shortBreak";
    }

    return state.completedFocusSessions % state.settings.cycleLength === 0
      ? "longBreak"
      : "shortBreak";
  }

  return "focus";
}

function getDurationSeconds(mode) {
  return state.settings[mode];
}

function render() {
  renderTimer();
  renderMode();
  renderControls();
  renderSettings();
  renderStats();
  renderFocusIntent();
  renderInstallState();
  renderEventLog();
}

function renderTimer() {
  const total = getDurationSeconds(state.mode);
  const minutes = Math.floor(state.remainingSeconds / 60);
  const seconds = state.remainingSeconds % 60;
  const progress = total === 0 ? 0 : ((total - state.remainingSeconds) / total) * 100;

  elements.minutes.textContent = String(minutes).padStart(2, "0");
  elements.seconds.textContent = String(seconds).padStart(2, "0");
  elements.timerRing.style.setProperty("--progress", `${Math.max(0, Math.min(100, progress))}%`);
  elements.timerRing.classList.toggle("running", state.isRunning);
  document.title = `${elements.minutes.textContent}:${elements.seconds.textContent} · ${MODE_META[state.mode].label}`;
}

function renderMode() {
  elements.body.dataset.mode = state.mode;
  elements.modeLabel.textContent = MODE_META[state.mode].label;
  elements.timerHint.textContent = MODE_META[state.mode].hint;

  elements.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function renderControls() {
  elements.startPauseButton.textContent = state.isRunning ? "일시정지" : "시작";
  elements.autoAdvance.checked = state.autoAdvance;
  elements.soundEnabled.checked = state.soundEnabled;
  elements.vibrationEnabled.checked = state.vibrationEnabled;
  elements.soundTone.value = state.soundTone;
  elements.soundVolume.value = String(state.soundVolume);
  elements.soundVolumeValue.textContent = `${state.soundVolume}%`;
  elements.vibrationPattern.value = state.vibrationPattern;
}

function renderSettings() {
  applyDurationInputs(elements.focusDurationMinutes, elements.focusDurationSeconds, state.settings.focus);
  applyDurationInputs(
    elements.shortBreakDurationMinutes,
    elements.shortBreakDurationSeconds,
    state.settings.shortBreak,
  );
  applyDurationInputs(
    elements.longBreakDurationMinutes,
    elements.longBreakDurationSeconds,
    state.settings.longBreak,
  );
  elements.cycleLength.value = String(state.settings.cycleLength);

  elements.presetButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.selectedPreset);
  });
}

function renderStats() {
  elements.completedToday.textContent = `${state.completedToday}회`;
  elements.focusMinutesToday.textContent = formatDurationLabel(state.focusSecondsToday);
  elements.nextModeLabel.textContent = MODE_META[getNextMode(state.mode, true)].label;
  elements.longBreakCountdown.textContent = `${getLongBreakCountdown()}회`;
  elements.cycleCaption.textContent = `${state.settings.cycleLength}회 집중 후 긴 휴식`;
  renderSessionDots();
}

function renderSessionDots() {
  const completedInCycle = state.completedFocusSessions % state.settings.cycleLength;
  elements.sessionDots.innerHTML = "";

  for (let index = 0; index < state.settings.cycleLength; index += 1) {
    const dot = document.createElement("span");
    dot.className = "session-dot";

    if (index < completedInCycle) {
      dot.classList.add("completed");
    }

    if (index === completedInCycle && state.mode === "focus") {
      dot.classList.add("current");
    }

    elements.sessionDots.append(dot);
  }
}

function renderFocusIntent() {
  elements.focusIntent.value = state.focusIntent;
  elements.focusIntentPreview.textContent = state.focusIntent || "무엇에 몰입할까요?";
}

function renderInstallState() {
  const standalone = isStandaloneMode();
  const isFilePreview = window.location.protocol === "file:";

  if (!elements.installButton || !elements.installStatus || !elements.installHint) {
    return;
  }

  elements.installButton.hidden = true;

  if (standalone) {
    elements.installStatus.textContent = "홈 화면 앱으로 실행 중";
    elements.installHint.textContent = "전체 화면으로 열리고 최근 세션도 기기 안에 저장돼요.";
    return;
  }

  if (isFilePreview) {
    elements.installStatus.textContent = "브라우저 미리보기 모드";
    elements.installHint.textContent = "설치형 앱은 localhost 또는 HTTPS 주소에서 활성화됩니다.";
    return;
  }

  if (deferredInstallPrompt) {
    elements.installStatus.textContent = "홈 화면에 설치할 수 있어요";
    elements.installHint.textContent = "설치하면 전체 화면 실행과 오프라인 캐시를 함께 쓸 수 있어요.";
    elements.installButton.hidden = false;
    return;
  }

  if (isIosDevice() && isSafariBrowser()) {
    elements.installStatus.textContent = "iPhone에서도 설치 가능해요";
    elements.installHint.textContent = "Safari 공유 메뉴에서 '홈 화면에 추가'를 눌러주세요.";
    return;
  }

  elements.installStatus.textContent = "브라우저에서 바로 사용할 수 있어요";
  elements.installHint.textContent = "지원 브라우저에서는 메뉴에서도 설치를 선택할 수 있어요.";
}

function renderEventLog() {
  elements.eventLog.innerHTML = "";

  if (state.log.length === 0) {
    const empty = document.createElement("li");
    empty.className = "event-log-empty";
    empty.textContent = "첫 세션을 시작하면 여기에 흐름이 기록됩니다.";
    elements.eventLog.append(empty);
    return;
  }

  state.log.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "event-item";

    const title = document.createElement("strong");
    title.textContent = entry.title;

    const detail = document.createElement("span");
    detail.textContent = entry.detail;

    const time = document.createElement("time");
    time.textContent = entry.time;

    item.append(title, detail, time);
    elements.eventLog.append(item);
  });
}

function addLog({ title, detail }) {
  state.log = [
    {
      title,
      detail,
      time: new Intl.DateTimeFormat("ko-KR", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    },
    ...state.log,
  ].slice(0, 8);
}

function getLongBreakCountdown() {
  const remainder = state.completedFocusSessions % state.settings.cycleLength;
  return remainder === 0 ? state.settings.cycleLength : state.settings.cycleLength - remainder;
}

function getPresetMatch() {
  return Object.entries(PRESETS).find(([, preset]) => {
    return (
      preset.focus === state.settings.focus &&
      preset.shortBreak === state.settings.shortBreak &&
      preset.longBreak === state.settings.longBreak &&
      preset.cycleLength === state.settings.cycleLength
    );
  })?.[0];
}

function combineDurationInputs(minutesValue, secondsValue, minSeconds, maxSeconds) {
  const minutes = sanitizeNumber(minutesValue, 0, Math.floor(maxSeconds / 60));
  const seconds = sanitizeNumber(secondsValue, 0, 59);
  const total = minutes * 60 + seconds;
  return Math.min(maxSeconds, Math.max(minSeconds, total));
}

function applyDurationInputs(minutesElement, secondsElement, totalSeconds) {
  minutesElement.value = String(Math.floor(totalSeconds / 60));
  secondsElement.value = String(totalSeconds % 60);
}

function formatDurationLabel(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0 && seconds > 0) {
    return `${minutes}분 ${seconds}초`;
  }

  if (minutes > 0) {
    return `${minutes}분`;
  }

  return `${seconds}초`;
}

function sanitizeNumber(rawValue, min, max) {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return min;
  }

  return Math.min(max, Math.max(min, parsed));
}

function unlockAudio() {
  if (!state.soundEnabled || audioContext) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  audioContext = new AudioContextClass();
}

function playCompletionSound() {
  if (!audioContext) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const volume = state.soundVolume / 100;
  const tones = {
    bright: [
      { offset: 0, frequency: 880, type: "sine", duration: 0.24 },
      { offset: 0.16, frequency: 1174, type: "sine", duration: 0.24 },
    ],
    soft: [
      { offset: 0, frequency: 660, type: "sine", duration: 0.28 },
      { offset: 0.18, frequency: 880, type: "triangle", duration: 0.28 },
    ],
    bell: [
      { offset: 0, frequency: 784, type: "triangle", duration: 0.34 },
      { offset: 0.12, frequency: 1174, type: "triangle", duration: 0.38 },
      { offset: 0.28, frequency: 1568, type: "sine", duration: 0.3 },
    ],
  };

  (tones[state.soundTone] || tones.bright).forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = note.type;
    oscillator.frequency.value = note.frequency;
    gain.gain.setValueAtTime(0.0001, now + note.offset);
    gain.gain.exponentialRampToValueAtTime(0.12 * volume, now + note.offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.offset + note.duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + note.offset);
    oscillator.stop(now + note.offset + note.duration + 0.02);
  });
}

function showNotification() {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted" && document.hidden) {
    const nextLabel = MODE_META[getNextMode(state.mode, true)].label;
    new Notification(`${MODE_META[state.mode].label} 완료`, {
      body: `이제 ${nextLabel}으로 넘어갈 시간이에요.`,
    });
  }
}

function vibrateOnCompletion() {
  if (!("vibrate" in navigator) || !isAndroidDevice()) {
    return;
  }

  const patterns = {
    gentle: [120],
    standard: [180, 80, 220],
    urgent: [120, 60, 120, 60, 220],
  };

  navigator.vibrate(patterns[state.vibrationPattern] || patterns.standard);
}

function saveState() {
  const payload = {
    settings: state.settings,
    mode: state.mode,
    remainingSeconds: state.remainingSeconds,
    completedFocusSessions: state.completedFocusSessions,
    completedToday: state.completedToday,
    focusSecondsToday: state.focusSecondsToday,
    autoAdvance: state.autoAdvance,
    soundEnabled: state.soundEnabled,
    vibrationEnabled: state.vibrationEnabled,
    soundTone: state.soundTone,
    soundVolume: state.soundVolume,
    vibrationPattern: state.vibrationPattern,
    selectedPreset: state.selectedPreset,
    focusIntent: state.focusIntent,
    log: state.log,
    todayKey: state.todayKey,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    state.settings = normalizeSettings(parsed.settings);
    state.mode = MODE_META[parsed.mode] ? parsed.mode : "focus";
    state.remainingSeconds = Number.isFinite(parsed.remainingSeconds)
      ? parsed.remainingSeconds
      : getDurationSeconds(state.mode);
    state.completedFocusSessions = parsed.completedFocusSessions || 0;
    state.completedToday = parsed.completedToday || 0;
    state.focusSecondsToday =
      parsed.focusSecondsToday ?? ((parsed.focusMinutesToday || 0) * 60);
    state.autoAdvance = parsed.autoAdvance ?? true;
    state.soundEnabled = parsed.soundEnabled ?? true;
    state.vibrationEnabled = parsed.vibrationEnabled ?? true;
    state.soundTone = parsed.soundTone || "bright";
    state.soundVolume = sanitizeNumber(parsed.soundVolume ?? 60, 10, 100);
    state.vibrationPattern = parsed.vibrationPattern || "standard";
    state.selectedPreset = parsed.selectedPreset || getPresetMatch() || "classic";
    state.focusIntent = parsed.focusIntent || "";
    state.log = Array.isArray(parsed.log) ? parsed.log : [];
    state.todayKey = parsed.todayKey || getTodayKey();
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }

  if (state.todayKey !== getTodayKey()) {
    state.todayKey = getTodayKey();
    state.completedToday = 0;
    state.focusSecondsToday = 0;
    state.log = [];
  }

  state.isRunning = false;
  state.remainingSeconds = Math.min(state.remainingSeconds, getDurationSeconds(state.mode));
}

function normalizeSettings(rawSettings) {
  const defaults = { ...PRESETS.classic };
  if (!rawSettings || typeof rawSettings !== "object") {
    return defaults;
  }

  const focus =
    rawSettings.focus > 90 ? rawSettings.focus : sanitizeNumber(rawSettings.focus ?? 25, 1, 90) * 60;
  const shortBreak =
    rawSettings.shortBreak > 90
      ? rawSettings.shortBreak
      : sanitizeNumber(rawSettings.shortBreak ?? 5, 1, 30) * 60;
  const longBreak =
    rawSettings.longBreak > 90
      ? rawSettings.longBreak
      : sanitizeNumber(rawSettings.longBreak ?? 15, 1, 60) * 60;

  return {
    focus: sanitizeNumber(focus, 1, 90 * 60),
    shortBreak: sanitizeNumber(shortBreak, 1, 30 * 60),
    longBreak: sanitizeNumber(longBreak, 5, 60 * 60),
    cycleLength: sanitizeNumber(rawSettings.cycleLength ?? 4, 2, 8),
  };
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isAndroidDevice() {
  return /android/i.test(window.navigator.userAgent);
}

function isSafariBrowser() {
  const userAgent = window.navigator.userAgent;
  return /safari/i.test(userAgent) && !/crios|fxios|edgios|chrome|android/i.test(userAgent);
}

init();
