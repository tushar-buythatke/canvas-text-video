const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

function resolveVideoArg() {
  // Electron injects additional args in dev mode, so skip known switches.
  const argv = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const candidate = argv[0];
  if (!candidate) return null;

  const expanded = candidate.startsWith("~/")
    ? path.join(os.homedir(), candidate.slice(2))
    : candidate;

  const absolutePath = path.isAbsolute(expanded)
    ? expanded
    : path.resolve(process.cwd(), expanded);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return pathToFileURL(absolutePath).toString();
}

function createMainWindow(autoplayVideoUrl) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: "#08080a",
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const entryFile = path.resolve(__dirname, "..", "index.html");
  const entryUrl = pathToFileURL(entryFile);
  if (autoplayVideoUrl) {
    entryUrl.searchParams.set("autoplayVideo", autoplayVideoUrl);
  }

  win.loadURL(entryUrl.toString());
}

app.whenReady().then(() => {
  const launchVideoUrl = resolveVideoArg();
  createMainWindow(launchVideoUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(launchVideoUrl);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});