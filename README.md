# Quiz Clash — room-code multiplayer trivia

A Node.js multiplayer prototype for 2–8 players. It has no third-party npm dependencies and uses the host's `PORT` environment variable, so it can run locally or on a Node web host.

## Run locally on a computer
1. Install Node.js 18+.
2. Extract this folder.
3. Open a terminal in this folder.
4. Run `npm start` (or `node server.js`).
5. Open http://localhost:3000 on that same computer.

**Important:** `localhost` always means the device currently running the browser. It will not reach a server running somewhere else. On a phone, `http://localhost:3000` points to the phone itself, so it will refuse the connection unless the server is running on the phone.

## Play on other devices on the same Wi-Fi
Run the server on a computer, find that computer's LAN IP address, then open `http://COMPUTER-LAN-IP:3000` on the other devices. Permit Node.js through the computer's firewall if prompted.

## Publish a public URL
This project includes `render.yaml` for deployment on Render:
1. Upload this folder to a GitHub repository.
2. Sign in to Render and choose **New → Blueprint**.
3. Connect the repository and deploy the `render.yaml` blueprint.
4. Render will provide a public `https://...onrender.com` URL after deployment completes.

A public URL cannot be generated just by opening localhost; a hosting account must deploy the code. The free service may sleep when idle, and in-memory rooms reset whenever the server restarts, so this prototype is for testing rather than production.

## Core features
- Create a private room and join by six-character code
- 2–8 players, host controls, five timed questions
- Speed-based scoring, live score polling and leaderboard
- Sabotage and point-steal controls
- Final results and rematch
