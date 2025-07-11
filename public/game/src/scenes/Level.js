class Level extends Phaser.Scene {
    constructor() {
        super("Level");
    }
    
    init() {
        // Reset all game state when scene is initialized
        this.gameId = null;
        this.currentRound = 1;
        this.myLives = 3;
        this.opponentLives = 3;
        this.selectedCard = null;
        this.selectedToken = null;
        this.switchToCard = null; // For switch token
        this.tokenAvailable = true;
        this.tokenCooldown = 0;
        this.isMyTurn = true;
        this.gameState = 'selecting'; // selecting, waiting, revealing, gameOver
        this.pollInterval = null;
        this.lastRoundNumber = 0;
        this.isSubmitting = false;
        this.yourRole = null;
        this.roundResultShown = false;
    }

    create() {
        // Get game ID from registry
        this.gameId = this.game.registry.get('currentGameId');
        this.currentUser = this.game.registry.get('currentUser');
        
        // Background
        this.add.rectangle(640, 360, 1280, 720, 0x1a1a1a);
        
        // Create UI sections
        this.createOpponentSection();
        this.createPlayerSection();
        this.createGameInfo();
        this.createTokenSection();
        this.createActionButtons();
        
        // Start polling for game updates
        this.startPolling();
        
        // Initial game state load
        this.loadGameState();
    }
    
    createOpponentSection() {
        // Opponent area
        this.add.rectangle(640, 150, 600, 200, 0x2a2a2a, 0.8);
        
        // Opponent name
        this.opponentNameText = this.add.text(640, 80, 'Opponent', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Opponent lives
        this.opponentLivesContainer = this.add.container(440, 100);
        this.updateLivesDisplay(this.opponentLivesContainer, this.opponentLives);
        
        // Opponent's played card (hidden until reveal)
		this.opponentCardBack = this.add.image(640, 180, "card_back")
										.setDisplaySize(80, 120);
        this.opponentCardText = this.add.text(640, 180, '?', {
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5);
    }
    
    createPlayerSection() {
        // Player area
        this.add.rectangle(640, 550, 600, 200, 0x2a2a2a, 0.8);
        
        // Player name
        this.add.text(640, 480, this.currentUser.username, {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Player lives (moved up to avoid overlap with cards)
        this.playerLivesContainer = this.add.container(440, 490);
        this.updateLivesDisplay(this.playerLivesContainer, this.myLives);
        
        // Card selection area
        this.createCardSelection();
    }
    
    createCardSelection() {
        const art = { Attack: "card_attack", Counter: "card_counter", Shield: "card_shield" };
  		const cards = Object.keys(art);
        
        this.cardButtons = [];
        
        cards.forEach((card, index) => {
            const x = 490 + (index * 150);
            const y = 580;
            
            const img = this.add.image(x, y, art[card])
                       .setDisplaySize(100, 140)
                       .setInteractive({ useHandCursor: true });
            
			img.on('pointerdown', () => {
				if (this.gameState !== 'selecting') return;
				if (this.selectedToken === 'switch' && this.selectedCard)
					this.selectSwitchCard(card); else this.selectCard(card);
			});
			this.cardButtons.push({ img, type:card });
        });
    }
    
    createTokenSection() {
        // Token area
        this.add.text(100, 300, 'Tokens', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Switch token
        this.switchToken = this.add.image(70, 350, "token_switch")
                             .setDisplaySize(60, 60)
                             .setInteractive({ useHandCursor: true });
        this.switchCooldownText = this.add.text(70, 390, '', {
            fontSize: '14px',
            color: '#ff4444'
        }).setOrigin(0.5);
        
        // Life token
          this.lifeToken = this.add.image(130, 350, "token_life")
                           .setDisplaySize(60, 60)
                           .setInteractive({ useHandCursor: true });
        this.lifeCooldownText = this.add.text(130, 390, '', {
            fontSize: '14px',
            color: '#ff4444'
        }).setOrigin(0.5);
        
        // Token selection
        this.switchToken.on('pointerdown', () => this.selectToken('switch'));
        this.lifeToken.on('pointerdown', () => this.selectToken('life'));
        
        this.tokenButtons = { switch: this.switchToken, life: this.lifeToken };
        
        // Switch card selection hint
        this.switchHintText = this.add.text(100, 420, '', {
            fontSize: '16px',
            color: '#9944ff',
            wordWrap: { width: 180 }
        }).setOrigin(0.5).setVisible(false);
    }
    
    createGameInfo() {
        // Round counter
        this.roundText = this.add.text(640, 30, 'Round 1', {
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Game status - multiline support with word wrap
        this.statusText = this.add.text(640, 360, '', {
            fontSize: '24px',
            color: '#ffff00',
            align: 'center',
            wordWrap: { width: 500 }
        }).setOrigin(0.5);
    }
    
    createActionButtons() {
        // Play card button
        const playButton = this.add.rectangle(1100, 400, 150, 50, 0x44ff44)
            .setInteractive({ useHandCursor: true });
        const playText = this.add.text(1100, 400, 'Play Card', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        playButton.on('pointerover', () => playButton.setFillStyle(0x66ff66));
        playButton.on('pointerout', () => playButton.setFillStyle(0x44ff44));
        playButton.on('pointerdown', () => this.playCard());
        
        // Quit game button
        const quitButton = this.add.rectangle(1100, 600, 150, 40, 0xff4444)
            .setInteractive({ useHandCursor: true });
        this.add.text(1100, 600, 'Quit Game', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        quitButton.on('pointerover', () => quitButton.setFillStyle(0xff6666));
        quitButton.on('pointerout', () => quitButton.setFillStyle(0xff4444));
        quitButton.on('pointerdown', () => this.quitGame());
    }
    
    // ───────────────── updateLivesDisplay ─────────────────
	updateLivesDisplay(container, lives) {
		container.removeAll(true);
		for (let i = 0; i < 3; i++) {
			const x = (i - 1) * 40;
			const heart = this.add.image(x, 0, "heart")
								.setDisplaySize(30, 30)
								.setTint(i < lives ? 0xffffff : 0x444444);
			container.add(heart);
		}
	}
    
    selectCard(cardType) {
        if (this.gameState !== 'selecting') return;
        
        this.selectedCard = cardType;
        this.switchToCard = null;
        
        if (this.selectedToken === 'switch') {
            this.statusText.setText(`Selected: ${cardType} - Now select card to switch to`);
            this.switchHintText.setText('Click another card to switch to').setVisible(true);
        } else {
            this.statusText.setText(`Selected: ${cardType}`);
            this.switchHintText.setVisible(false);
        }
    }
    
    selectSwitchCard(cardType) {
        if (this.selectedToken !== 'switch' || !this.selectedCard) return;
        
        this.switchToCard = cardType;
        
        this.statusText.setText(`Will play ${this.selectedCard} → ${cardType}`);
        this.switchHintText.setText(`Switch: ${this.selectedCard} → ${cardType}`).setVisible(true);
    }
    
    selectToken(tokenType) {
        if (this.gameState !== 'selecting') return;
        if (!this.tokenAvailable) {
            this.statusText.setText(`Token on cooldown! (${this.tokenCooldown} rounds left)`);
            return;
        }
        
        // Toggle token selection
        if (this.selectedToken === tokenType) {
            this.selectedToken = null;
            this.switchToCard = null;
            this.switchHintText.setVisible(false);
        } else {
            this.selectedToken = tokenType;
            if (tokenType === 'switch' && this.selectedCard) {
                this.switchHintText.setText('Click another card to switch to').setVisible(true);
            }
        }
    }
    
    async playCard() {
        if (!this.selectedCard) {
            this.statusText.setText('Select a card first!');
            return;
        }
        
        if (this.selectedToken === 'switch' && !this.switchToCard) {
            this.statusText.setText('Select a card to switch to!');
            return;
        }
        
        if (this.gameState !== 'selecting' || this.isSubmitting) return;
        
        this.isSubmitting = true;
        
        try {
            const payload = {
                card: this.selectedCard.toLowerCase(),
                useToken: !!this.selectedToken,
                tokenEffect: this.selectedToken,
                switchToCard: this.switchToCard ? this.switchToCard.toLowerCase() : undefined
            };
            
            const response = await fetch(`https://cardbreaker.onrender.com/api/game/${this.gameId}/play-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.gameState = 'waiting';
                this.statusText.setText('Waiting for opponent...');
                this.clearSelections();
                
                // Handle immediate round resolution if returned
                if (data.roundResult) {
                    this.handleRoundResult(data.roundResult);
                }
            } else {
                this.statusText.setText(data.error || 'Failed to play card');
            }
        } catch (error) {
            console.error('Error playing card:', error);
            
            if (error.message.includes('oppCard')) {
                this.statusText.setText('Error processing round result');
            } else {
                this.statusText.setText('Network error - please check connection');
            }
        } finally {
            this.isSubmitting = false;
        }
    }
    
    clearSelections() {
        this.selectedCard = null;
        this.selectedToken = null;
        this.switchToCard = null;
        this.switchHintText.setVisible(false);
    }
    
    startPolling() {
        this.pollInterval = this.time.addEvent({
            delay: 1000,
            callback: () => this.loadGameState(),
            loop: true
        });
    }
    
    async loadGameState() {
        if (this.gameState === 'gameOver') return;
        
        try {
            const response = await fetch(`https://cardbreaker.onrender.com/api/game/${this.gameId}`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.updateGameState(data);
            }
        } catch (error) {
            console.error('Error loading game state:', error);
        }
    }
    
    updateGameState(data) {
        const game = data.game;
        const currentRoundInfo = data.currentRound;
        const token = data.token;
        
        // Store role
        this.yourRole = game.yourRole;
        
        // Update lives
        this.myLives = game.yourLives;
        this.opponentLives = game.opponentLives;
        
        this.updateLivesDisplay(this.playerLivesContainer, this.myLives);
        this.updateLivesDisplay(this.opponentLivesContainer, this.opponentLives);
        
        // Update opponent name
        const opponentName = game.yourRole === 'player1' ? game.player2Name : game.player1Name;
        this.opponentNameText.setText(opponentName);
        
        // Update round number
        this.roundText.setText(`Round ${game.currentRound}`);
        
        // Check if this is a new round
        if (game.currentRound > this.currentRound) {
            // New round started
            this.currentRound = game.currentRound;
            this.gameState = 'selecting';
            this.clearSelections();
            this.opponentCardText.setText('?');
            this.statusText.setText('Select your card');
            this.roundResultShown = false;
        }
        
        // Update token availability
        this.tokenAvailable = token.available;
        this.tokenCooldown = token.roundsUntilAvailable;
        this.updateTokenDisplay();
        
        // Check game over
        if (game.status === 'completed') {
            const won = this.myLives > 0;
            this.handleGameOver(won);
            return;
        }
        
        // Update game state based on round info
        if (currentRoundInfo.bothPlayed && !this.roundResultShown && this.gameState !== 'revealing') {
            // Both played, need to fetch round result
            this.fetchRoundResult();
        } else if (currentRoundInfo.hasPlayed && this.gameState === 'selecting') {
            this.gameState = 'waiting';
            this.statusText.setText('Waiting for opponent...');
        } else if (!currentRoundInfo.hasPlayed && this.gameState !== 'selecting' && !this.roundResultShown) {
            // Reset to selecting if haven't played yet
            this.gameState = 'selecting';
            this.statusText.setText('Select your card');
            this.clearSelections();
        }
    }
    
    updateTokenDisplay() {
        const cooldownText = this.tokenCooldown > 0 ? `CD: ${this.tokenCooldown}` : '';
        this.switchCooldownText.setText(cooldownText);
        this.lifeCooldownText.setText(cooldownText);
        
        // Update token interactivity and appearance
        const alpha = this.tokenAvailable ? 1 : 0.5;
        this.switchToken.setAlpha(alpha);
        this.lifeToken.setAlpha(alpha);
        
        // Clear token selection if on cooldown
        if (!this.tokenAvailable && this.selectedToken) {
            this.selectedToken = null;
            this.switchToCard = null;
            this.switchHintText.setVisible(false);
        }
    }
    
    async fetchRoundResult() {
        if (this.roundResultShown) return; // Prevent duplicate fetches
        
        try {
            const response = await fetch(`https://cardbreaker.onrender.com/api/game/${this.gameId}/history`, {
                credentials: 'include'
            });
            
            const rounds = await response.json();
            
            if (response.ok && rounds.length > 0) {
                const lastRound = rounds[rounds.length - 1];
                if (lastRound.round_number === this.currentRound) {
                    this.handleRoundResult(lastRound);
                }
            }
        } catch (error) {
            console.error('Error fetching round result:', error);
        }
    }
    
    handleRoundResult(round) {
        this.gameState = 'revealing';
        this.roundResultShown = true;
        
        // Determine cards based on role
        const isPlayer1 = round.player1_id ? 
            this.currentUser.user_id === round.player1_id :
            this.yourRole === 'player1';
            
        const myCard = isPlayer1 ? round.player1_card : round.player2_card;
        const oppCard = isPlayer1 ? round.player2_card : round.player1_card;
        const myOriginal = isPlayer1 ? round.player1_original_card : round.player2_original_card;
        const myToken = isPlayer1 ? round.player1_token_effect : round.player2_token_effect;
        const oppToken = isPlayer1 ? round.player2_token_effect : round.player1_token_effect;
        const oppOriginal = isPlayer1 ? round.player2_original_card : round.player1_original_card;
        
        // Safety check for undefined cards
        if (!myCard || !oppCard) {
            console.error('Round result missing card data:', round);
            return;
        }
        
        // First, show the opponent's card
        this.opponentCardText.setText(oppCard.toUpperCase());
        this.opponentCardBack.setVisible(false);
        
        // Create a semi-transparent overlay for the round result
        this.roundResultOverlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7)
            .setDepth(100)
            .setInteractive(); // Block clicks behind
        
        // Create container for round result display
        this.roundResultContainer = this.add.container(640, 360).setDepth(101);
        
        // Background panel for results
        const panel = this.add.rectangle(0, 0, 600, 400, 0x2a2a2a, 0.95)
            .setStrokeStyle(3, 0xffffff);
        this.roundResultContainer.add(panel);
        
        // Title
        const titleText = this.add.text(0, -150, 'Round Result', {
            fontSize: '36px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.roundResultContainer.add(titleText);
        
        // Player cards display
        const cardSize = { width: 80, height: 120 };
        
        // Your card
        const yourCardLabel = this.add.text(-150, -80, 'You played:', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.roundResultContainer.add(yourCardLabel);
        
        const yourCardBg = this.add.rectangle(-150, 0, cardSize.width, cardSize.height, 0x4444ff, 0.8)
            .setStrokeStyle(2, 0xffffff);
        this.roundResultContainer.add(yourCardBg);
        
        const yourCardText = this.add.text(-150, 0, myCard.toUpperCase(), {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.roundResultContainer.add(yourCardText);
        
        // Show switch effect if used
        if (myToken === 'switch' && myOriginal) {
            const switchArrow = this.add.text(-150, 60, `(switched from ${myOriginal.toUpperCase()})`, {
                fontSize: '14px',
                color: '#9944ff'
            }).setOrigin(0.5);
            this.roundResultContainer.add(switchArrow);
        }
        
        // VS text
        const vsText = this.add.text(0, 0, 'VS', {
            fontSize: '32px',
            color: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.roundResultContainer.add(vsText);
        
        // Opponent card
        const oppCardLabel = this.add.text(150, -80, 'Opponent played:', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.roundResultContainer.add(oppCardLabel);
        
        const oppCardBg = this.add.rectangle(150, 0, cardSize.width, cardSize.height, 0xff4444, 0.8)
            .setStrokeStyle(2, 0xffffff);
        this.roundResultContainer.add(oppCardBg);
        
        const oppCardText = this.add.text(150, 0, oppCard.toUpperCase(), {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.roundResultContainer.add(oppCardText);
        
        // Show opponent's switch if used
        if (oppToken === 'switch' && oppOriginal) {
            const oppSwitchText = this.add.text(150, 60, `(switched from ${oppOriginal.toUpperCase()})`, {
                fontSize: '14px',
                color: '#9944ff'
            }).setOrigin(0.5);
            this.roundResultContainer.add(oppSwitchText);
        }
        
        // Token usage indicators
        let tokenY = 90;
        if (myToken === 'life') {
            const lifeTokenText = this.add.text(-150, tokenY, '🛡️ Life Token Used', {
                fontSize: '16px',
                color: '#44ff44'
            }).setOrigin(0.5);
            this.roundResultContainer.add(lifeTokenText);
            tokenY += 25;
        }
        
        if (oppToken === 'life') {
            const oppLifeTokenText = this.add.text(150, tokenY, '🛡️ Life Token Used', {
                fontSize: '16px',
                color: '#44ff44'
            }).setOrigin(0.5);
            this.roundResultContainer.add(oppLifeTokenText);
        }
        
        // Result message
        let resultMessage = '';
        let resultColor = '#ffffff';
        
        if (!round.round_winner_id) {
            resultMessage = "It's a TIE!";
            resultColor = '#ffff00';
        } else {
            const playerWon = round.round_winner_id === this.currentUser.user_id;
            
            if (playerWon) {
                resultMessage = '🏆 You WON this round!';
                resultColor = '#00ff00';
            } else {
                if (myToken === 'life') {
                    resultMessage = '🛡️ You lost but were saved by Life token!';
                    resultColor = '#ff9900';
                } else {
                    resultMessage = '❌ You LOST this round!';
                    resultColor = '#ff0000';
                }
            }
        }
        
        const resultText = this.add.text(0, 140, resultMessage, {
            fontSize: '28px',
            color: resultColor,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.roundResultContainer.add(resultText);
        
        // Continue button
        const continueBtn = this.add.rectangle(0, 180, 150, 40, 0x44ff44)
            .setInteractive({ useHandCursor: true });
        const continueBtnText = this.add.text(0, 180, 'Continue', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.roundResultContainer.add([continueBtn, continueBtnText]);
        
        // Button hover effects
        continueBtn.on('pointerover', () => continueBtn.setFillStyle(0x66ff66));
        continueBtn.on('pointerout', () => continueBtn.setFillStyle(0x44ff44));
        
        // Clean up function
        const cleanup = () => {
            if (this.roundResultOverlay) {
                this.roundResultOverlay.destroy();
                this.roundResultOverlay = null;
            }
            if (this.roundResultContainer) {
                this.roundResultContainer.destroy(true);
                this.roundResultContainer = null;
            }
            this.opponentCardText.setText('?');
            this.opponentCardBack.setVisible(true);
        };
        
        // Click to continue
        continueBtn.on('pointerdown', cleanup);
        
        // Auto-continue after 7 seconds
        this.roundResultTimer = this.time.delayedCall(7000, cleanup);
    }
    
    handleGameOver(won) {
        this.gameState = 'gameOver';
        this.statusText.setText(won ? 'You Won!' : 'You Lost!');
        this.statusText.setFontSize('48px');
        this.statusText.setColor(won ? '#00ff00' : '#ff0000');
        
        // Stop polling
        if (this.pollInterval) {
            this.pollInterval.remove();
        }
        
        // Return to lobby after delay
        this.time.delayedCall(5000, () => {
            this.cleanup();
            this.scene.start('Lobby');
        });
    }
    
    async quitGame() {
        if (confirm('Are you sure you want to quit? You will forfeit the game.')) {
            try {
                await fetch('https://cardbreaker.onrender.com/api/game/forfeit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ gameId: this.gameId })
                });
            } catch (error) {
                console.error('Error forfeiting game:', error);
            }
            
            this.cleanup();
            this.scene.start('Lobby');
        }
    }
    
    cleanup() {
        if (this.pollInterval) {
            this.pollInterval.remove();
        }
    }
    
    shutdown() {
        this.cleanup();
    }
}