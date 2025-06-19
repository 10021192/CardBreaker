// You can write more code here

/* START OF COMPILED CODE */

class Lobby extends Phaser.Scene {

	constructor() {
		super("Lobby");

		/* START-USER-CTR-CODE */
		this.onlineUsers = [];
        this.challenges = { sent: [], received: [] };
        this.activeGames = [];
        this.pollInterval = null;
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// OnlinePanel
		const onlinePanel = this.add.container(0, 0);

		// OnlineBg
		const onlineBg = this.add.rectangle(0, 0, 128, 128);
		onlineBg.scaleX = 1.6320594404358049;
		onlineBg.scaleY = 3.0956180063085617;
		onlineBg.setOrigin(0, 0);
		onlineBg.isFilled = true;
		onlineBg.fillColor = 2763306;
		onlineBg.fillAlpha = 0.85;
		onlinePanel.add(onlineBg);

		// button_rectangle_depth_border
		const button_rectangle_depth_border = this.add.image(0, 0, "button_rectangle_depth_border");
		button_rectangle_depth_border.scaleX = 1.0868518355173178;
		button_rectangle_depth_border.scaleY = 1.0945734102895304;
		button_rectangle_depth_border.setOrigin(0, 0);
		onlinePanel.add(button_rectangle_depth_border);

		// OnlinePlayers
		const onlinePlayers = this.add.text(104, 20, "", {});
		onlinePlayers.setOrigin(0.5, 0);
		onlinePlayers.text = "Online";
		onlinePlayers.setStyle({ "color": "#000000ff", "fontSize": "28px" });
		onlinePanel.add(onlinePlayers);

		// LogoutButton
		const logoutButton = this.add.container(640, 679);
		logoutButton.setInteractive(new Phaser.Geom.Rectangle(-192, -64, 384, 128), Phaser.Geom.Rectangle.Contains);
		logoutButton.scaleX = 0.7;
		logoutButton.scaleY = 0.7;

		// LogoutImage
		const logoutImage = this.add.image(0, 3, "button_rectangle_depth_flat");
		logoutButton.add(logoutImage);

		// LogoutText
		const logoutText = this.add.text(0, 0, "", {});
		logoutText.setOrigin(0.5, 0.5);
		logoutText.text = "Logout";
		logoutText.setStyle({ "align": "center", "fontSize": "48px" });
		logoutButton.add(logoutText);

		// ChallengePanel
		const challengePanel = this.add.container(1071, 0);

		// ChallengesBg
		const challengesBg = this.add.rectangle(0, 0, 128, 128);
		challengesBg.scaleX = 1.6320594404358049;
		challengesBg.scaleY = 3.0956180063085617;
		challengesBg.setOrigin(0, 0);
		challengesBg.isFilled = true;
		challengesBg.fillColor = 2763306;
		challengesBg.fillAlpha = 0.85;
		challengePanel.add(challengesBg);

		// button_rectangle_depth_border_1
		const button_rectangle_depth_border_1 = this.add.image(0, 0, "button_rectangle_depth_border");
		button_rectangle_depth_border_1.scaleX = 1.0868518355173178;
		button_rectangle_depth_border_1.scaleY = 1.0945734102895304;
		button_rectangle_depth_border_1.setOrigin(0, 0);
		challengePanel.add(button_rectangle_depth_border_1);

		// Challenges
		const challenges = this.add.text(104, 19, "", {});
		challenges.setOrigin(0.5, 0);
		challenges.text = "Challenges";
		challenges.setStyle({ "color": "#000000ff", "fontSize": "28px" });
		challengePanel.add(challenges);

		this.onlinePanel = onlinePanel;
		this.logoutImage = logoutImage;
		this.logoutButton = logoutButton;
		this.challengePanel = challengePanel;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.GameObjects.Container} */
	onlinePanel;
	/** @type {Phaser.GameObjects.Image} */
	logoutImage;
	/** @type {Phaser.GameObjects.Container} */
	logoutButton;
	/** @type {Phaser.GameObjects.Container} */
	challengePanel;

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();

		// Get current user - fallback to username from login if needed
		this.currentUser = this.game.registry.get('currentUser') || { username: 'Unknown' };
		
		// If currentUser doesn't have username property, it might be stored differently
		if (!this.currentUser.username && typeof this.currentUser === 'string') {
			this.currentUser = { username: this.currentUser };
		}

		// Create containers for dynamic content
		this.onlineUsersContainer = this.add.container(10, 90);
		this.onlinePanel.add(this.onlineUsersContainer);

		// Create challenges sections
		const receivedLabel = this.add.text(10, 75, "Received", { 
			fontSize: '20px', 
			color: '#e8e8e8'
		});
		this.challengePanel.add(receivedLabel);  // Add to panel so it moves with it

		this.receivedChallengesContainer = this.add.container(10, 90);
		this.challengePanel.add(this.receivedChallengesContainer);

		const sentLabel = this.add.text(10, 250, "Sent", { 
			fontSize: '20px', 
			color: '#e8e8e8'
		});
		this.challengePanel.add(sentLabel);  // Add to panel so it moves with it

		this.sentChallengesContainer = this.add.container(10, 280);
		this.challengePanel.add(this.sentChallengesContainer);

		// Create active games panel
		this.createActiveGamesPanel();

		// Setup logout button
		this.setupLogoutButton();

		// Start polling for updates
		this.startPolling();

		// Initial data load
		this.loadOnlineUsers();
		this.loadChallenges();
		this.loadActiveGames();
	}

	createActiveGamesPanel() {
		// Active Games Panel Background
		const gamesPanelBg = this.add.rectangle(640, 500, 600, 150, 0x2a2a2a, 0.85);

		// Active Games Title
		this.add.text(640, 440, "Active Games", {
			fontSize: '28px',
			color: '#ffffff'
		}).setOrigin(0.5);

		// Container for game list
		this.activeGamesContainer = this.add.container(640, 480);
	}

	setupLogoutButton() {
		// Store reference to logout image for hover effects
		const logoutImageRef = this.logoutImage;

		// Logout button events
		this.logoutButton.on('pointerover', () => {
			logoutImageRef.setTexture("button_rectangle_depth_gradient");
			this.logoutButton.setScale(0.75, 0.75);
		});

		this.logoutButton.on('pointerout', () => {
			logoutImageRef.setTexture("button_rectangle_depth_flat");
			this.logoutButton.setScale(0.7, 0.7);
		});

		this.logoutButton.on('pointerdown', () => {
			logoutImageRef.setTexture("button_rectangle_depth_gradient");
			this.logoutButton.setScale(0.68, 0.68);
			this.handleLogout();
		});

		this.logoutButton.on('pointerup', () => {
			if (this.logoutButton.input && this.logoutButton.input.localX !== undefined) {
				logoutImageRef.setTexture("button_rectangle_depth_gradient");
				this.logoutButton.setScale(0.75, 0.75);
			} else {
				logoutImageRef.setTexture("button_rectangle_depth_flat");
				this.logoutButton.setScale(0.7, 0.7);
			}
		});
	}

	startPolling() {
		// Poll every 2 seconds
		this.pollInterval = this.time.addEvent({
			delay: 2000,
			callback: () => {
				this.loadOnlineUsers();
				this.loadChallenges();
				this.loadActiveGames();
			},
			loop: true
		});
	}

	async loadOnlineUsers() {
		try {
			const response = await fetch('https://cardbreaker.onrender.com/api/users/online', {
				credentials: 'include'
			});
			const data = await response.json();

			// accept either plain array *or* an { users: [...] } wrapper
			const list = Array.isArray(data) ? data : (data.users || []);
			this.updateOnlineUsersList(list);
		} catch (error) {
			console.error('Error loading online users:', error);
		}
	}

	async loadChallenges() {
		try {
			const response = await fetch('https://cardbreaker.onrender.com/api/challenge/pending', {
				credentials: 'include'
			});
			const data = await response.json();

			this.updateChallengesList(data.received || [], data.sent || []);
		} catch (error) {
			console.error('Error loading challenges:', error);
		}
	}

	async loadActiveGames() {
		try {
			const response = await fetch('https://cardbreaker.onrender.com/api/game/active', {
				credentials: 'include'
			});
			const data = await response.json();

			if (data.games) {
				this.updateActiveGamesList(data.games);
			}
		} catch (error) {
			console.error('Error loading active games:', error);
		}
	}

	updateOnlineUsersList(users) {
		// Clear existing
		this.onlineUsersContainer.removeAll(true);

		const style = { fontSize: '20px', color: '#e8e8e8' };

		// Filter out current user and display others
		const otherUsers = users.filter(user => user.username !== this.currentUser.username);

		if (otherUsers.length === 0) {
			const noUsersText = this.add.text(0, 50, '• No users online', {
				fontSize: '18px',
				color: '#888888',
				fontStyle: 'italic'
			});
			this.onlineUsersContainer.add(noUsersText);
			return;
		}

		otherUsers.forEach((user, index) => {
			const y = index * 35;

			// Username
			const userText = this.add.text(0, y, `• ${user.username}`, style);
			this.onlineUsersContainer.add(userText);

			// Challenge button (simple rectangle for now)
			const challengeBtn = this.add.rectangle(150, y + 10, 80, 25, 0x4444ff)
				.setInteractive({ useHandCursor: true });

			const challengeText = this.add.text(150, y + 10, 'Challenge', {
				fontSize: '14px',
				color: '#ffffff'
			}).setOrigin(0.5);

			this.onlineUsersContainer.add(challengeBtn);
			this.onlineUsersContainer.add(challengeText);

			// Challenge button events
			challengeBtn.on('pointerover', () => challengeBtn.setFillStyle(0x6666ff));
			challengeBtn.on('pointerout', () => challengeBtn.setFillStyle(0x4444ff));
			challengeBtn.on('pointerdown', () => this.sendChallenge(user.user_id));
		});
	}

	updateChallengesList(received, sent) {
		// Update received challenges
		this.receivedChallengesContainer.removeAll(true);

		received.forEach((challenge, index) => {
			const y = index * 35 + 6;

			const challengerText = this.add.text(0, y + 5, challenge.challenger_name, {
				fontSize: '18px',
				color: '#e8e8e8'
			});
			this.receivedChallengesContainer.add(challengerText);

			// Accept button
			const acceptBtn = this.add.rectangle(95, y + 15, 70, 25, 0x44ff44)
				.setInteractive({ useHandCursor: true });

			const acceptText = this.add.text(95, y + 15, 'Accept', {
				fontSize: '14px',
				color: '#ffffff'
			}).setOrigin(0.5);

			this.receivedChallengesContainer.add(acceptBtn);
			this.receivedChallengesContainer.add(acceptText);

			acceptBtn.on('pointerover', () => acceptBtn.setFillStyle(0x66ff66));
			acceptBtn.on('pointerout', () => acceptBtn.setFillStyle(0x44ff44));
			acceptBtn.on('pointerdown', () => this.acceptChallenge(challenge.challenge_id));

			// Decline button
			const declineBtn  = this.add.rectangle(165, y + 15, 63, 25, 0xff4444)
				.setInteractive({ useHandCursor: true });
			const declineTxt  = this.add.text(165, y + 15, 'Decline', {
				fontSize: '14px', color: '#ffffff'
			}).setOrigin(0.5);

			this.receivedChallengesContainer.add([declineBtn, declineTxt]);

			declineBtn.on('pointerover', () => declineBtn.setFillStyle(0xff6666));
			declineBtn.on('pointerout',  () => declineBtn.setFillStyle(0xff4444));
			declineBtn.on('pointerdown', () => this.declineChallenge(challenge.challenge_id));
		});

		// Update sent challenges
		this.sentChallengesContainer.removeAll(true);

		sent.forEach((challenge, index) => {
			const y = index * 35 + 6;

			const challengedText = this.add.text(0, y, challenge.challenged_name, {
				fontSize: '18px',
				color: '#e8e8e8'
			});
			this.sentChallengesContainer.add(challengedText);

			// Cancel button
			const cancelBtn = this.add.rectangle(120, y + 10, 60, 25, 0xaa8800)
				.setInteractive({ useHandCursor: true });
			const cancelTxt = this.add.text(120, y + 10, 'Cancel', {
				fontSize: '14px', color: '#ffffff'
			}).setOrigin(0.5);
			
			this.sentChallengesContainer.add([cancelBtn, cancelTxt]);

			cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xccaa00));
			cancelBtn.on('pointerout',  () => cancelBtn.setFillStyle(0xaa8800));
			cancelBtn.on('pointerdown', () => this.cancelChallenge(challenge.challenge_id));

			/* ───────────── clean-slate if nothing to show ───────────── */
			if (!received.length)  this.receivedChallengesContainer.removeAll(true);
			if (!sent.length)      this.sentChallengesContainer.removeAll(true);
		});
	}

	updateActiveGamesList(games) {
		this.activeGamesContainer.removeAll(true);

		if (games.length === 0) {
			const noGamesText = this.add.text(0, 0, 'No active games', {
				fontSize: '18px',
				color: '#888888',
				fontStyle: 'italic'
			}).setOrigin(0.5);
			this.activeGamesContainer.add(noGamesText);
			return;
		}

		games.forEach((game, index) => {
			const x = (index - (games.length - 1) / 2) * 200;

			// Game button
			const gameBtn = this.add.rectangle(x, 0, 180, 40, 0x555555)
				.setInteractive({ useHandCursor: true });

			const gameText = this.add.text(x, 0, `Game vs ${game.opponent_name}`, {
				fontSize: '16px',
				color: '#ffffff'
			}).setOrigin(0.5);

			this.activeGamesContainer.add(gameBtn);
			this.activeGamesContainer.add(gameText);

			gameBtn.on('pointerover', () => gameBtn.setFillStyle(0x777777));
			gameBtn.on('pointerout', () => gameBtn.setFillStyle(0x555555));
			gameBtn.on('pointerdown', () => this.joinGame(game.game_id));
		});
	}

	async sendChallenge(userId) {
		try {
			const response = await fetch('https://cardbreaker.onrender.com/api/challenge/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ challengedId: userId })
			});

			const data = await response.json();

			if (!response.ok) {
				console.error('Challenge error:', data.error);
			} else {
				console.log('Challenge sent successfully');
			}
		} catch (error) {
			console.error('Error sending challenge:', error);
		}
	}

	async acceptChallenge(challengeId) {
		try {
			const response = await fetch('https://cardbreaker.onrender.com/api/challenge/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ challengeId: challengeId })
			});

			const data = await response.json();
			console.log('[acceptChallenge] status:', response.status, 'payload:', data);

			if (response.ok && data.game_id) {
				// Store game ID and transition to game scene
				this.game.registry.set('currentGameId', data.game_id);
				this.cleanupAndTransition('Level');
			}
			else if (!response.ok) {
          		console.error('Accept error:', data.error);
      		}
		} catch (error) {
			console.error('Error accepting challenge:', error);
		}
	}

	async declineChallenge(challengeId) {
		try {
			const res = await fetch('https://cardbreaker.onrender.com/api/challenge/decline', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ challengeId: challengeId })
			});

			const data = await res.json();
			console.log('[declineChallenge] status:', res.status, 'payload:', data);

			/* ───── force a fresh list right away ───── */
    		if (res.ok) this.loadChallenges();
			
		} catch (e) { console.error('Error declining:', e); }
	}

	async cancelChallenge(challengeId) {
		try {
			const res = await fetch('https://cardbreaker.onrender.com/api/challenge/cancel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ challengeId: challengeId })
			});

			const data = await res.json();
			console.log('[cancelChallenge] status:', res.status, 'payload:', data);

			/* ───── force a fresh list right away ───── */
    		if (res.ok) this.loadChallenges();

		} catch (e) { console.error('Error cancelling:', e); }
	}

	async joinGame(gameId) {
		// Store game ID and transition to game scene
		this.game.registry.set('currentGameId', gameId);
		this.cleanupAndTransition('Level');
	}

	async handleLogout() {
		try {
			const response = await fetch('https://cardbreaker.onrender.com/api/logout', {
				method: 'POST',
				credentials: 'include'
			});

			if (response.ok) {
				// Clear user data
				this.game.registry.remove('currentUser');
				this.cleanupAndTransition('Login');
			}
		} catch (error) {
			console.error('Error logging out:', error);
		}
	}

	cleanupAndTransition(sceneName) {
		// Stop polling
		if (this.pollInterval) {
			this.pollInterval.remove();
		}

		this.receivedChallengesContainer?.removeAll(true);
		this.sentChallengesContainer?.removeAll(true);
		this.onlineUsersContainer?.removeAll(true);

		// Transition to new scene
		this.scene.start(sceneName);
	}

	shutdown() {
		// Clean up when scene shuts down
		if (this.pollInterval) {
			this.pollInterval.remove();
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here