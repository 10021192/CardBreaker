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

        // Debug: Check what properties currentUser has
        console.log('Current user object:', this.currentUser);
        
        // Background
        this.add.rectangle(640, 360, 1280, 720, 0x1a1a1a);
        
        // Create UI sections
        this.createOpponentSection();
        this.createPlayerSection();
        this.createGameInfo();
        this.createTokenSection();
        this.createActionButtons();
        this.createRoundHistoryPanel();
        
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
        const art = { Attack: "attack_card", Counter: "counter_card", Shield: "shield_card" };
        const cards = Object.keys(art);
        
        this.cardButtons = [];
        this.selectedCardHighlight = null;
        
        cards.forEach((card, index) => {
            const x = 490 + (index * 150);
            const y = 580;
            
            // Create highlight border (hidden by default)
            const highlight = this.add.rectangle(x, y, 110, 150, 0xffff00, 0)
                .setStrokeStyle(3, 0xffff00, 1)
                .setVisible(false);
            
            const img = this.add.image(x, y, art[card])
                    .setDisplaySize(100, 140)
                    .setInteractive({ useHandCursor: true })
                    .setAlpha(0.8); // Slightly dimmed by default
            
            // Store the base scale after setDisplaySize
            const baseScaleX = img.scaleX;
            const baseScaleY = img.scaleY;
            
            // Hover effects
            img.on('pointerover', () => {
                if (this.gameState === 'selecting') {
                    img.setAlpha(1); // Full brightness on hover
                    // Very subtle scale increase
                    img.setScale(baseScaleX * 1.05, baseScaleY * 1.05);
                }
            });
            
            img.on('pointerout', () => {
                if (this.gameState === 'selecting') {
                    img.setAlpha(this.selectedCard === card ? 1 : 0.8);
                    // Return to base scale
                    img.setScale(baseScaleX, baseScaleY);
                }
            });
            
            img.on('pointerdown', () => {
                if (this.gameState !== 'selecting') return;
                
                // Click animation - subtle pulse
                this.tweens.add({
                    targets: img,
                    scaleX: baseScaleX * 0.95,
                    scaleY: baseScaleY * 0.95,
                    duration: 50,
                    yoyo: true,
                    ease: 'Power1'
                });
                
                if (this.selectedToken === 'switch' && this.selectedCard) {
                    this.selectSwitchCard(card);
                } else {
                    this.selectCard(card);
                    
                    // Update selection highlight
                    if (this.selectedCardHighlight) {
                        this.selectedCardHighlight.setVisible(false);
                    }
                    highlight.setVisible(true);
                    this.selectedCardHighlight = highlight;
                    
                    // Update card alphas
                    this.cardButtons.forEach(btn => {
                        btn.img.setAlpha(btn.type === card ? 1 : 0.8);
                    });
                }
            });
            
            this.cardButtons.push({ img, type: card, highlight, baseScaleX, baseScaleY });
        });
    }
    
    createTokenSection() {
        // Token area
        this.add.text(100, 300, 'Tokens', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Token highlights (hidden by default)
        this.switchTokenHighlight = this.add.circle(70, 350, 35, 0xffff00, 0)
            .setStrokeStyle(2, 0xffff00, 1)
            .setVisible(false);
        
        this.lifeTokenHighlight = this.add.circle(130, 350, 35, 0xffff00, 0)
            .setStrokeStyle(2, 0xffff00, 1)
            .setVisible(false);
        
        // Switch token
        this.switchToken = this.add.image(70, 350, "token_switch")
                            .setDisplaySize(60, 60)
                            .setInteractive({ useHandCursor: true })
                            .setAlpha(0.8);
                            
        // Life token
        this.lifeToken = this.add.image(130, 350, "token_life")
                        .setDisplaySize(60, 60)
                        .setInteractive({ useHandCursor: true })
                        .setAlpha(0.8);
        
        // Store base scales
        const switchBaseScale = { x: this.switchToken.scaleX, y: this.switchToken.scaleY };
        const lifeBaseScale = { x: this.lifeToken.scaleX, y: this.lifeToken.scaleY };
        
        // Cooldown texts
        this.switchCooldownText = this.add.text(70, 390, '', {
            fontSize: '14px',
            color: '#ff4444'
        }).setOrigin(0.5);
        
        this.lifeCooldownText = this.add.text(130, 390, '', {
            fontSize: '14px',
            color: '#ff4444'
        }).setOrigin(0.5);
        
        // Token hover effects
        [this.switchToken, this.lifeToken].forEach((token, index) => {
            const tokenType = index === 0 ? 'switch' : 'life';
            const baseScale = index === 0 ? switchBaseScale : lifeBaseScale;
            
            token.on('pointerover', () => {
                if (this.gameState === 'selecting' && this.tokenAvailable) {
                    token.setAlpha(1);
                    // Very subtle scale increase
                    token.setScale(baseScale.x * 1.1, baseScale.y * 1.1);
                }
            });
            
            token.on('pointerout', () => {
                if (this.gameState === 'selecting') {
                    const isSelected = this.selectedToken === tokenType;
                    token.setAlpha(isSelected ? 1 : (this.tokenAvailable ? 0.8 : 0.5));
                    // Return to base scale
                    token.setScale(baseScale.x, baseScale.y);
                }
            });
            
            token.on('pointerdown', () => {
                if (this.gameState === 'selecting' && this.tokenAvailable) {
                    // Click animation - subtle pulse
                    this.tweens.add({
                        targets: token,
                        scaleX: baseScale.x * 0.9,
                        scaleY: baseScale.y * 0.9,
                        duration: 50,
                        yoyo: true,
                        ease: 'Power1'
                    });
                    
                    this.selectToken(tokenType);
                    
                    // Update highlights
                    this.switchTokenHighlight.setVisible(this.selectedToken === 'switch');
                    this.lifeTokenHighlight.setVisible(this.selectedToken === 'life');
                    
                    // Update token alphas
                    this.switchToken.setAlpha(this.selectedToken === 'switch' ? 1 : 0.8);
                    this.lifeToken.setAlpha(this.selectedToken === 'life' ? 1 : 0.8);
                }
            });
        });
        
        this.tokenButtons = { switch: this.switchToken, life: this.lifeToken };
        
        // Switch hint text
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
        
        playButton.on('pointerover', () => {
            playButton.setFillStyle(0x66ff66);
            this.tweens.add({
                targets: playButton,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Power1'
            });
        });
        
        playButton.on('pointerout', () => {
            playButton.setFillStyle(0x44ff44);
            this.tweens.add({
                targets: playButton,
                scaleX: 1,
                scaleY: 1,
                duration: 100,
                ease: 'Power1'
            });
        });
        
        playButton.on('pointerdown', () => {
            this.tweens.add({
                targets: [playButton, playText],
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 50,
                yoyo: true,
                ease: 'Power1',
                onComplete: () => this.playCard()
            });
        });
        
        // Quit game button
        const quitButton = this.add.rectangle(1100, 600, 150, 40, 0xff4444)
            .setInteractive({ useHandCursor: true });
        const quitText = this.add.text(1100, 600, 'Quit Game', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        quitButton.on('pointerover', () => {
            quitButton.setFillStyle(0xff6666);
            this.tweens.add({
                targets: quitButton,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Power1'
            });
        });
        
        quitButton.on('pointerout', () => {
            quitButton.setFillStyle(0xff4444);
            this.tweens.add({
                targets: quitButton,
                scaleX: 1,
                scaleY: 1,
                duration: 100,
                ease: 'Power1'
            });
        });
        
        quitButton.on('pointerdown', () => {
            this.tweens.add({
                targets: [quitButton, quitText],
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 50,
                yoyo: true,
                ease: 'Power1',
                onComplete: () => this.quitGame()
            });
        });
    }

    createRoundHistoryPanel() {
        // Round history panel on the right side
        this.add.rectangle(1100, 200, 300, 350, 0x2a2a2a, 0.8)
            .setStrokeStyle(2, 0x444444);
        
        // Panel title
        this.add.text(1100, 50, 'Round History', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Container for round entries
        this.roundHistoryContainer = this.add.container(1100, 100);
        
        // Store round history entries
        this.roundHistoryEntries = [];
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
        
        // Clear visual selections
        if (this.selectedCardHighlight) {
            this.selectedCardHighlight.setVisible(false);
        }
        this.switchTokenHighlight.setVisible(false);
        this.lifeTokenHighlight.setVisible(false);
        
        // Reset alphas and scales
        this.cardButtons.forEach(btn => {
            btn.img.setAlpha(0.8);
            btn.img.setScale(btn.baseScaleX, btn.baseScaleY);
        });
        if (this.tokenAvailable) {
            this.switchToken.setAlpha(0.8);
            this.lifeToken.setAlpha(0.8);
        }
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

        // IMPORTANT: Store the actual player IDs from the game
        // These are needed for proper winner determination
        if (!this.gamePlayerIds) {
            this.gamePlayerIds = {
                player1: game.yourRole === 'player1' ? this.currentUser.user_id : null,
                player2: game.yourRole === 'player2' ? this.currentUser.user_id : null
            };
        }
        
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

        // Check if we need to fetch results for a previous round
        if (game.currentRound > this.lastRoundNumber && this.lastRoundNumber > 0) {
            // New round started, fetch the previous round's result
            this.fetchSpecificRoundResult(this.lastRoundNumber);
        }
        
        // Update last round number
        this.lastRoundNumber = game.currentRound;
        
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
        const alpha = this.tokenAvailable ? 0.8 : 0.5;
        this.switchToken.setAlpha(alpha);
        this.lifeToken.setAlpha(alpha);
        
        // Disable interaction when on cooldown
        if (this.tokenAvailable) {
            this.switchToken.setInteractive();
            this.lifeToken.setInteractive();
        } else {
            this.switchToken.disableInteractive();
            this.lifeToken.disableInteractive();
        }
        
        // Clear token selection if on cooldown
        if (!this.tokenAvailable && this.selectedToken) {
            this.selectedToken = null;
            this.switchToCard = null;
            this.switchHintText.setVisible(false);
            this.switchTokenHighlight.setVisible(false);
            this.lifeTokenHighlight.setVisible(false);
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
    
    async fetchSpecificRoundResult(roundNumber) {
        try {
            const response = await fetch(`https://cardbreaker.onrender.com/api/game/${this.gameId}/history`, {
                credentials: 'include'
            });
            
            const rounds = await response.json();
            
            if (response.ok && rounds.length > 0) {
                // Find the specific round
                const targetRound = rounds.find(r => r.round_number === roundNumber);
                if (targetRound && !this.roundHistoryEntries.some(e => e.roundNumber === roundNumber)) {
                    // Process this round if we haven't already
                    this.processHistoryRound(targetRound);
                }
            }
        } catch (error) {
            console.error('Error fetching specific round result:', error);
        }
    }

    processHistoryRound(round) {
        // Determine cards based on role
        const isPlayer1 = this.yourRole === 'player1';
        
        const myCard = isPlayer1 ? round.player1_card : round.player2_card;
        const oppCard = isPlayer1 ? round.player2_card : round.player1_card;
        const myOriginal = isPlayer1 ? round.player1_original_card : round.player2_original_card;
        const oppOriginal = isPlayer1 ? round.player2_original_card : round.player1_original_card;
        const myToken = isPlayer1 ? round.player1_token_effect : round.player2_token_effect;
        const oppToken = isPlayer1 ? round.player2_token_effect : round.player1_token_effect;
        
        // Determine if player won
        let iWon = false;
        if (round.round_winner_id && round.player1_id && round.player2_id) {
            const myId = isPlayer1 ? round.player1_id : round.player2_id;
            iWon = (round.round_winner_id == myId);
        }
        
        // Add to round history only
        this.addRoundToHistory(round.round_number, {
            myCard,
            oppCard,
            myOriginal,
            oppOriginal,
            myToken,
            oppToken,
            winner: round.round_winner_id,
            iWon: iWon,
            roundNumber: round.round_number // Store this to prevent duplicates
        });
    }

    handleRoundResult(round) {
        this.gameState = 'revealing';
        this.roundResultShown = true;
        
        // Handle both data structures from playCard response and fetchRoundResult
        let roundData;
        if (round.player1Card !== undefined) {
            // This is from playCard response with camelCase fields
            roundData = {
                round_number: this.currentRound,
                player1_card: round.player1Card,
                player2_card: round.player2Card,
                player1_original_card: round.player1OriginalCard,
                player2_original_card: round.player2OriginalCard,
                player1_token_effect: round.player1TokenUsed,
                player2_token_effect: round.player2TokenUsed,
                round_winner_id: round.roundWinner,
                player1_id: round.player1Id,
                player2_id: round.player2Id
            };
        } else {
            // This is from fetchRoundResult with snake_case fields
            roundData = round;
        }
        
        // Determine cards based on role - use yourRole which is always set
        const isPlayer1 = this.yourRole === 'player1';
        
        const myCard = isPlayer1 ? roundData.player1_card : roundData.player2_card;
        const oppCard = isPlayer1 ? roundData.player2_card : roundData.player1_card;
        const myOriginal = isPlayer1 ? roundData.player1_original_card : roundData.player2_original_card;
        const oppOriginal = isPlayer1 ? roundData.player2_original_card : roundData.player1_original_card;
        const myToken = isPlayer1 ? roundData.player1_token_effect : roundData.player2_token_effect;
        const oppToken = isPlayer1 ? roundData.player2_token_effect : roundData.player1_token_effect;

        // Safety check
        if (!myCard || !oppCard) {
            console.error('Round result missing card data:', roundData);
            return;
        }
        
        // Show opponent's card
        this.opponentCardText.setText(oppCard.toUpperCase());

        // IMPORTANT: Determine if player won based on the winner_id and role
        let iWon = false;
        if (roundData.round_winner_id) {
            // If player IDs are available in the round data, use them
            if (roundData.player1_id && roundData.player2_id) {
                const myId = isPlayer1 ? roundData.player1_id : roundData.player2_id;
                iWon = (roundData.round_winner_id == myId);
            } else {
                // Fallback: assume winner_id matches the role
                // This is less reliable but might work if the server is consistent
                // We'll need to verify this with the actual data
                console.warn('No player IDs in round data, using role-based assumption');
                iWon = false; // Can't determine without IDs
            }
        }
        
        this.addRoundToHistory(roundData.round_number || this.currentRound, {
            myCard,
            oppCard,
            myOriginal,
            oppOriginal,
            myToken,
            oppToken,
            winner: roundData.round_winner_id,
            isPlayer1: isPlayer1, // Pass role explicitly
            roundNumber: roundData.round_number || this.currentRound
        });
        
        // Build status message
        let message = `Round ${roundData.round_number || this.currentRound} Complete!\n`;
        message += `You: ${myCard.toUpperCase()}`;
        if (myToken === 'switch' && myOriginal) {
            message += ` (was ${myOriginal.toUpperCase()})`;
        }
        if (myToken === 'life') {
            message += ' [LIFE]';
        }
        message += `\nOpponent: ${oppCard.toUpperCase()}`;
        if (oppToken === 'switch' && oppOriginal) {
            message += ` (was ${oppOriginal.toUpperCase()})`;
        }
        if (oppToken === 'life') {
            message += ' [LIFE]';
        }
        message += '\n';
        
        // Result message
        if (!roundData.round_winner_id) {
            message += "TIE!";
        } else if (iWon) {
            message += 'You WON!';
        } else {
            message += myToken === 'life' ? 'You lost (saved by Life token)' : 'You LOST!';
        }
        
        this.statusText.setText(message);
        
        // Reset after delay
        this.time.delayedCall(4000, () => {
            this.opponentCardText.setText('?');
            this.statusText.setText('');
        });
    }

    addRoundToHistory(roundNumber, data) {
        // Check if this round is already in history
        if (this.roundHistoryEntries.some(e => e.roundNumber === roundNumber)) {
            return; // Already added
        }
        
        // Create entry container
        const entryY = this.roundHistoryEntries.length * 60;
        const entry = this.add.container(0, entryY);
        entry.roundNumber = roundNumber; // Store round number for duplicate check
        
        // Round number
        const roundLabel = this.add.text(-130, 0, `R${roundNumber}:`, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        entry.add(roundLabel);
        
        // Cards played - use first letter of card
        let cardsText = `${data.myCard.charAt(0).toUpperCase()}`;
        if (data.myToken === 'switch' && data.myOriginal) {
            cardsText += '→' + data.myOriginal.charAt(0).toUpperCase();
        }
        if (data.myToken === 'life') cardsText += '♥';
        
        cardsText += ' vs ';
        
        cardsText += `${data.oppCard.charAt(0).toUpperCase()}`;
        if (data.oppToken === 'switch' && data.oppOriginal) {
            cardsText += '→' + data.oppOriginal.charAt(0).toUpperCase();
        }
        if (data.oppToken === 'life') cardsText += '♥';
        
        const cardsLabel = this.add.text(-80, 0, cardsText, {
            fontSize: '14px',
            color: '#cccccc'
        }).setOrigin(0, 0.5);
        entry.add(cardsLabel);
        
        let resultText = '';
        let resultColor = '#ffff00';
        
        if (!data.winner) {
            resultText = 'TIE';
        } else if (data.iWon !== undefined) {
            // Use the pre-determined result
            if (data.iWon) {
                resultText = 'WIN';
                resultColor = '#00ff00';
            } else {
                resultText = 'LOSS';
                resultColor = '#ff4444';
            }
        } else {
            // No way to determine
            resultText = '?';
            resultColor = '#888888';
        }
        
        const resultLabel = this.add.text(80, 0, resultText, {
            fontSize: '14px',
            color: resultColor,
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        entry.add(resultLabel);
        
        // Add to container and array
        this.roundHistoryContainer.add(entry);
        this.roundHistoryEntries.push(entry);
        
        // Scroll if too many entries (show last 5)
        if (this.roundHistoryEntries.length > 5) {
            this.roundHistoryContainer.y = 100 - ((this.roundHistoryEntries.length - 5) * 60);
        }
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