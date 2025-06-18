
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
		const onlinePlayers = this.add.text(104, 19, "", {});
		onlinePlayers.setOrigin(0.5, 0);
		onlinePlayers.text = "Online";
		onlinePlayers.setStyle({ "color": "#000000ff", "fontSize": "28px" });
		onlinePanel.add(onlinePlayers);

		// LoginButton
		const loginButton = this.add.container(640, 679);
		loginButton.setInteractive(new Phaser.Geom.Rectangle(-192, -64, 384, 128), Phaser.Geom.Rectangle.Contains);
		loginButton.scaleX = 0.7;
		loginButton.scaleY = 0.7;

		// LogoutImage
		const logoutImage = this.add.image(0, 3, "button_rectangle_depth_flat");
		loginButton.add(logoutImage);

		// LogoutText
		const logoutText = this.add.text(0, 0, "", {});
		logoutText.setOrigin(0.5, 0.5);
		logoutText.text = "Logout";
		logoutText.setStyle({ "align": "center", "fontSize": "48px" });
		loginButton.add(logoutText);

		// ChallengePanel
		const challengePanel = this.add.container(1071, 0);

		// ReceivedBg
		const receivedBg = this.add.rectangle(0, 0, 128, 128);
		receivedBg.scaleX = 1.6320594404358049;
		receivedBg.scaleY = 3.0956180063085617;
		receivedBg.setOrigin(0, 0);
		receivedBg.isFilled = true;
		receivedBg.fillColor = 2763306;
		receivedBg.fillAlpha = 0.85;
		challengePanel.add(receivedBg);

		// ReceivedLabel
		const receivedLabel = this.add.text(103, 80, "", {});
		receivedLabel.setOrigin(0.5, 0);
		receivedLabel.text = "Received";
		receivedLabel.setStyle({ "color": "#ffffffff", "fontSize": "28px" });
		challengePanel.add(receivedLabel);

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
		this.loginButton = loginButton;
		this.challengePanel = challengePanel;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.GameObjects.Container} */
	onlinePanel;
	/** @type {Phaser.GameObjects.Image} */
	logoutImage;
	/** @type {Phaser.GameObjects.Container} */
	loginButton;
	/** @type {Phaser.GameObjects.Container} */
	challengePanel;

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();

		const stubNames = ["Alice", "Bob", "Cara", "Dan", "Eve"];
    const style = { fontSize: 20, color: "#e8e8e8" };

    stubNames.forEach((name, i) => {
        const row = this.add.text(10, 90 + i * 28, "• " + name, style);
        this.onlinePanel.add(row);          // << add as child of the panel
    });
/*
		// Start polling for updates
        this.startPolling();

        // Initial data load
        this.loadOnlineUsers();
        this.loadChallenges();
        this.loadActiveGames();*/
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
