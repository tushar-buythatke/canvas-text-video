#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const RAMP = " .,:;i1tfLCG08@";
const FPS = 24;

let ffmpegProcess = null;
let isCleaned = false;

function usage() {
  console.log("Usage: npm run play -- /absolute/or/relative/path/to/video.mp4");
}

function parseVideoArg() {
  const arg = process.argv.slice(2).find((v) => !v.startsWith("--"));
  if (!arg) return null;

  const expanded = arg.startsWith("~/") ? path.join(os.homedir(), arg.slice(2)) : arg;
  return path.isAbsolute(expanded)
    ? expanded
    : path.resolve(process.cwd(), expanded);
}

function getRenderSize() {
  const cols = Math.max(40, (process.stdout.columns || 120) - 1);
  const rows = Math.max(12, (process.stdout.rows || 30) - 2);
  return { cols, rows };
}

function cursorHide() {
  process.stdout.write("\x1b[?25l");
}

function cursorShow() {
  process.stdout.write("\x1b[?25h");
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function luminanceToChar(lum) {
  const idx = Math.floor((lum / 255) * (RAMP.length - 1));
  return RAMP[idx];
}

function drawFrame(frame, cols, rows, label) {
  let out = "\x1b[H";
  const lineColorStart = "\x1b[38;2;240;246;255m";
  const lineColorEnd = "\x1b[0m";

  for (let y = 0; y < rows; y += 1) {
    let line = "";
    const rowOffset = y * cols;
    for (let x = 0; x < cols; x += 1) {
      const lum = frame[rowOffset + x];
      line += luminanceToChar(lum);
    }
    out += `${lineColorStart}${line}${lineColorEnd}\n`;
  }

  const statusRaw = ` ${label} | ${cols}x${rows} | Ctrl+C to exit `;
  const status = statusRaw.length > cols ? statusRaw.slice(0, cols) : statusRaw.padEnd(cols, " ");
  out += `\x1b[7m${status}\x1b[0m`;

  process.stdout.write(out);
}

function cleanup(exitCode) {
  if (isCleaned) return;
  isCleaned = true;

  if (ffmpegProcess && !ffmpegProcess.killed) {
    ffmpegProcess.kill("SIGTERM");
  }

  cursorShow();
  process.stdout.write("\n");
  process.exit(exitCode);
}

function start(videoPath) {
  if (!ffmpegPath) {
    console.error("Could not locate ffmpeg binary.");
    process.exit(1);
  }

  const { cols, rows } = getRenderSize();
  const frameSize = cols * rows;
  const videoLabel = path.basename(videoPath);

  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-re",
    "-i",
    videoPath,
    "-an",
    "-vf",
    `fps=${FPS},scale=${cols}:${rows}:flags=fast_bilinear,format=gray`,
    "-f",
    "rawvideo",
    "pipe:1",
  ];

  ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let pending = Buffer.alloc(0);
  let ffmpegStderr = "";

  ffmpegProcess.stdout.on("data", (chunk) => {
    pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);

    while (pending.length >= frameSize) {
      const frame = pending.subarray(0, frameSize);
      pending = pending.subarray(frameSize);
      drawFrame(frame, cols, rows, videoLabel);
    }
  });

  ffmpegProcess.stderr.on("data", (chunk) => {
    ffmpegStderr += chunk.toString();
  });

  ffmpegProcess.on("close", (code) => {
    if (code !== 0 && !isCleaned) {
      cursorShow();
      const reason = ffmpegStderr.trim() || `ffmpeg exited with code ${code}`;
      console.error(`\nPlayback failed: ${reason}`);
      process.exit(1);
      return;
    }

    cleanup(0);
  });
}

if (!process.stdout.isTTY) {
  console.error("This player must run in an interactive terminal.");
  process.exit(1);
}

const videoPath = parseVideoArg();
if (!videoPath) {
  usage();
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error(`Video file not found: ${videoPath}`);
  process.exit(1);
}

cursorHide();
clearScreen();

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));
process.on("uncaughtException", (error) => {
  cursorShow();
  console.error(`\nUnexpected error: ${error.message}`);
  process.exit(1);
});

start(videoPath);