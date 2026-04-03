# Terminal-Only Video Player

This app plays video as ASCII directly inside your terminal window.

## Install

```bash
cd terminal-player
npm install
```

## Play A Video In Terminal

```bash
npm run play -- "/absolute/path/to/video.mp4"
```

You can also pass a relative path from the `terminal-player` folder.

## Stop Playback

Press `Ctrl+C`.

## Notes

- No Electron window is used.
- Video is rendered as terminal text frames.
- Audio is disabled in this terminal-only mode.