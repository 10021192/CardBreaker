const mysql = require('mysql2');
require('dotenv').config();

// Create MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3307,
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Cleanup expired challenges every 5 minutes
const cleanupInterval = setInterval(() => {
    db.query(
        `UPDATE challenges
         SET status = 'expired'
         WHERE status = 'pending'
         AND expires_at < NOW()`,
        (err, result) => {
            if (err) {
                console.error('Challenge cleanup failed:', err);
            } else if (result.affectedRows > 0) {
                console.log(`Cleaned up ${result.affectedRows} expired challenges`);
            }
        }
    );
}, 5 * 60 * 1000); // 5 minutes

// Export for use in other files
module.exports = { db, cleanupInterval };