window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const autoplayVideo = params.get("autoplayVideo");
  if (!autoplayVideo) return;

  const video = document.getElementById("video");
  const startButton = document.getElementById("startButton");
  const statusEl = document.getElementById("status");

  if (!video) return;

  video.src = autoplayVideo;
  video.load();

  if (statusEl) {
    statusEl.textContent = "Loaded from terminal. Starting playback...";
  }

  const requestStart = () => {
    if (startButton) {
      startButton.click();
    } else {
      video.play().catch(() => {});
    }
  };

  video.addEventListener("loadeddata", () => {
    setTimeout(requestStart, 90);
  }, { once: true });

  // Fallback for files that report readyState slowly.
  setTimeout(requestStart, 650);
});