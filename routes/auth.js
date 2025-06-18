const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');

// User registration route
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if user already exists
    db.query('SELECT user_id FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Insert new user (Note: In production, hash the password!)
        db.query(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, password], // Using plain password for now
            (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create user' });
                }
                
                res.json({ 
                    message: 'User created successfully',
                    userId: result.insertId 
                });
            }
        );
    });
});

// User login route
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    db.query(
        'SELECT user_id, username FROM users WHERE username = ? AND password_hash = ?',
        [username, password],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Set up session
            req.session.userId = results[0].user_id;
            req.session.username = results[0].username;
            
            // Update user online status
            db.query(
                'UPDATE users SET is_online = TRUE WHERE user_id = ?',
                [results[0].user_id]
            );
            
            res.json({ 
                message: 'Login successful',
                username: results[0].username 
            });
        }
    );
});

// Logout route
router.post('/logout', (req, res) => {
    const userId = req.session.userId;
    
    if (userId) {
        // Update user online status
        db.query(
            'UPDATE users SET is_online = FALSE WHERE user_id = ?',
            [userId]
        );
    }
    
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ message: 'Logout successful' });
    });
});

module.exports = router;