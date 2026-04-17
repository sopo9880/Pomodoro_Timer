const STORAGE_KEY = "bloomodoro-state-v2";

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

const BACKGROUND_AUDIO_UPDATE_INTERVAL_OPTIONS = [1, 5, 10, 30, 60];

const state = {
  settings: { ...PRESETS.classic },
  mode: "focus",
  remainingSeconds: PRESETS.classic.focus,
  currentSessionDurationSeconds: PRESETS.classic.focus,
  isRunning: false,
  cycleFocusCount: 0,
  completedToday: 0,
  focusSecondsToday: 0,
  autoAdvance: true,
  soundEnabled: true,
  vibrationEnabled: true,
  backgroundAudioEnabled: false,
  backgroundAudioLabelMode: "countdown",
  backgroundAudioUpdateInterval: 10,
  notificationsEnabled: false,
  transitionAlertsEnabled: true,
  soundTone: "bright",
  soundVolume: 60,
  vibrationPattern: "standard",
  selectedPreset: "classic",
  focusIntent: "",
  log: [],
  todayKey: getTodayKey(),
};

const DEFAULT_STATE = {
  settings: { ...PRESETS.classic },
  mode: "focus",
  remainingSeconds: PRESETS.classic.focus,
  currentSessionDurationSeconds: PRESETS.classic.focus,
  isRunning: false,
  cycleFocusCount: 0,
  completedToday: 0,
  focusSecondsToday: 0,
  autoAdvance: true,
  soundEnabled: true,
  vibrationEnabled: true,
  backgroundAudioEnabled: false,
  backgroundAudioLabelMode: "countdown",
  backgroundAudioUpdateInterval: 10,
  notificationsEnabled: false,
  transitionAlertsEnabled: true,
  soundTone: "bright",
  soundVolume: 60,
  vibrationPattern: "standard",
  selectedPreset: "classic",
  focusIntent: "",
  log: [],
};

let timerId = null;
let timerWorker = null;
let endTime = null;
let audioContext = null;
let backgroundAudio = null;
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let miniTimerWindow = null;
let miniTimerElements = null;
let lastMediaSessionStamp = "";

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
  miniTimerButton: document.getElementById("miniTimerButton"),
  autoAdvance: document.getElementById("autoAdvance"),
  soundEnabled: document.getElementById("soundEnabled"),
  vibrationEnabled: document.getElementById("vibrationEnabled"),
  backgroundAudioEnabled: document.getElementById("backgroundAudioEnabled"),
  backgroundAudioLabelMode: document.getElementById("backgroundAudioLabelMode"),
  backgroundAudioUpdateInterval: document.getElementById("backgroundAudioUpdateInterval"),
  notificationEnabled: document.getElementById("notificationEnabled"),
  transitionAlertsEnabled: document.getElementById("transitionAlertsEnabled"),
  completedToday: document.getElementById("completedToday"),
  focusMinutesToday: document.getElementById("focusMinutesToday"),
  nextModeLabel: document.getElementById("nextModeLabel"),
  longBreakCountdown: document.getElementById("longBreakCountdown"),
  cycleCaption: document.getElementById("cycleCaption"),
  sessionDots: document.getElementById("sessionDots"),
  resetCycleButton: document.getElementById("resetCycleButton"),
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
  notificationStatus: document.getElementById("notificationStatus"),
  notificationHint: document.getElementById("notificationHint"),
  notificationPermissionButton: document.getElementById("notificationPermissionButton"),
  modeButtons: Array.from(document.querySelectorAll(".mode-pill")),
  presetButtons: Array.from(document.querySelectorAll(".preset-chip")),
};

function init() {
  loadState();
  setupTimerWorker();
  bindEvents();
  bindInstallEvents();
  registerServiceWorker();
  restoreRunningTimer();
  render();
}

function bindEvents() {
  elements.startPauseButton.addEventListener("click", toggleTimer);
  elements.resetButton.addEventListener("click", resetTimer);
  elements.skipButton.addEventListener("click", () => advanceMode(false));

  if (elements.miniTimerButton) {
    elements.miniTimerButton.addEventListener("click", toggleMiniTimer);
  }

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

  if (elements.backgroundAudioEnabled) {
    elements.backgroundAudioEnabled.addEventListener("change", async () => {
      state.backgroundAudioEnabled = elements.backgroundAudioEnabled.checked;

      if (state.backgroundAudioEnabled && state.isRunning) {
        await startBackgroundAudio();
      } else if (!state.backgroundAudioEnabled) {
        stopBackgroundAudio();
      }

      renderControls();
      saveState();
    });
  }

  if (elements.backgroundAudioLabelMode) {
    elements.backgroundAudioLabelMode.addEventListener("change", () => {
      state.backgroundAudioLabelMode = elements.backgroundAudioLabelMode.value;
      updateMediaSessionMetadata(true);
      saveState();
    });
  }

  if (elements.backgroundAudioUpdateInterval) {
    elements.backgroundAudioUpdateInterval.addEventListener("change", () => {
      state.backgroundAudioUpdateInterval = getValidatedBackgroundAudioInterval(
        elements.backgroundAudioUpdateInterval.value,
      );
      updateMediaSessionMetadata(true);
      saveState();
    });
  }

  elements.notificationEnabled.addEventListener("change", async () => {
    if (elements.notificationEnabled.checked) {
      const granted = await ensureNotificationPermission(true);
      state.notificationsEnabled = granted;

      if (!granted) {
        elements.notificationEnabled.checked = false;
      }
    } else {
      state.notificationsEnabled = false;
    }

    renderNotificationState();
    saveState();
  });

  elements.transitionAlertsEnabled.addEventListener("change", () => {
    state.transitionAlertsEnabled = elements.transitionAlertsEnabled.checked;
    saveState();
  });

  elements.notificationPermissionButton.addEventListener("click", async () => {
    const granted = await ensureNotificationPermission(true);

    if (granted) {
      state.notificationsEnabled = true;
    }

    render();
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

  elements.resetCycleButton.addEventListener("click", resetCycleProgress);

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

function setupTimerWorker() {
  if (!("Worker" in window) || window.location.protocol === "file:") {
    return;
  }

  try {
    timerWorker = new Worker("timer-worker.js");
    timerWorker.addEventListener("message", handleTimerWorkerMessage);
  } catch (error) {
    timerWorker = null;
  }
}

function handleTimerWorkerMessage(event) {
  const { data } = event;
  if (!data || data.type !== "tick" || !state.isRunning || !endTime) {
    return;
  }

  state.remainingSeconds = data.remainingSeconds;
  renderTimer();
  renderStats();
  updateMediaSessionMetadata();
  renderMiniTimerWindow();

  if (data.completed) {
    stopTicking();
    endTime = null;
    handleCompletion();
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
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        serviceWorkerRegistration = registration;
      })
      .catch(() => {});
  });
}

function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) {
    return;
  }

  if (state.mode === "focus") {
    commitCurrentFocusProgress();
  }

  state.selectedPreset = presetKey;
  state.settings = { ...preset };
  resetCurrentSession(state.mode, getDurationSeconds(state.mode));

  if (state.isRunning) {
    endTime = Date.now() + state.remainingSeconds * 1000;
    startTicking();
  }

  addLog({
    title: "프리셋 적용",
    detail: `${presetKey === "classic" ? "Classic" : presetKey === "flow" ? "Flow" : "Deep"} 리듬으로 전환했어요.`,
  });

  render();
  saveState();
}

function updateSetting() {
  if (state.mode === "focus") {
    commitCurrentFocusProgress();
  }

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
  state.cycleFocusCount = Math.min(state.cycleFocusCount, state.settings.cycleLength);

  resetCurrentSession(state.mode, getDurationSeconds(state.mode));

  if (state.isRunning) {
    endTime = Date.now() + state.remainingSeconds * 1000;
    startTicking();
  }

  addLog({
    title: "설정 변경",
    detail: `${MODE_META[state.mode].label}을 ${formatDurationLabel(state.remainingSeconds)}으로 맞췄어요.`,
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
    resetCurrentSession(state.mode, getDurationSeconds(state.mode));
  }

  if (!state.isRunning) {
    addLog({
      title: `${MODE_META[state.mode].label} 시작`,
      detail: `${formatDurationLabel(state.remainingSeconds)} 타이머를 시작했어요.`,
    });
  }

  state.isRunning = true;
  endTime = Date.now() + state.remainingSeconds * 1000;
  startTicking();
  startBackgroundAudio();
  render();
  saveState();
}

function pauseTimer() {
  if (state.isRunning && endTime) {
    state.remainingSeconds = getRemainingSeconds(endTime);
  }

  if (state.isRunning) {
    addLog({
      title: `${MODE_META[state.mode].label} 일시정지`,
      detail: `${formatDurationLabel(state.remainingSeconds)} 남은 상태로 멈췄어요.`,
    });
  }

  state.isRunning = false;
  stopTicking();
  endTime = null;
  stopBackgroundAudio();
  render();
  saveState();
}

function resetTimer() {
  if (state.mode === "focus") {
    commitCurrentFocusProgress();
  }

  stopTicking();
  endTime = null;
  state.isRunning = false;
  resetCurrentSession(state.mode, getDurationSeconds(state.mode));
  stopBackgroundAudio();

  addLog({
    title: `${MODE_META[state.mode].label} 리셋`,
    detail: `${formatDurationLabel(state.remainingSeconds)}으로 다시 맞췄어요.`,
  });
  render();
  saveState();
}

function resetCycleProgress() {
  stopTicking();
  endTime = null;
  state.isRunning = false;
  stopBackgroundAudio();
  state.cycleFocusCount = 0;
  state.completedToday = 0;
  state.focusSecondsToday = 0;
  resetCurrentSession("focus", state.settings.focus);
  addLog({
    title: "사이클 초기화",
    detail: "완료한 집중, 누적 집중 시간, 다음 세션 흐름을 모두 처음 상태로 되돌렸어요.",
  });
  render();
  saveState();
}

function switchMode(mode, fromManualSelection = false) {
  if (!MODE_META[mode]) {
    return;
  }

  if (state.mode === "focus") {
    commitCurrentFocusProgress();
  }

  stopTicking();
  endTime = null;
  state.isRunning = false;
  stopBackgroundAudio();

  if (state.mode === "longBreak" && mode !== "longBreak") {
    state.cycleFocusCount = 0;
  }

  resetCurrentSession(mode, getDurationSeconds(mode));

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

  const secondsLeft = getRemainingSeconds(endTime);
  state.remainingSeconds = secondsLeft;
  renderTimer();
  renderStats();
  updateMediaSessionMetadata();
  renderMiniTimerWindow();

  if (secondsLeft <= 0) {
    stopTicking();
    endTime = null;
    handleCompletion();
  }
}

function handleCompletion() {
  const completedMode = state.mode;
  const nextMode = getNextMode(completedMode, true);
  state.isRunning = false;

  if (state.soundEnabled) {
    playCompletionSound();
  }

  if (state.vibrationEnabled) {
    vibrateOnCompletion();
  }

  showNotification(completedMode, nextMode);
  advanceMode(true);
}

function advanceMode(markComplete) {
  const previousMode = state.mode;
  const completedDuration = state.currentSessionDurationSeconds;
  const nextMode = getNextMode(previousMode, markComplete);

  if (previousMode === "focus") {
    commitCurrentFocusProgress(markComplete);
  }

  if (markComplete && previousMode === "focus") {
    state.cycleFocusCount = Math.min(state.settings.cycleLength, state.cycleFocusCount + 1);
    state.completedToday += 1;
    addLog({
      title: `${state.completedToday}번째 집중 완료`,
      detail: `${formatDurationLabel(completedDuration)} 몰입을 끝냈어요.`,
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

  if (previousMode === "longBreak") {
    state.cycleFocusCount = 0;
  }

  resetCurrentSession(nextMode, getDurationSeconds(nextMode));

  if (!markComplete || !state.autoAdvance) {
    stopBackgroundAudio();
  }

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

    const projectedCycleCount = state.cycleFocusCount + 1;
    return projectedCycleCount % state.settings.cycleLength === 0 ? "longBreak" : "shortBreak";
  }

  return "focus";
}

function getDurationSeconds(mode) {
  return state.settings[mode];
}

function resetCurrentSession(mode, durationSeconds) {
  state.mode = mode;
  state.currentSessionDurationSeconds = durationSeconds;
  state.remainingSeconds = durationSeconds;
}

function getRemainingSeconds(targetEndTime, now = Date.now()) {
  return Math.max(0, Math.ceil((targetEndTime - now) / 1000));
}

function getCurrentSessionElapsedSeconds(now = Date.now()) {
  const remaining = state.isRunning && endTime ? getRemainingSeconds(endTime, now) : state.remainingSeconds;
  return Math.max(
    0,
    Math.min(state.currentSessionDurationSeconds, state.currentSessionDurationSeconds - remaining),
  );
}

function commitCurrentFocusProgress(forceFullSession = false) {
  if (state.mode !== "focus") {
    return 0;
  }

  const elapsed = forceFullSession ? state.currentSessionDurationSeconds : getCurrentSessionElapsedSeconds();
  if (elapsed > 0) {
    state.focusSecondsToday += elapsed;
  }

  return elapsed;
}

function startTicking() {
  stopTicking();
  syncTimer();
  timerId = window.setInterval(syncTimer, 250);

  if (timerWorker) {
    timerWorker.postMessage({ type: "start", endTime });
  }
}

function stopTicking() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  if (timerWorker) {
    timerWorker.postMessage({ type: "stop" });
  }
}

function render() {
  renderTimer();
  renderMode();
  renderControls();
  renderNotificationState();
  renderSettings();
  renderStats();
  renderFocusIntent();
  renderInstallState();
  renderEventLog();
  renderMiniTimerWindow();
}

function renderTimer() {
  const total = state.currentSessionDurationSeconds;
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
  if (elements.backgroundAudioEnabled) {
    elements.backgroundAudioEnabled.checked = state.backgroundAudioEnabled;
  }

  if (elements.backgroundAudioLabelMode) {
    elements.backgroundAudioLabelMode.value = state.backgroundAudioLabelMode;
    elements.backgroundAudioLabelMode.disabled = !state.backgroundAudioEnabled;
  }

  if (elements.backgroundAudioUpdateInterval) {
    elements.backgroundAudioUpdateInterval.value = String(state.backgroundAudioUpdateInterval);
    elements.backgroundAudioUpdateInterval.disabled = !state.backgroundAudioEnabled;
  }

  elements.notificationEnabled.checked = state.notificationsEnabled;
  elements.transitionAlertsEnabled.checked = state.transitionAlertsEnabled;
  elements.soundTone.value = state.soundTone;
  elements.soundVolume.value = String(state.soundVolume);
  elements.soundVolumeValue.textContent = `${state.soundVolume}%`;
  elements.vibrationPattern.value = state.vibrationPattern;

  if (elements.miniTimerButton) {
    const supported = supportsMiniTimer();
    elements.miniTimerButton.hidden = !supported;
    if (supported) {
      elements.miniTimerButton.textContent =
        miniTimerWindow && !miniTimerWindow.closed ? "미니 닫기" : "미니 타이머";
    }
  }
}

function renderNotificationState() {
  if (!elements.notificationStatus || !elements.notificationHint || !elements.notificationPermissionButton) {
    return;
  }

  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "이 브라우저는 시스템 알림을 지원하지 않아요.";
    elements.notificationHint.textContent = "PC 알림은 Chromium 계열 또는 지원 브라우저에서 사용할 수 있어요.";
    elements.notificationPermissionButton.hidden = true;
    return;
  }

  const permission = Notification.permission;
  elements.notificationPermissionButton.hidden = permission === "granted";

  if (permission === "granted") {
    elements.notificationStatus.textContent = state.notificationsEnabled
      ? "시스템 알림이 켜져 있어요."
      : "권한은 허용되어 있지만 알림 토글이 꺼져 있어요.";
    elements.notificationHint.textContent = state.transitionAlertsEnabled
      ? "세션 완료와 다음 세션 전환 안내를 운영체제 알림으로 전달합니다. 오래 켜둘 때는 미니 타이머를 함께 쓰는 편이 더 안정적이에요."
      : "세션 완료만 운영체제 알림으로 전달합니다. 오래 켜둘 때는 미니 타이머를 함께 쓰는 편이 더 안정적이에요.";
    return;
  }

  if (permission === "denied") {
    elements.notificationStatus.textContent = "브라우저에서 알림 권한이 차단되어 있어요.";
    elements.notificationHint.textContent = "브라우저 사이트 설정에서 알림을 다시 허용해야 사용할 수 있어요.";
    return;
  }

  elements.notificationStatus.textContent = "브라우저 알림을 아직 켜지 않았어요.";
  elements.notificationHint.textContent = "PC 작업 중이거나 설치형 앱으로 백그라운드에 둘 때 세션 완료를 더 잘 알아차릴 수 있어요.";
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
  elements.focusMinutesToday.textContent = formatDurationLabel(getDisplayedFocusSeconds());
  elements.nextModeLabel.textContent = MODE_META[getNextMode(state.mode, true)].label;
  elements.longBreakCountdown.textContent = `${getLongBreakCountdown()}회`;
  elements.cycleCaption.textContent = `${state.settings.cycleLength}회 집중 후 긴 휴식`;
  renderSessionDots();
}

function renderSessionDots() {
  const filledDots = state.cycleFocusCount;
  elements.sessionDots.innerHTML = "";

  for (let index = 0; index < state.settings.cycleLength; index += 1) {
    const dot = document.createElement("span");
    dot.className = "session-dot";

    if (index < filledDots) {
      dot.classList.add("completed");
    }

    if (index === filledDots && state.mode === "focus" && filledDots < state.settings.cycleLength) {
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
  elements.installHint.textContent = supportsMiniTimer()
    ? "지원 브라우저에서는 미니 타이머 창도 함께 사용할 수 있어요."
    : "지원 브라우저에서는 메뉴에서도 설치를 선택할 수 있어요.";
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

function renderMiniTimerWindow() {
  if (!miniTimerWindow || miniTimerWindow.closed || !miniTimerElements) {
    return;
  }

  miniTimerElements.mode.textContent = MODE_META[state.mode].label;
  miniTimerElements.time.textContent = `${String(Math.floor(state.remainingSeconds / 60)).padStart(2, "0")}:${String(
    state.remainingSeconds % 60,
  ).padStart(2, "0")}`;
  miniTimerElements.hint.textContent = state.transitionAlertsEnabled
    ? `다음 세션: ${MODE_META[getNextMode(state.mode, true)].label}`
    : MODE_META[state.mode].hint;
  miniTimerElements.startPause.textContent = state.isRunning ? "일시정지" : "시작";
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

function getDisplayedFocusSeconds() {
  return state.focusSecondsToday + (state.mode === "focus" ? getCurrentSessionElapsedSeconds() : 0);
}

function getLongBreakCountdown() {
  if (state.mode === "longBreak" && state.cycleFocusCount === state.settings.cycleLength) {
    return 0;
  }

  return Math.max(0, state.settings.cycleLength - state.cycleFocusCount);
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

function ensureBackgroundAudioElement() {
  if (backgroundAudio) {
    return backgroundAudio;
  }

  backgroundAudio = new Audio();
  backgroundAudio.src = "keepalive.mp3";
  backgroundAudio.loop = true;
  backgroundAudio.preload = "auto";
  backgroundAudio.autoplay = false;
  backgroundAudio.playsInline = true;
  backgroundAudio.volume = 1;
  backgroundAudio.muted = false;
  backgroundAudio.setAttribute("webkit-playsinline", "true");
  backgroundAudio.setAttribute("aria-hidden", "true");

  if (!backgroundAudio.isConnected) {
    backgroundAudio.style.display = "none";
    document.body.append(backgroundAudio);
  }

  bindMediaSessionHandlers();
  return backgroundAudio;
}

async function startBackgroundAudio() {
  if (!state.backgroundAudioEnabled) {
    return;
  }

  const audio = ensureBackgroundAudioElement();
  if (audio.readyState === 0) {
    audio.load();
  }

  try {
    await audio.play();
  } catch (error) {
    state.backgroundAudioEnabled = false;
    renderControls();
    saveState();
    return;
  }

  updateMediaSessionMetadata(true);
  updateMediaSessionPlaybackState();
}

function stopBackgroundAudio() {
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
  }

  clearMediaSessionMetadata();
}

function updateMediaSessionMetadata(force = false) {
  if (!state.backgroundAudioEnabled || !("mediaSession" in navigator)) {
    return;
  }

  const interval = getValidatedBackgroundAudioInterval(state.backgroundAudioUpdateInterval);
  const stamp = `${state.mode}:${Math.ceil(state.remainingSeconds / interval)}:${state.backgroundAudioLabelMode}:${state.isRunning}`;
  if (!force && stamp === lastMediaSessionStamp) {
    return;
  }

  lastMediaSessionStamp = stamp;
  const timeLabel = `${String(Math.floor(state.remainingSeconds / 60)).padStart(2, "0")}:${String(
    state.remainingSeconds % 60,
  ).padStart(2, "0")}`;
  const labelMap = {
    countdown: {
      title: `남은 시간 ${timeLabel}`,
      artist: MODE_META[state.mode].label,
    },
    mode: {
      title: `${MODE_META[state.mode].label} · ${timeLabel}`,
      artist: state.isRunning ? "백그라운드 타이머 유지 중" : "일시정지됨",
    },
    minimal: {
      title: MODE_META[state.mode].label,
      artist: `남은 시간 ${timeLabel}`,
    },
  };
  const metadata = labelMap[state.backgroundAudioLabelMode] || labelMap.countdown;

  if (typeof MediaMetadata === "function") {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title,
      artist: metadata.artist,
      album: "Bloomodoro",
      artwork: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  }

  updateMediaSessionPlaybackState();
}

function clearMediaSessionMetadata() {
  if (!("mediaSession" in navigator)) {
    return;
  }

  lastMediaSessionStamp = "";
  navigator.mediaSession.metadata = null;
  updateMediaSessionPlaybackState();
}

function updateMediaSessionPlaybackState() {
  if (!("mediaSession" in navigator)) {
    return;
  }

  navigator.mediaSession.playbackState =
    state.backgroundAudioEnabled && state.isRunning ? "playing" : "paused";
}

function getValidatedBackgroundAudioInterval(rawValue) {
  const parsed = Number.parseInt(String(rawValue), 10);
  return BACKGROUND_AUDIO_UPDATE_INTERVAL_OPTIONS.includes(parsed) ? parsed : 10;
}

function bindMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) {
    return;
  }

  const handlers = {
    play: () => {
      if (!state.isRunning) {
        startTimer();
      }
    },
    pause: () => {
      if (state.isRunning) {
        pauseTimer();
      }
    },
    stop: () => {
      if (state.isRunning) {
        pauseTimer();
      }
    },
    nexttrack: () => advanceMode(false),
    previoustrack: resetTimer,
  };

  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      // Ignore unsupported actions.
    }
  });
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

async function showNotification(completedMode, nextMode) {
  if (!shouldSendSystemNotification()) {
    return;
  }

  const nextLabel = MODE_META[nextMode].label;
  const registration = await getNotificationRegistration();
  const notificationOptions = {
    body: state.transitionAlertsEnabled
      ? state.autoAdvance
        ? `다음 세션인 ${nextLabel}이 시작됐어요.`
        : `다음 세션은 ${nextLabel}이에요. 직접 시작해 주세요.`
      : `${MODE_META[completedMode].label} 세션이 끝났어요.`,
    badge: "icons/icon-192.png",
    icon: "icons/icon-192.png",
    renotify: true,
    requireInteraction: isDesktopDevice(),
    tag: `bloomodoro-${completedMode}-${Date.now()}`,
    vibrate: state.vibrationEnabled ? getVibrationPattern() : undefined,
    data: {
      url: "./",
      mode: nextMode,
    },
  };

  if (registration && typeof registration.showNotification === "function") {
    registration.showNotification(`${MODE_META[completedMode].label} 완료`, notificationOptions);
    return;
  }

  new Notification(`${MODE_META[completedMode].label} 완료`, notificationOptions);
}

function vibrateOnCompletion() {
  if (!("vibrate" in navigator) || !isAndroidDevice()) {
    return;
  }

  navigator.vibrate(getVibrationPattern());
}

function getVibrationPattern() {
  const patterns = {
    gentle: [120],
    standard: [180, 80, 220],
    urgent: [120, 60, 120, 60, 220],
  };

  return patterns[state.vibrationPattern] || patterns.standard;
}

async function ensureNotificationPermission(promptUser = false) {
  if (!("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied" || !promptUser) {
    return false;
  }

  try {
    return (await Notification.requestPermission()) === "granted";
  } catch (error) {
    return false;
  }
}

function shouldSendSystemNotification() {
  return (
    state.notificationsEnabled &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    (document.hidden || isStandaloneMode() || isDesktopDevice())
  );
}

async function getNotificationRegistration() {
  if (serviceWorkerRegistration) {
    return serviceWorkerRegistration;
  }

  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
  } catch (error) {
    serviceWorkerRegistration = null;
  }

  return serviceWorkerRegistration;
}

function restoreRunningTimer() {
  if (!state.isRunning || !endTime) {
    state.isRunning = false;
    endTime = null;
    return;
  }

  const now = Date.now();
  if (endTime > now) {
    state.remainingSeconds = getRemainingSeconds(endTime, now);
    startTicking();
    return;
  }

  let overflowSeconds = Math.max(0, Math.floor((now - endTime) / 1000));
  let recoveredSessions = 0;

  while (state.isRunning) {
    const completedMode = state.mode;
    const nextMode = getNextMode(completedMode, true);

    if (completedMode === "focus") {
      commitCurrentFocusProgress(true);
      state.cycleFocusCount = Math.min(state.settings.cycleLength, state.cycleFocusCount + 1);
      state.completedToday += 1;
    }

    if (completedMode === "longBreak") {
      state.cycleFocusCount = 0;
    }

    recoveredSessions += 1;
    resetCurrentSession(nextMode, getDurationSeconds(nextMode));

    if (!state.autoAdvance) {
      state.isRunning = false;
      endTime = null;
      break;
    }

    if (overflowSeconds < state.currentSessionDurationSeconds) {
      state.remainingSeconds = Math.max(0, state.currentSessionDurationSeconds - overflowSeconds);
      endTime = now + state.remainingSeconds * 1000;
      startTicking();
      break;
    }

    overflowSeconds -= state.currentSessionDurationSeconds;
  }

  if (recoveredSessions > 0) {
    addLog({
      title: "백그라운드 복구",
      detail: `비활성 상태였던 동안 ${recoveredSessions}개 세션을 반영했고 현재 ${MODE_META[state.mode].label} 상태예요.`,
    });
  }

  saveState();
}

async function toggleMiniTimer() {
  if (!supportsMiniTimer()) {
    return;
  }

  if (miniTimerWindow && !miniTimerWindow.closed) {
    miniTimerWindow.close();
    return;
  }

  try {
    miniTimerWindow = await window.documentPictureInPicture.requestWindow({ width: 360, height: 240 });
  } catch (error) {
    miniTimerWindow = null;
    return;
  }

  initializeMiniTimerWindow(miniTimerWindow);
  renderControls();
  renderMiniTimerWindow();
}

function initializeMiniTimerWindow(pictureInPictureWindow) {
  const doc = pictureInPictureWindow.document;
  doc.documentElement.lang = "ko";
  doc.title = "Bloomodoro Mini";
  doc.head.innerHTML = `
    <meta charset="UTF-8" />
    <style>
      :root {
        color-scheme: dark;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Trebuchet MS", "Avenir Next", "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, rgba(255, 172, 120, 0.22), transparent 35%), #141015;
        color: #fff8f3;
      }

      .mini-shell {
        min-height: 100vh;
        padding: 18px;
        display: grid;
        gap: 12px;
        align-content: center;
      }

      .mini-mode {
        margin: 0;
        color: #ffd07f;
        font-size: 0.86rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .mini-time {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 3.6rem;
        line-height: 1;
      }

      .mini-hint {
        margin: 0;
        color: rgba(255, 248, 243, 0.72);
        font-size: 0.95rem;
      }

      .mini-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 11px 12px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      button.primary {
        background: linear-gradient(135deg, #ff845c, #ffd571);
        color: #231217;
      }
    </style>
  `;
  doc.body.innerHTML = `
    <main class="mini-shell">
      <p class="mini-mode" id="miniMode"></p>
      <strong class="mini-time" id="miniTime"></strong>
      <p class="mini-hint" id="miniHint"></p>
      <div class="mini-actions">
        <button class="primary" id="miniStartPause" type="button"></button>
        <button id="miniNext" type="button">다음</button>
        <button id="miniReset" type="button">리셋</button>
      </div>
    </main>
  `;

  miniTimerElements = {
    mode: doc.getElementById("miniMode"),
    time: doc.getElementById("miniTime"),
    hint: doc.getElementById("miniHint"),
    startPause: doc.getElementById("miniStartPause"),
    next: doc.getElementById("miniNext"),
    reset: doc.getElementById("miniReset"),
  };

  miniTimerElements.startPause.addEventListener("click", toggleTimer);
  miniTimerElements.next.addEventListener("click", () => advanceMode(false));
  miniTimerElements.reset.addEventListener("click", resetTimer);

  pictureInPictureWindow.addEventListener("pagehide", () => {
    miniTimerWindow = null;
    miniTimerElements = null;
    renderControls();
  });
}

function supportsMiniTimer() {
  return Boolean(
    window.documentPictureInPicture &&
      typeof window.documentPictureInPicture.requestWindow === "function" &&
      isDesktopDevice(),
  );
}

function saveState() {
  const persistedState = {
    settings: state.settings,
    autoAdvance: state.autoAdvance,
    soundEnabled: state.soundEnabled,
    vibrationEnabled: state.vibrationEnabled,
    backgroundAudioEnabled: state.backgroundAudioEnabled,
    backgroundAudioLabelMode: state.backgroundAudioLabelMode,
    backgroundAudioUpdateInterval: state.backgroundAudioUpdateInterval,
    notificationsEnabled: state.notificationsEnabled,
    transitionAlertsEnabled: state.transitionAlertsEnabled,
    soundTone: state.soundTone,
    soundVolume: state.soundVolume,
    vibrationPattern: state.vibrationPattern,
    selectedPreset: state.selectedPreset,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
}

function loadState() {
  endTime = null;
  stopBackgroundAudio();

  state.settings = { ...DEFAULT_STATE.settings };
  state.mode = DEFAULT_STATE.mode;
  state.remainingSeconds = DEFAULT_STATE.remainingSeconds;
  state.currentSessionDurationSeconds = DEFAULT_STATE.currentSessionDurationSeconds;
  state.isRunning = DEFAULT_STATE.isRunning;
  state.cycleFocusCount = DEFAULT_STATE.cycleFocusCount;
  state.completedToday = DEFAULT_STATE.completedToday;
  state.focusSecondsToday = DEFAULT_STATE.focusSecondsToday;
  state.autoAdvance = DEFAULT_STATE.autoAdvance;
  state.soundEnabled = DEFAULT_STATE.soundEnabled;
  state.vibrationEnabled = DEFAULT_STATE.vibrationEnabled;
  state.backgroundAudioEnabled = DEFAULT_STATE.backgroundAudioEnabled;
  state.backgroundAudioLabelMode = DEFAULT_STATE.backgroundAudioLabelMode;
  state.backgroundAudioUpdateInterval = DEFAULT_STATE.backgroundAudioUpdateInterval;
  state.notificationsEnabled = DEFAULT_STATE.notificationsEnabled;
  state.transitionAlertsEnabled = DEFAULT_STATE.transitionAlertsEnabled;
  state.soundTone = DEFAULT_STATE.soundTone;
  state.soundVolume = DEFAULT_STATE.soundVolume;
  state.vibrationPattern = DEFAULT_STATE.vibrationPattern;
  state.selectedPreset = DEFAULT_STATE.selectedPreset;
  state.focusIntent = DEFAULT_STATE.focusIntent;
  state.log = [];
  state.todayKey = getTodayKey();

  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) {
    return;
  }

  try {
    const persistedState = JSON.parse(rawState);
    state.settings = normalizeSettings(persistedState.settings);
    state.autoAdvance = Boolean(persistedState.autoAdvance ?? DEFAULT_STATE.autoAdvance);
    state.soundEnabled = Boolean(persistedState.soundEnabled ?? DEFAULT_STATE.soundEnabled);
    state.vibrationEnabled = Boolean(persistedState.vibrationEnabled ?? DEFAULT_STATE.vibrationEnabled);
    state.backgroundAudioEnabled = Boolean(
      persistedState.backgroundAudioEnabled ?? DEFAULT_STATE.backgroundAudioEnabled,
    );
    state.backgroundAudioLabelMode = ["countdown", "mode", "minimal"].includes(
      persistedState.backgroundAudioLabelMode,
    )
      ? persistedState.backgroundAudioLabelMode
      : DEFAULT_STATE.backgroundAudioLabelMode;
    state.backgroundAudioUpdateInterval = getValidatedBackgroundAudioInterval(
      persistedState.backgroundAudioUpdateInterval,
    );
    state.notificationsEnabled = Boolean(
      persistedState.notificationsEnabled ?? DEFAULT_STATE.notificationsEnabled,
    );
    state.transitionAlertsEnabled = Boolean(
      persistedState.transitionAlertsEnabled ?? DEFAULT_STATE.transitionAlertsEnabled,
    );
    state.soundTone = ["bright", "soft", "bell"].includes(persistedState.soundTone)
      ? persistedState.soundTone
      : DEFAULT_STATE.soundTone;
    state.soundVolume = sanitizeNumber(
      persistedState.soundVolume ?? DEFAULT_STATE.soundVolume,
      10,
      100,
    );
    state.vibrationPattern = ["gentle", "standard", "urgent"].includes(persistedState.vibrationPattern)
      ? persistedState.vibrationPattern
      : DEFAULT_STATE.vibrationPattern;
    state.selectedPreset = getPresetMatch() || persistedState.selectedPreset || DEFAULT_STATE.selectedPreset;
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
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

function isDesktopDevice() {
  return window.matchMedia("(pointer:fine)").matches && !isAndroidDevice() && !isIosDevice();
}

function isSafariBrowser() {
  const userAgent = window.navigator.userAgent;
  return /safari/i.test(userAgent) && !/crios|fxios|edgios|chrome|android/i.test(userAgent);
}

init();