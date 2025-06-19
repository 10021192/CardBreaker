
// You can write more code here

/* START OF COMPILED CODE */

class Login extends Phaser.Scene {

	constructor() {
		super("Login");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// LoginButton
		const loginButton = this.add.container(640, 551);
		loginButton.setInteractive(new Phaser.Geom.Rectangle(-192, -64, 384, 128), Phaser.Geom.Rectangle.Contains);
		loginButton.scaleX = 0.7;
		loginButton.scaleY = 0.7;

		// LoginImage
		const loginImage = this.add.image(0, 3, "button_rectangle_depth_flat");
		loginButton.add(loginImage);

		// LoginText
		const loginText = this.add.text(0, 0, "", {});
		loginText.setOrigin(0.5, 0.5);
		loginText.text = "Login";
		loginText.setStyle({ "align": "center", "fontSize": "48px" });
		loginButton.add(loginText);

		this.loginImage = loginImage;
		this.loginButton = loginButton;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.GameObjects.Image} */
	loginImage;
	/** @type {Phaser.GameObjects.Container} */
	loginButton;

	/* START-USER-CODE */

	// Write your code here

	create() {

        this.editorCreate();

        // Create title text
        this.add
		.text(this.scale.width / 2, 150, "CardBreaker", {
			fontSize: "64px",
			color: "#ffffff",
			fontStyle: "bold",
		})
		.setOrigin(0.5);

        // Create login form background
        this.add.rectangle(this.scale.width / 2, 350, 500, 300, 0x2a2a2a, 0.8);

        // labels kept as refs so we can read their world coordinates later
		this.userLabel = this.add.text(400, 300, "Username:", { fontSize: 24, color: "#fff" }).setOrigin(0, 0.5);
		this.passLabel = this.add.text(400, 400, "Password:", { fontSize: 24, color: "#fff" }).setOrigin(0, 0.5);

        // DOM inputs
    	this.makeInputs();

        // Register link text
        const registerLink = this.add.text(640, 610, "Don't have an account? Register here", {
            fontSize: '18px',
            color: '#4a90e2',
            fontStyle: 'underline'
        }).setOrigin(0.5);

        registerLink.setInteractive({ useHandCursor: true });
        registerLink.on('pointerover', () => registerLink.setColor('#6bb6ff'));
        registerLink.on('pointerout', () => registerLink.setColor('#4a90e2'));
        registerLink.on('pointerdown', () => {
            // Switch to register mode
            this.toggleRegisterMode();
        });

        // Store register link reference
        this.registerLink = registerLink;

        // Login button events
        this.loginButton
      .on("pointerover", () => {
        this.loginImage.setTexture("button_rectangle_depth_gradient");
        this.loginButton.setScale(0.75);
      })
      .on("pointerout", () => {
        this.loginImage.setTexture("button_rectangle_depth_flat");
        this.loginButton.setScale(0.7);
      })
	  .on('pointerdown', () => {
		this.loginImage.setTexture("button_rectangle_depth_gradient");
		this.loginButton.setScale(0.68, 0.68);

		// Perform login/register action
            if (this.isRegisterMode) {
                this.handleRegister();
            } else {
                this.handleLogin();
            }
	  });

        // Initialize as login mode
        this.isRegisterMode = false;

        // Create error message text (initially hidden)
        this.errorText = this.add.text(640, 480, '', {
            fontSize: '18px',
            color: '#ff4444'
        }).setOrigin(0.5);
    }

    makeInputs() {
	 const makeField = (type, placeholder) => {
		const input = document.createElement("input");
		input.type = type;
		input.placeholder = placeholder;
		Object.assign(input.style, {
			position: "absolute",
			width: "300px",
			height: "40px",
			fontSize: "18px",
			padding: "5px 10px",
			border: "2px solid #4a4a4a",
			borderRadius: "5px",
			background: "#1a1a1a",
			color: "#ffffff",
		});
		this.game.canvas.parentElement.appendChild(input);
		return input;
	 };

		this.usernameInput = makeField("text", "Enter username");
		this.passwordInput = makeField("password", "Enter password");

		// First positioning & responsive updates
		this.updateInputPos();
		this.scale.on("resize", this.updateInputPos, this);
		window.addEventListener("resize", () => this.updateInputPos());
  	}

    // convert label world‑position to DOM px each frame
	updateInputPos = () => {
		const rect = this.game.canvas.getBoundingClientRect();

		// helper to convert a world point to page pixels
		const worldToPage = (x, y) => ({
		x: rect.left + x,
		y: rect.top  + y
		});

		if (this.userLabel && this.usernameInput) {
		const r = worldToPage(this.userLabel.x + this.userLabel.width + 20, this.userLabel.y);
		this.usernameInput.style.left = `${r.x + 150}px`;
		this.usernameInput.style.top  = `${r.y + 75}px`; // 20 px lifts to vertical centre of field
		}
		if (this.passLabel && this.passwordInput) {
		const r = worldToPage(this.passLabel.x + this.passLabel.width + 20, this.passLabel.y);
		this.passwordInput.style.left = `${r.x + 150}px`;
		this.passwordInput.style.top  = `${r.y + 105}px`;
		}
	};

    toggleRegisterMode() {
        this.isRegisterMode = !this.isRegisterMode;

        // Update button text
        const buttonText = this.loginButton.list.find(child => child.type === 'Text');
        if (buttonText) {
            buttonText.text = this.isRegisterMode ? 'Register' : 'Login';
        }

        // Update link text
        this.registerLink.text = this.isRegisterMode 
            ? 'Already have an account? Login here'
            : "Don't have an account? Register here";

        // Clear error message
        this.errorText.text = '';
    }

    async handleLogin() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();

        if (!username || !password) {
            this.showError('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('https://cardbreaker.onrender.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Login successful:', data);
                // Store user data if needed
                this.game.registry.set('currentUser', { username: data.username });
                // Transition to lobby scene
                this.cleanDom();
                this.scene.start('Lobby');
            } else {
                this.showError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Connection error. Please try again.');
        }
    }

    async handleRegister() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();

        if (!username || !password) {
            this.showError('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('https://cardbreaker.onrender.com/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Registration successful');
                this.showError('Registration successful! Please login.', '#44ff44');
                // Switch back to login mode
                setTimeout(() => {
                    this.toggleRegisterMode();
                    this.errorText.text = '';
                }, 2000);
            } else {
                this.showError(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Connection error. Please try again.');
        }
    }

    showError(message, color = '#ff4444') {
        this.errorText.setText(message);
        this.errorText.setColor(color);

        // Auto-hide error after 5 seconds
        this.time.delayedCall(5000, () => {
            this.errorText.setText('');
        });
    }

    cleanDom() {
    this.usernameInput?.remove();
    this.passwordInput?.remove();
  }

    shutdown() {
    this.cleanDom();
  }

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
