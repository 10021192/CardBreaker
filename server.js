// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const session = require('express-session');
const path = require('path');

// Import database connection
const { db, cleanupInterval } = require('./db/connection');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const challengeRoutes = require('./routes/challenges');
const gameRoutes = require('./routes/games');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public', { index: false }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Basic routes
app.get('/', (req, res) => {
    res.redirect('/game/');
});

// Test routes
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working!', timestamp: new Date() });
});

app.get('/api/test-db', async (req, res) => {
    db.query('SELECT 1 + 1 AS result', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        res.json({ 
            message: 'Database connected!', 
            result: results[0].result,
            database: process.env.DB_NAME 
        });
    });
});

// Use route modules
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', challengeRoutes);
app.use('/api', gameRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

db.query(
    'UPDATE users SET is_online = FALSE',
    (err, result) => {
        if (err) {
            console.error('Failed to reset online status:', err);
        } else {
            console.log(`Reset online status for ${result.affectedRows} users`);
        }
    }
);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Test the API at http://localhost:${PORT}/api/test`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    
    // Clear the cleanup interval
    clearInterval(cleanupInterval);
    
    db.end((err) => {
        if (err) {
            console.error('Error closing database connection:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});