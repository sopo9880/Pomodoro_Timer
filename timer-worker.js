let intervalId = null;
let endTime = null;

self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data || !data.type) {
    return;
  }

  if (data.type === "start") {
    endTime = Number.isFinite(data.endTime) ? data.endTime : null;
    startTimerLoop();
    postTick();
    return;
  }

  if (data.type === "stop") {
    stopTimerLoop();
  }
});

function startTimerLoop() {
  stopTimerLoop();
  intervalId = self.setInterval(postTick, 250);
}

function stopTimerLoop() {
  if (intervalId) {
    self.clearInterval(intervalId);
    intervalId = null;
  }

  endTime = null;
}

function postTick() {
  if (!endTime) {
    return;
  }

  const remainingMs = endTime - Date.now();
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  self.postMessage({
    type: "tick",
    remainingSeconds,
    completed: remainingMs <= 0,
  });

  if (remainingMs <= 0) {
    stopTimerLoop();
  }
}