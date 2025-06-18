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

// Get online users (for challenge system)
router.get('/users/online', requireAuth, (req, res) => {
    db.query(
        'SELECT user_id, username FROM users WHERE is_online = TRUE AND user_id != ?',
        [req.session.userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        }
    );
});

module.exports = router;