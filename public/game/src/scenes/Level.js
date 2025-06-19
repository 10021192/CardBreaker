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
        this.opponentLivesContainer = this.add.container(640, 120);
        this.updateLivesDisplay(this.opponentLivesContainer, this.opponentLives);
        
        // Opponent's played card (hidden until reveal)
        this.opponentCardBack = this.add.rectangle(640, 180, 80, 120, 0x444444);
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
        this.playerLivesContainer = this.add.container(640, 510);
        this.updateLivesDisplay(this.playerLivesContainer, this.myLives);
        
        // Card selection area
        this.createCardSelection();
    }
    
    createCardSelection() {
        const cards = ['Attack', 'Counter', 'Shield'];
        const cardColors = { 'Attack': 0xff4444, 'Counter': 0x4444ff, 'Shield': 0x44ff44 };
        
        this.cardButtons = [];
        
        cards.forEach((card, index) => {
            const x = 490 + (index * 150);
            const y = 580;
            
            // Card background
            const cardBg = this.add.rectangle(x, y, 100, 140, cardColors[card])
                .setInteractive({ useHandCursor: true });
            
            // Card text
            const cardText = this.add.text(x, y, card, {
                fontSize: '18px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            // Selection highlight
            const highlight = this.add.rectangle(x, y, 110, 150, 0xffff00, 0)
                .setStrokeStyle(4, 0xffff00, 0);
            
            this.cardButtons.push({ bg: cardBg, text: cardText, highlight, type: card });
            
            // Card selection events
            cardBg.on('pointerover', () => {
                if (this.gameState === 'selecting') {
                    cardBg.setScale(1.1);
                }
            });
            
            cardBg.on('pointerout', () => {
                cardBg.setScale(1);
            });
            
            cardBg.on('pointerdown', () => {
                if (this.gameState === 'selecting') {
                    if (this.selectedToken === 'switch' && this.selectedCard) {
                        // Selecting card to switch to
                        this.selectSwitchCard(card);
                    } else {
                        // Normal card selection
                        this.selectCard(card);
                    }
                }
            });
        });
    }
    
    createTokenSection() {
        // Token area
        this.add.text(100, 300, 'Tokens', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Switch token
        this.switchToken = this.add.circle(70, 350, 30, 0x9944ff)
            .setInteractive({ useHandCursor: true });
        this.add.text(70, 350, 'S', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.switchCooldownText = this.add.text(70, 390, '', {
            fontSize: '14px',
            color: '#ff4444'
        }).setOrigin(0.5);
        
        // Life token
        this.lifeToken = this.add.circle(130, 350, 30, 0xff4499)
            .setInteractive({ useHandCursor: true });
        this.add.text(130, 350, 'L', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
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
        
        // Game status
        this.statusText = this.add.text(640, 360, '', {
            fontSize: '24px',
            color: '#ffff00'
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
    
    updateLivesDisplay(container, lives) {
        container.removeAll(true);
        
        for (let i = 0; i < 3; i++) {
            const x = (i - 1) * 40;
            const heart = this.add.circle(x, 0, 15, i < lives ? 0xff0000 : 0x444444);
            container.add(heart);
        }
    }
    
    selectCard(cardType) {
        if (this.gameState !== 'selecting') return;
        
        this.selectedCard = cardType;
        this.switchToCard = null;
        
        // Update visual selection
        this.cardButtons.forEach(card => {
            if (card.type === cardType) {
                card.highlight.setAlpha(1);
                card.highlight.setStrokeStyle(4, 0xffff00);
            } else {
                card.highlight.setAlpha(0);
            }
        });
        
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
        
        // Update visual - show switch target with different color
        this.cardButtons.forEach(card => {
            if (card.type === this.selectedCard) {
                card.highlight.setAlpha(1);
                card.highlight.setStrokeStyle(4, 0xffff00);
            } else if (card.type === cardType) {
                card.highlight.setAlpha(1);
                card.highlight.setStrokeStyle(4, 0x9944ff); // Purple for switch target
            } else {
                card.highlight.setAlpha(0);
            }
        });
        
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
        
        // Update visual selection
        Object.keys(this.tokenButtons).forEach(type => {
            if (type === this.selectedToken) {
                this.tokenButtons[type].setStrokeStyle(3, 0xffff00);
            } else {
                this.tokenButtons[type].setStrokeStyle(0);
            }
        });
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
            this.statusText.setText('Connection error');
        } finally {
            this.isSubmitting = false;
        }
    }
    
    clearSelections() {
        this.selectedCard = null;
        this.selectedToken = null;
        this.switchToCard = null;
        this.switchHintText.setVisible(false);
        
        this.cardButtons.forEach(card => card.highlight.setAlpha(0));
        Object.values(this.tokenButtons).forEach(token => token.setStrokeStyle(0));
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
            Object.values(this.tokenButtons).forEach(token => token.setStrokeStyle(0));
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
        
        // Determine cards based on role - check if round has player IDs
        const isPlayer1 = round.player1_id ? 
            this.currentUser.user_id === round.player1_id :
            this.yourRole === 'player1';
            
        const myCard = isPlayer1 ? round.player1_card : round.player2_card;
        const oppCard = isPlayer1 ? round.player2_card : round.player1_card;
        const myOriginal = isPlayer1 ? round.player1_original_card : round.player2_original_card;
        const myToken = isPlayer1 ? round.player1_token_effect : round.player2_token_effect;
        
        // Show opponent's card
        this.opponentCardText.setText(oppCard.toUpperCase());
        
        // Build message
        let message = `You played ${myCard.toUpperCase()}`;
        if (myToken === 'switch' && myOriginal) {
            message += ` (switched from ${myOriginal.toUpperCase()})`;
        }
        message += `, opponent played ${oppCard.toUpperCase()}. `;
        
        // Determine winner
        if (!round.round_winner_id) {
            message += "It's a tie!";
        } else {
            const playerWon = round.round_winner_id === this.currentUser.user_id;
            
            if (playerWon) {
                message += 'You won this round!';
            } else {
                message += myToken === 'life' ? 'You lost but saved by Life token!' : 'You lost this round!';
            }
        }
        
        this.statusText.setText(message);
        
        // Reset after delay
        this.time.delayedCall(3000, () => {
            this.opponentCardText.setText('?');
            // Don't change status text here - let updateGameState handle it
        });
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