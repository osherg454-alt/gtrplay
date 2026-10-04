# GT Endurance (web) - GT3-style race, golden hour

## Easiest way to play
Double-click **`play.html`** (single self-contained file; needs internet once because Three.js loads from a CDN).
Use Chrome or Edge.

## Developing in VS Code
`index.html` + `src/*.js` is the editable version. Because it uses ES modules it must be served, not double-clicked:
open the folder in VS Code, install **Live Server**, right-click `index.html` > **Open with Live Server**.

## Controls
W/Up throttle, S/Down brake, A D / arrows steer, Space handbrake, C camera (chase / hood / TV), R back on track,
+ / - volume, M mute, ESC pause + settings. Gamepad works too.

## Online play

```
npm install      # once
npm start        # http://localhost:3000
```

Open http://localhost:3000 (not the file directly). In the lobby: type a name, press CREATE and send the room code to friends; they press JOIN. The host chooses map/laps and presses START RACE. Friends on the same Wi-Fi use `http://<your-LAN-IP>:3000`; for the internet, deploy `server.js` + `play.html` to any Node host (Render, Railway, Fly.io) — it uses the `PORT` env var and wss:// automatically. Empty grid slots are filled by bots (bots are simulated locally on each machine).
