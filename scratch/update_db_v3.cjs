const { Client } = require('pg');
require('dotenv').config();

async function updateSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(`
      CREATE TABLE IF NOT EXISTS enlaces_cortos (
        id SERIAL PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        url_larga TEXT NOT NULL,
        clase_id INTEGER REFERENCES clases(id) ON DELETE CASCADE,
        fecha DATE NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Table enlaces_cortos created or already exists');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    await client.end();
  }
}

updateSchema();
