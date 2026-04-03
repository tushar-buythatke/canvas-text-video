// Tunable visual constants.
const FONT_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace';
let fontSize = 10;
let font = `500 ${fontSize}px ${FONT_FAMILY}`;
let lineHeight = Math.round(fontSize * 1.2);
const BG_COLOR = "#08080a";
const THRESHOLD = 0.08;
const BASE_ALPHA = 0.08;
const SPACE_ALPHA_MULTIPLIER = 0.35;

const BOOK_TEXT = `I think love is not the moment you realize it but the quiet accumulation of small things the way someone’s name starts sounding different in your head the way silence with them feels less like emptiness and more like a place you can rest in it’s in the unnoticed shifts in how you begin to measure time not in hours but in conversations not in days but in memories that haven’t even happened yet it’s strange how someone can slowly become a reference point for everything how a random song suddenly feels like it belongs to them how even the most ordinary street starts holding meaning just because you once walked it together and now everything carries a soft echo of them in places they’ve never even been and maybe that’s the most dangerous part not the falling but how natural it feels like gravity was always meant to pull you this way like you were always going to end up here somewhere between hesitation and certainty somewhere between holding back and already being too far gone and you tell yourself it’s nothing it’s just a phase just a passing thought but then you catch yourself smiling at nothing remembering something small something insignificant and suddenly it’s not so small anymore and that’s when it hits you not loudly not all at once but gently like a tide that’s already reached your feet before you even noticed the ocean was close and now you’re standing there pretending you’re still dry pretending you still have a choice but deep down you already know you don’t and maybe you never did or did you do it my sweet baby, I think love is not the moment you realize it but the quiet accumulation of small I think love is not the moment you realize it but the quietness`;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const video = document.getElementById("video");
const videoInput = document.getElementById("videoInput");
const startButton = document.getElementById("startButton");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const controlsToggle = document.getElementById("controlsToggle");

const videoCanvas = document.createElement("canvas");
const videoCtx = videoCanvas.getContext("2d", { willReadFrequently: true });

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

let cellW = 0;
let cols = 0;
let rows = 0;
let charGrid = [];
let videoPlaying = false;
let objectUrl = "";

function splitGraphemes(text) {
  if (!text) return [];
  if (!segmenter) return Array.from(text);

  const out = [];
  for (const part of segmenter.segment(text)) {
    out.push(part.segment);
  }
  return out;
}

function prepareWithSegments(text, font) {
  ctx.save();
  ctx.font = font;

  // Flatten whitespace so long text continuously wraps across the full viewport.
  const normalized = text.replace(/\s+/g, " ").trim();
  const graphemes = splitGraphemes(normalized);
  const segments = [
    graphemes.map((char) => ({
      char,
      width: ctx.measureText(char).width,
      isWhitespace: /\s/.test(char),
    })),
  ];

  ctx.restore();
  return { segments };
}

function layoutNextLine(prepared, cursor, maxWidth) {
  const { segments } = prepared;
  let { segmentIndex, graphemeIndex } = cursor;

  if (segmentIndex >= segments.length) {
    return null;
  }

  while (segmentIndex < segments.length && graphemeIndex >= segments[segmentIndex].length) {
    segmentIndex += 1;
    graphemeIndex = 0;
  }

  if (segmentIndex >= segments.length) {
    return null;
  }

  const segment = segments[segmentIndex];

  if (segment.length === 0) {
    return {
      text: "",
      end: { segmentIndex: segmentIndex + 1, graphemeIndex: 0 },
    };
  }

  let idx = graphemeIndex;
  while (idx < segment.length && segment[idx].isWhitespace) {
    idx += 1;
  }

  if (idx >= segment.length) {
    return {
      text: "",
      end: { segmentIndex: segmentIndex + 1, graphemeIndex: 0 },
    };
  }

  let width = 0;
  let lineChars = [];
  let breakLineCharsCount = -1;
  let breakGraphemeIndex = -1;

  while (idx < segment.length) {
    const g = segment[idx];
    const nextWidth = width + g.width;

    if (nextWidth > maxWidth && lineChars.length > 0) {
      break;
    }

    if (nextWidth > maxWidth) {
      lineChars.push(g.char);
      idx += 1;
      break;
    }

    lineChars.push(g.char);
    width = nextWidth;

    if (g.isWhitespace) {
      breakLineCharsCount = lineChars.length;
      breakGraphemeIndex = idx + 1;
    }

    idx += 1;
  }

  let nextIndex = idx;

  if (idx < segment.length && breakLineCharsCount > 0) {
    lineChars = lineChars.slice(0, breakLineCharsCount);
    nextIndex = breakGraphemeIndex;
  }

  return {
    text: lineChars.join("").trimEnd(),
    end: { segmentIndex, graphemeIndex: nextIndex },
  };
}

function measureCellWidth() {
  ctx.font = font;
  cellW = ctx.measureText("M").width;
}

function getViewportSize() {
  if (window.visualViewport) {
    return {
      width: Math.max(1, Math.floor(window.visualViewport.width)),
      height: Math.max(1, Math.floor(window.visualViewport.height)),
    };
  }

  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  };
}

function updateTypography() {
  const { width } = getViewportSize();
  if (width <= 420) {
    fontSize = 8;
  } else if (width <= 900) {
    fontSize = 9;
  } else {
    fontSize = 10;
  }

  font = `500 ${fontSize}px ${FONT_FAMILY}`;
  lineHeight = Math.round(fontSize * 1.2);
}

function layoutTextGrid() {
  const viewport = getViewportSize();
  cols = Math.floor(viewport.width / cellW);
  rows = Math.floor(viewport.height / lineHeight);

  if (cols <= 0 || rows <= 0) {
    charGrid = [];
    return;
  }

  const prepared = prepareWithSegments(BOOK_TEXT, font);
  charGrid = new Array(rows * cols).fill(" ");

  let cursor = { segmentIndex: 0, graphemeIndex: 0 };

  for (let row = 0; row < rows; row += 1) {
    let line = layoutNextLine(prepared, cursor, cols * cellW);

    if (line === null) {
      cursor = { segmentIndex: 0, graphemeIndex: 0 };
      line = layoutNextLine(prepared, cursor, cols * cellW);
      if (line === null) break;
    }

    for (let col = 0; col < cols && col < line.text.length; col += 1) {
      charGrid[row * cols + col] = line.text[col];
    }

    cursor = line.end;
  }

  videoCanvas.width = cols;
  videoCanvas.height = rows;
}

function updateStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function setOverlayVisible(isVisible) {
  if (overlay) {
    overlay.classList.toggle("hidden", !isVisible);
  }

  if (controlsToggle) {
    controlsToggle.classList.toggle("is-hidden", isVisible);
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function render() {
  if (cols <= 0 || rows <= 0) {
    requestAnimationFrame(render);
    return;
  }

  let vPix = null;

  if (videoPlaying && video.readyState >= 2 && !video.paused) {
    videoCtx.drawImage(video, 0, 0, cols, rows);
    vPix = videoCtx.getImageData(0, 0, cols, rows).data;
  }

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.textBaseline = "top";

  for (let row = 0; row < rows; row += 1) {
    const y = row * lineHeight;

    for (let col = 0; col < cols; col += 1) {
      const ch = charGrid[row * cols + col];
      const isSpace = ch === " ";
      const glyph = isSpace ? "." : ch;

      if (vPix) {
        const idx = (row * cols + col) * 4;
        const lum = (0.299 * vPix[idx] + 0.587 * vPix[idx + 1] + 0.114 * vPix[idx + 2]) / 255;

        const t = clamp01((lum - THRESHOLD) / (1 - THRESHOLD));
        const alpha = BASE_ALPHA + Math.pow(t, 0.72) * (1 - BASE_ALPHA);
        const drawAlpha = isSpace ? alpha * SPACE_ALPHA_MULTIPLIER : alpha;
        const white = Math.round(205 + 50 * t);

        ctx.fillStyle = `rgba(${white},${white},${white},${drawAlpha.toFixed(3)})`;
      } else {
        const idleAlpha = isSpace ? 0.06 : 0.2;
        ctx.fillStyle = `rgba(242,246,255,${idleAlpha.toFixed(3)})`;
      }

      ctx.fillText(glyph, col * cellW, y);
    }
  }

  requestAnimationFrame(render);
}

function handleResize() {
  updateTypography();

  const dpr = window.devicePixelRatio || 1;
  const viewport = getViewportSize();
  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  measureCellWidth();
  layoutTextGrid();
}

function startPlayback() {
  if (!video.currentSrc && !video.src) {
    updateStatus("Pick a video file first.");
    return;
  }

  video
    .play()
    .then(() => {
      videoPlaying = true;
      setOverlayVisible(false);
      updateStatus("Rendering live luminance from video.");
    })
    .catch(() => {
      updateStatus("Playback blocked by browser policy. Click Start again.");
    });
}

window.addEventListener("resize", handleResize, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleResize, { passive: true });
  window.visualViewport.addEventListener("scroll", handleResize, { passive: true });
}

if (startButton) {
  startButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startPlayback();
  });
}

if (videoInput) {
  videoInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }

    objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.load();
    setOverlayVisible(true);
    updateStatus(`Loaded ${file.name}. Click Start.`);
  });
}

if (controlsToggle) {
  controlsToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const hidden = overlay ? overlay.classList.contains("hidden") : false;
    setOverlayVisible(hidden);
  });
}

video.addEventListener("play", () => {
  videoPlaying = true;
});

video.addEventListener("pause", () => {
  videoPlaying = false;
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (overlay && overlay.contains(target)) return;
  if (controlsToggle && controlsToggle.contains(target)) return;

  if (!videoPlaying && (video.currentSrc || video.src)) {
    startPlayback();
  }
});

document.addEventListener("keydown", (event) => {
  if (!overlay) return;
  if (event.key.toLowerCase() === "h") {
    const hidden = overlay.classList.contains("hidden");
    setOverlayVisible(hidden);
    if (hidden) {
      updateStatus("Controls shown. Press H to hide again.");
    }
  }
});

window.addEventListener("beforeunload", () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

handleResize();
render();
setOverlayVisible(true);

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    handleResize();
  });
}