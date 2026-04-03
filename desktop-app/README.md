# Canvas Fun Desktop App

This folder contains a standalone Electron wrapper that launches the existing app at `../index.html`.

## Run On macOS

```bash
cd desktop-app
npm install
npm start
```

## Terminal Autoplay (No Manual File Picker)

Pass a local video path from terminal and the app will load and start it automatically:

```bash
cd desktop-app
npm start -- "/absolute/path/to/video.mp4"
```

Relative paths also work from the `desktop-app` directory:

```bash
npm start -- "../my-video.mp4"
```

## Notes

- Your original files (`index.html`, `style.css`, `script.js`) remain unchanged.
- You can still use the app UI manually, or pass a path from terminal for auto-start.