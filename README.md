# CardBreaker

A 1v1 turn-based web card game built with Phaser 3, Node.js/Express, and MySQL.

## About

Rock-paper-scissors style card combat. Each player has 3 lives and picks a card each round — Attack, Shield, or Counter. Shield beats Attack, Attack beats Counter, Counter beats Shield. A dual-use token adds strategic depth: one side switches your card during resolution, the other adds a life. Token has a 2-turn cooldown.

## Features

- **WEGO Turn System** — Both players choose simultaneously
- **Multiplayer** — Account registration, player challenges, 1v1 matches
- **Server-Authoritative** — Game logic runs on the server, validated via MySQL
- **Round History** — Tracks previous rounds on-screen
- **Token Mechanic** — Strategic resource with cooldown management

## Tech Stack

- **Client:** Phaser 3.70.0, HTML, JavaScript
- **Server:** Node.js, Express.js
- **Database:** MySQL (user accounts, challenge state, match state, round history)

## Known Limitations

- Life-token side stopped working before delivery (bug not resolved)
- Round feedback displays too quickly — should linger for readability
- Last round not shown in history panel
- Switch token implementation needs refinement

## License

This project was developed for academic purposes.
