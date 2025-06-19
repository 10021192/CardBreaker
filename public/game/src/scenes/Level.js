class Level extends Phaser.Scene {
    constructor() {
        super("Level");
        
        // Game state
        this.gameId = null;
        this.currentRound = 0;
        this.myLives = 3;
        this.opponentLives = 3;
        this.selectedCard = null;
        this.selectedToken = null;
        this.tokenCooldown = { switch: 0, life: 0 };
        this.isMyTurn = true;
        this.gameState = 'selecting'; // selecting, waiting, revealing, gameOver
        this.pollInterval = null;
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
        
        // Player lives
        this.playerLivesContainer = this.add.container(640, 520);
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
            
            // Card background (will be replaced with image)
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
                    this.selectCard(card);
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
        const switchToken = this.add.circle(70, 350, 30, 0x9944ff)
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
        const lifeToken = this.add.circle(130, 350, 30, 0xff4499)
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
        switchToken.on('pointerdown', () => this.selectToken('switch'));
        lifeToken.on('pointerdown', () => this.selectToken('life'));
        
        this.tokenButtons = { switch: switchToken, life: lifeToken };
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
        
        // Update visual selection
        this.cardButtons.forEach(card => {
            if (card.type === cardType) {
                card.highlight.setAlpha(1);
            } else {
                card.highlight.setAlpha(0);
            }
        });
        
        this.statusText.setText(`Selected: ${cardType}`);
    }
    
    selectToken(tokenType) {
        if (this.gameState !== 'selecting') return;
        if (this.tokenCooldown[tokenType] > 0) {
            this.statusText.setText(`${tokenType} token on cooldown!`);
            return;
        }
        
        this.selectedToken = this.selectedToken === tokenType ? null : tokenType;
        
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
        
        if (this.gameState !== 'selecting') return;
        
        try {
            const response = await fetch(`https://cardbreaker.onrender.com/api/game/${this.gameId}/play-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    card: this.selectedCard.toLowerCase(),
                    use_token: this.selectedToken
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.gameState = 'waiting';
                this.statusText.setText('Waiting for opponent...');
                this.clearSelections();
            } else {
                this.statusText.setText(data.error || 'Failed to play card');
            }
        } catch (error) {
            console.error('Error playing card:', error);
            this.statusText.setText('Connection error');
        }
    }
    
    clearSelections() {
        this.selectedCard = null;
        this.selectedToken = null;
        
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
        // Update lives
        const isPlayer1 = data.player1_id === this.currentUser.user_id;
        this.myLives = isPlayer1 ? data.player1_lives : data.player2_lives;
        this.opponentLives = isPlayer1 ? data.player2_lives : data.player1_lives;
        
        this.updateLivesDisplay(this.playerLivesContainer, this.myLives);
        this.updateLivesDisplay(this.opponentLivesContainer, this.opponentLives);
        
        // Update opponent name
        this.opponentNameText.setText(isPlayer1 ? data.player2_name : data.player1_name);
        
        // Update round
        this.currentRound = data.current_round || 1;
        this.roundText.setText(`Round ${this.currentRound}`);
        
        // Check for round results
        if (data.last_round_result) {
            this.showRoundResult(data.last_round_result);
        }
        
        // Update token cooldowns
        if (data.token_cooldowns) {
            const myCooldowns = isPlayer1 ? data.token_cooldowns.player1 : data.token_cooldowns.player2;
            this.tokenCooldown = myCooldowns || { switch: 0, life: 0 };
            this.updateTokenCooldowns();
        }
        
        // Check game over
        if (data.status === 'completed') {
            this.handleGameOver(data.winner_id === this.currentUser.user_id);
        } else {
            // Update game state
            const myCard = isPlayer1 ? data.player1_current_card : data.player2_current_card;
            const oppCard = isPlayer1 ? data.player2_current_card : data.player1_current_card;
            
            if (myCard && oppCard) {
                this.gameState = 'revealing';
            } else if (myCard) {
                this.gameState = 'waiting';
                this.statusText.setText('Waiting for opponent...');
            } else {
                this.gameState = 'selecting';
                this.statusText.setText('Select your card');
            }
        }
    }
    
    updateTokenCooldowns() {
        this.switchCooldownText.setText(this.tokenCooldown.switch > 0 ? `CD: ${this.tokenCooldown.switch}` : '');
        this.lifeCooldownText.setText(this.tokenCooldown.life > 0 ? `CD: ${this.tokenCooldown.life}` : '');
        
        // Update token interactivity
        this.tokenButtons.switch.setAlpha(this.tokenCooldown.switch > 0 ? 0.5 : 1);
        this.tokenButtons.life.setAlpha(this.tokenCooldown.life > 0 ? 0.5 : 1);
    }
    
    showRoundResult(result) {
        // Show opponent's card
        this.opponentCardText.setText(result.opponent_card);
        
        // Show result message
        let message = `You played ${result.your_card}, opponent played ${result.opponent_card}. `;
        if (result.winner === 'player') {
            message += 'You won this round!';
        } else if (result.winner === 'opponent') {
            message += 'You lost this round!';
        } else {
            message += "It's a tie!";
        }
        
        this.statusText.setText(message);
        
        // Reset after delay
        this.time.delayedCall(3000, () => {
            this.opponentCardText.setText('?');
            this.gameState = 'selecting';
            this.clearSelections();
        });
    }
    
    handleGameOver(won) {
        this.gameState = 'gameOver';
        this.statusText.setText(won ? 'You Won!' : 'You Lost!');
        this.statusText.setFontSize('48px');
        this.statusText.setColor(won ? '#00ff00' : '#ff0000');
        
        // Return to lobby after delay
        this.time.delayedCall(5000, () => {
            this.cleanup();
            this.scene.start('Lobby');
        });
    }
    
    async quitGame() {
        // In a real implementation, you might want to forfeit the game
        this.cleanup();
        this.scene.start('Lobby');
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