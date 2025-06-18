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

// Send a challenge
router.post('/challenge/send', requireAuth, (req, res) => {
    const { challengedId } = req.body;
    const challengerId = req.session.userId;
    
    if (!challengedId) {
        return res.status(400).json({ error: 'Challenged user ID required' });
    }
    
    if (challengerId === challengedId) {
        return res.status(400).json({ error: 'Cannot challenge yourself' });
    }
    
    // Check if challenged user exists and is online
    db.query(
        'SELECT username, is_online FROM users WHERE user_id = ?',
        [challengedId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            if (!results[0].is_online) {
                return res.status(400).json({ error: 'User is not online' });
            }
            
            // Check for existing pending challenge between these users
            db.query(
                `SELECT challenge_id FROM challenges 
                 WHERE status = 'pending' 
                 AND expires_at > NOW()
                 AND ((challenger_id = ? AND challenged_id = ?) 
                      OR (challenger_id = ? AND challenged_id = ?))`,
                [challengerId, challengedId, challengedId, challengerId],
                (err, existingChallenges) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    if (existingChallenges.length > 0) {
                        return res.status(400).json({ error: 'A challenge already exists between these players' });
                    }
                    
                    // Create the challenge
                    db.query(
                        'INSERT INTO challenges (challenger_id, challenged_id) VALUES (?, ?)',
                        [challengerId, challengedId],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to create challenge' });
                            }
                            
                            res.json({ 
                                message: 'Challenge sent successfully',
                                challengeId: result.insertId
                            });
                        }
                    );
                }
            );
        }
    );
});

// Get pending challenges for the current user
router.get('/challenge/pending', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    // Get challenges where user is either challenger or challenged
    db.query(
        `SELECT 
            c.challenge_id,
            c.challenger_id,
            c.challenged_id,
            c.status,
            c.created_at,
            c.expires_at,
            u1.username AS challenger_name,
            u2.username AS challenged_name
         FROM challenges c
         JOIN users u1 ON c.challenger_id = u1.user_id
         JOIN users u2 ON c.challenged_id = u2.user_id
         WHERE (c.challenger_id = ? OR c.challenged_id = ?)
         AND c.status = 'pending'
         AND c.expires_at > NOW()
         ORDER BY c.created_at DESC`,
        [userId, userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Separate sent and received challenges
            const sentChallenges = results.filter(c => c.challenger_id === userId);
            const receivedChallenges = results.filter(c => c.challenged_id === userId);
            
            res.json({
                sent: sentChallenges,
                received: receivedChallenges
            });
        }
    );
});

// Accept a challenge
router.post('/challenge/accept', requireAuth, (req, res) => {
    const { challengeId } = req.body;
    const userId = req.session.userId;
    
    if (!challengeId) {
        return res.status(400).json({ error: 'Challenge ID required' });
    }
    
    // Verify user is the challenged player and challenge is still pending
    db.query(
        `SELECT * FROM challenges 
         WHERE challenge_id = ? 
         AND challenged_id = ? 
         AND status = 'pending'
         AND expires_at > NOW()`,
        [challengeId, userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ error: 'Challenge not found or expired' });
            }
            
            const challenge = results[0];
            
            // Start a transaction to update challenge and create game
            db.beginTransaction((err) => {
                if (err) {
                    return res.status(500).json({ error: 'Transaction error' });
                }
                
                // Update challenge status
                db.query(
                    'UPDATE challenges SET status = "accepted" WHERE challenge_id = ?',
                    [challengeId],
                    (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: 'Failed to update challenge' });
                            });
                        }
                        
                        // Create the game
                        db.query(
                            `INSERT INTO games (challenge_id, player1_id, player2_id) 
                             VALUES (?, ?, ?)`,
                            [challengeId, challenge.challenger_id, challenge.challenged_id],
                            (err, result) => {
                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).json({ error: 'Failed to create game' });
                                    });
                                }
                                
                                const gameId = result.insertId;
                                
                                // Initialize token cooldowns for both players
                                db.query(
                                    `INSERT INTO token_cooldowns (game_id, player_id, last_used_round) 
                                     VALUES (?, ?, 0), (?, ?, 0)`,
                                    [gameId, challenge.challenger_id, gameId, challenge.challenged_id],
                                    (err) => {
                                        if (err) {
                                            return db.rollback(() => {
                                                res.status(500).json({ error: 'Failed to initialize game' });
                                            });
                                        }
                                        
                                        // Commit the transaction
                                        db.commit((err) => {
                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({ error: 'Transaction commit failed' });
                                                });
                                            }
                                            
                                            res.json({
                                                message: 'Challenge accepted, game created!',
                                                gameId: gameId
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        }
    );
});

// Decline a challenge
router.post('/challenge/decline', requireAuth, (req, res) => {
    const { challengeId } = req.body;
    const userId = req.session.userId;
    
    if (!challengeId) {
        return res.status(400).json({ error: 'Challenge ID required' });
    }
    
    // Verify user is the challenged player
    db.query(
        `UPDATE challenges 
         SET status = 'declined' 
         WHERE challenge_id = ? 
         AND challenged_id = ? 
         AND status = 'pending'`,
        [challengeId, userId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Challenge not found' });
            }
            
            res.json({ message: 'Challenge declined' });
        }
    );
});

// Cancel a sent challenge
router.post('/challenge/cancel', requireAuth, (req, res) => {
    const { challengeId } = req.body;
    const userId = req.session.userId;
    
    if (!challengeId) {
        return res.status(400).json({ error: 'Challenge ID required' });
    }
    
    // Verify user is the challenger
    db.query(
        `UPDATE challenges 
         SET status = 'expired' 
         WHERE challenge_id = ? 
         AND challenger_id = ? 
         AND status = 'pending'`,
        [challengeId, userId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Challenge not found' });
            }
            
            res.json({ message: 'Challenge cancelled' });
        }
    );
});

module.exports = router;