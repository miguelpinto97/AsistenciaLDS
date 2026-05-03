const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event) => {
  const { url, claseId, fecha } = event.queryStringParameters || {};
  if (!claseId || !fecha) return { statusCode: 400, body: "Missing metadata" };

  // Generate a random 6-character alphanumeric code
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const code = generateCode();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(`
      INSERT INTO enlaces_cortos (codigo, url_larga, clase_id, fecha)
      VALUES ($1, $2, $3, $4)
    `, [code, url || '', claseId, fecha]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    };
  } catch (err) {
    console.error("DB Save error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not generate short link" })
    };
  } finally {
    await client.end();
  }
};
