const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Get active games for current user
router.get('/games/active', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    db.query(
        `SELECT 
            g.game_id,
            g.current_round,
            g.player1_lives,
            g.player2_lives,
            g.created_at,
            u1.username AS player1_name,
            u2.username AS player2_name,
            CASE 
                WHEN g.player1_id = ? THEN 'player1'
                ELSE 'player2'
            END AS your_role
         FROM games g
         JOIN users u1 ON g.player1_id = u1.user_id
         JOIN users u2 ON g.player2_id = u2.user_id
         WHERE (g.player1_id = ? OR g.player2_id = ?)
         AND g.status = 'active'`,
        [userId, userId, userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(results);
        }
    );
});

// Forfeit a game (for testing purposes)
router.post('/game/forfeit', requireAuth, (req, res) => {
    const { gameId } = req.body;
    const userId = req.session.userId;
    
    if (!gameId) {
        return res.status(400).json({ error: 'Game ID required' });
    }
    
    // Verify user is in this game
    db.query(
        `SELECT player1_id, player2_id 
         FROM games 
         WHERE game_id = ? 
         AND (player1_id = ? OR player2_id = ?)
         AND status = 'active'`,
        [gameId, userId, userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ error: 'Game not found or you are not a player' });
            }
            
            const game = results[0];
            // Determine winner (the other player)
            const winnerId = game.player1_id === userId ? game.player2_id : game.player1_id;
            
            // Update game status
            db.query(
                `UPDATE games 
                 SET status = 'completed', 
                     winner_id = ?,
                     player1_lives = CASE WHEN player1_id = ? THEN 0 ELSE player1_lives END,
                     player2_lives = CASE WHEN player2_id = ? THEN 0 ELSE player2_lives END
                 WHERE game_id = ?`,
                [winnerId, userId, userId, gameId],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to forfeit game' });
                    }
                    
                    res.json({ 
                        message: 'Game forfeited. You lose!',
                        winnerId: winnerId
                    });
                }
            );
        }
    );
});

// Get current game state
router.get('/game/:gameId', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const gameId = req.params.gameId;
    const userId = req.session.userId;
    
    // Get game info with player names
    db.query(
        `SELECT 
            g.*,
            u1.username AS player1_name,
            u2.username AS player2_name,
            CASE 
                WHEN g.player1_id = ? THEN 'player1'
                ELSE 'player2'
            END AS your_role
         FROM games g
         JOIN users u1 ON g.player1_id = u1.user_id
         JOIN users u2 ON g.player2_id = u2.user_id
         WHERE g.game_id = ?
         AND (g.player1_id = ? OR g.player2_id = ?)`,
        [userId, gameId, userId, userId],
        (err, gameResults) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (gameResults.length === 0) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            const game = gameResults[0];
            
            // Get current round info
            db.query(
                `SELECT * FROM rounds 
                 WHERE game_id = ? AND round_number = ?`,
                [gameId, game.current_round],
                (err, roundResults) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    // Get token cooldown info
                    db.query(
                        `SELECT player_id, last_used_round 
                         FROM token_cooldowns 
                         WHERE game_id = ?`,
                        [gameId],
                        (err, cooldownResults) => {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }
                            
                            // Calculate if tokens are available
                            const cooldowns = {};
                            cooldownResults.forEach(cd => {
                                const roundsSinceUse = cd.last_used_round === 0 ? 999 : game.current_round - cd.last_used_round;
                                cooldowns[cd.player_id] = {
                                    available: roundsSinceUse > 2,
                                    roundsUntilAvailable: Math.max(0, 3 - roundsSinceUse)
                                };
                            });
                            
                            // Prepare response
                            const currentRound = roundResults[0] || null;
                            const isYourTurn = currentRound ? 
                                (game.your_role === 'player1' && !currentRound.player1_card) ||
                                (game.your_role === 'player2' && !currentRound.player2_card) : true;
                            
                            res.json({
                                game: {
                                    id: game.game_id,
                                    status: game.status,
                                    currentRound: game.current_round,
                                    yourRole: game.your_role,
                                    yourLives: game.your_role === 'player1' ? game.player1_lives : game.player2_lives,
                                    opponentLives: game.your_role === 'player1' ? game.player2_lives : game.player1_lives,
                                    player1Name: game.player1_name,
                                    player2Name: game.player2_name
                                },
                                currentRound: currentRound ? {
                                    hasPlayed: game.your_role === 'player1' ? !!currentRound.player1_card : !!currentRound.player2_card,
                                    bothPlayed: !!(currentRound.player1_card && currentRound.player2_card),
                                    isYourTurn: isYourTurn
                                } : { hasPlayed: false, bothPlayed: false, isYourTurn: true },
                                token: cooldowns[userId] || { available: true, roundsUntilAvailable: 0 }
                            });
                        }
                    );
                }
            );
        }
    );
});

// Play a card
router.post('/game/:gameId/play-card', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const gameId = req.params.gameId;
    const userId = req.session.userId;
    const { card, useToken, tokenEffect, switchToCard } = req.body;
    
    // Validate card
    if (!['attack', 'shield', 'counter'].includes(card)) {
        return res.status(400).json({ error: 'Invalid card' });
    }
    
    // Validate token usage
    if (useToken && !['switch', 'life'].includes(tokenEffect)) {
        return res.status(400).json({ error: 'Invalid token effect' });
    }
    
    // If using switch token, validate the new card choice
    if (tokenEffect === 'switch' && !['attack', 'shield', 'counter'].includes(switchToCard)) {
        return res.status(400).json({ error: 'Invalid switch card choice' });
    }
    
    // Get game info
    db.query(
        `SELECT * FROM games 
         WHERE game_id = ? 
         AND (player1_id = ? OR player2_id = ?)
         AND status = 'active'`,
        [gameId, userId, userId],
        (err, gameResults) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (gameResults.length === 0) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            const game = gameResults[0];
            const isPlayer1 = game.player1_id === userId;
            const playerColumn = isPlayer1 ? 'player1_card' : 'player2_card';
            const tokenColumn = isPlayer1 ? 'player1_token_used' : 'player2_token_used';
            const tokenEffectColumn = isPlayer1 ? 'player1_token_effect' : 'player2_token_effect';
            const originalCardColumn = isPlayer1 ? 'player1_original_card' : 'player2_original_card';
            
            // Check token availability if trying to use it
            if (useToken) {
                db.query(
                    `SELECT last_used_round FROM token_cooldowns 
                     WHERE game_id = ? AND player_id = ?`,
                    [gameId, userId],
                    (err, cooldownResults) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }
                        
                        const lastUsed = cooldownResults[0]?.last_used_round || 0;
                        const roundsSinceUse = lastUsed === 0 ? 999 : game.current_round - lastUsed;
                        if (roundsSinceUse <= 2) {
                            return res.status(400).json({ error: 'Token is on cooldown' });
                        }
                        
                        // Continue with play
                        playCard();
                    }
                );
            } else {
                playCard();
            }
            
            function playCard() {
                // Determine final card (switched if using switch token)
                const finalCard = (tokenEffect === 'switch') ? switchToCard : card;
                
                // Check if round exists, if not create it
                db.query(
                    `INSERT INTO rounds (game_id, round_number, ${playerColumn}, ${tokenColumn}, ${tokenEffectColumn}, ${originalCardColumn})
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                     ${playerColumn} = VALUES(${playerColumn}),
                     ${tokenColumn} = VALUES(${tokenColumn}),
                     ${tokenEffectColumn} = VALUES(${tokenEffectColumn}),
                     ${originalCardColumn} = VALUES(${originalCardColumn})`,
                    [gameId, game.current_round, finalCard, useToken, useToken ? tokenEffect : null, 
                     tokenEffect === 'switch' ? card : null],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to play card' });
                        }
                        
                        // Update token cooldown if used
                        if (useToken) {
                            db.query(
                                `UPDATE token_cooldowns 
                                 SET last_used_round = ? 
                                 WHERE game_id = ? AND player_id = ?`,
                                [game.current_round, gameId, userId]
                            );
                        }
                        
                        // Check if both players have played
                        db.query(
                            `SELECT * FROM rounds 
                             WHERE game_id = ? AND round_number = ?`,
                            [gameId, game.current_round],
                            (err, roundResults) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Database error' });
                                }
                                
                                const round = roundResults[0];
                                if (round.player1_card && round.player2_card) {
                                    // Both played, resolve round
                                    resolveRound(game, round);
                                } else {
                                    res.json({ 
                                        message: 'Card played successfully',
                                        waitingForOpponent: true 
                                    });
                                }
                            }
                        );
                    }
                );
            }
            
            function resolveRound(game, round) {
                // Cards are already final (switch already applied)
                const player1Card = round.player1_card;
                const player2Card = round.player2_card;
                
                // Determine winner
                let roundWinnerId = null;
                let player1LoseLife = false;
                let player2LoseLife = false;
                
                if (player1Card === player2Card) {
                    // Tie - no one loses life
                } else if (
                    (player1Card === 'attack' && player2Card === 'counter') ||
                    (player1Card === 'counter' && player2Card === 'shield') ||
                    (player1Card === 'shield' && player2Card === 'attack')
                ) {
                    // Player 1 wins
                    roundWinnerId = game.player1_id;
                    player2LoseLife = true;
                } else {
                    // Player 2 wins
                    roundWinnerId = game.player2_id;
                    player1LoseLife = true;
                }
                
                // Apply life tokens
                if (round.player1_token_effect === 'life' && player1LoseLife) {
                    player1LoseLife = false; // Negate life loss
                }
                if (round.player2_token_effect === 'life' && player2LoseLife) {
                    player2LoseLife = false; // Negate life loss
                }
                
                // Update round winner
                db.query(
                    `UPDATE rounds SET round_winner_id = ? WHERE round_id = ?`,
                    [roundWinnerId, round.round_id]
                );
                
                // Calculate new lives
                let newPlayer1Lives = game.player1_lives - (player1LoseLife ? 1 : 0);
                let newPlayer2Lives = game.player2_lives - (player2LoseLife ? 1 : 0);
                
                // Check for game over
                const gameOver = newPlayer1Lives <= 0 || newPlayer2Lives <= 0;
                const gameWinnerId = newPlayer1Lives <= 0 ? game.player2_id : 
                                   newPlayer2Lives <= 0 ? game.player1_id : null;
                
                // Update game state
                db.query(
                    `UPDATE games 
                     SET player1_lives = ?, 
                         player2_lives = ?, 
                         current_round = ?,
                         status = ?,
                         winner_id = ?
                     WHERE game_id = ?`,
                    [
                        newPlayer1Lives, 
                        newPlayer2Lives, 
                        gameOver ? game.current_round : game.current_round + 1,
                        gameOver ? 'completed' : 'active',
                        gameWinnerId,
                        gameId
                    ],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to update game' });
                        }
                        
                        res.json({
                            message: 'Round resolved',
                            roundResult: {
                                player1Card: player1Card,
                                player2Card: player2Card,
                                player1OriginalCard: round.player1_original_card,
                                player2OriginalCard: round.player2_original_card,
                                player1TokenUsed: round.player1_token_effect,
                                player2TokenUsed: round.player2_token_effect,
                                roundWinner: roundWinnerId,
                                player1Lives: newPlayer1Lives,
                                player2Lives: newPlayer2Lives,
                                gameOver: gameOver,
                                gameWinner: gameWinnerId
                            }
                        });
                    }
                );
            }
        }
    );
});

// Get round history
router.get('/game/:gameId/history', requireAuth, (req, res) => {
    const gameId = req.params.gameId;
    const userId = req.session.userId;
    
    // Verify user is in this game and get player IDs
    db.query(
        `SELECT player1_id, player2_id FROM games 
         WHERE game_id = ? 
         AND (player1_id = ? OR player2_id = ?)`,
        [gameId, userId, userId],
        (err, gameResults) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (gameResults.length === 0) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            const game = gameResults[0];
            
            // Get all completed rounds
            db.query(
                `SELECT 
                    r.*,
                    u.username AS winner_name,
                    ? AS player1_id,
                    ? AS player2_id
                 FROM rounds r
                 LEFT JOIN users u ON r.round_winner_id = u.user_id
                 WHERE r.game_id = ? 
                 AND r.player1_card IS NOT NULL 
                 AND r.player2_card IS NOT NULL
                 ORDER BY r.round_number`,
                [game.player1_id, game.player2_id, gameId],
                (err, rounds) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    res.json(rounds);
                }
            );
        }
    );
});

module.exports = router;