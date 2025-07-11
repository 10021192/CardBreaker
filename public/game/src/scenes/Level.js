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
        
        // Add to round history only
        this.addRoundToHistory(round.round_number, {
            myCard,
            oppCard,
            myOriginal,
            oppOriginal,
            myToken,
            oppToken,
            winner: round.round_winner_id,
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
        
        // Get my player ID based on role
        const myPlayerId = isPlayer1 ? 
            (roundData.player1_id || this.currentUser.user_id) : 
            (roundData.player2_id || this.currentUser.user_id);
        
        // Safety check
        if (!myCard || !oppCard) {
            console.error('Round result missing card data:', roundData);
            return;
        }
        
        // Show opponent's card
        this.opponentCardText.setText(oppCard.toUpperCase());
        
        // Add to round history with fixed winner determination
        this.addRoundToHistory(roundData.round_number || this.currentRound, {
            myCard,
            oppCard,
            myOriginal,
            oppOriginal,
            myToken,
            oppToken,
            winner: roundData.round_winner_id,
            myPlayerId: myPlayerId,
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
        
        if (!roundData.round_winner_id) {
            message += "TIE!";
        } else {
            // Compare winner_id with the appropriate player ID
            const playerWon = roundData.round_winner_id === myPlayerId;
            if (playerWon) {
                message += 'You WON!';
            } else {
                message += myToken === 'life' ? 'You lost (saved by Life token)' : 'You LOST!';
            }
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
        } else {
            // Use the player ID we determined in handleRoundResult
            const playerWon = data.winner === (data.myPlayerId || this.currentUser.user_id);
            if (playerWon) {
                resultText = 'WIN';
                resultColor = '#00ff00';
            } else {
                resultText = 'LOSS';
                resultColor = '#ff4444';
            }
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