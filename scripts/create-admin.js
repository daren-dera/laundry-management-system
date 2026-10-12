const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'laundry_management'
    });

    try {
        const username = 'admin@ucj.com';
        const password = 'ucj123';
        
        // This generates the perfect native hash your project expects
        const hashedPassword = await bcrypt.hash(password, 10);

        // Remove any conflicting records
        await connection.execute('DELETE FROM users WHERE username = ?', [username]);

        // Insert fresh verified admin user
        await connection.execute(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, 'S.Pavatharany', 'admin']
        );

        console.log('Successfully created admin user:');
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
    } catch (error) {
        console.error('Error seeding admin user:', error.message);
    } finally {
        await connection.end();
    }
}

createAdmin();
