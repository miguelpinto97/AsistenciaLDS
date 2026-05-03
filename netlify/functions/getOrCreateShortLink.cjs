const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event) => {
  const { claseId, fecha } = event.queryStringParameters || {};
  if (!claseId || !fecha) return { statusCode: 400, body: "Missing metadata" };

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Check if link already exists for this class and date
    const existing = await client.query(`
      SELECT codigo FROM enlaces_cortos 
      WHERE clase_id = $1 AND fecha = $2
    `, [claseId, fecha]);

    if (existing.rows.length > 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: existing.rows[0].codigo })
      };
    }

    // 2. Generate unique code if not exists
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let newCode;
    let isUnique = false;
    while (!isUnique) {
      newCode = generateCode();
      const check = await client.query('SELECT 1 FROM enlaces_cortos WHERE codigo = $1', [newCode]);
      if (check.rows.length === 0) isUnique = true;
    }

    await client.query(`
      INSERT INTO enlaces_cortos (codigo, url_larga, clase_id, fecha)
      VALUES ($1, $2, $3, $4)
    `, [newCode, '', claseId, fecha]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode })
    };

  } catch (err) {
    console.error("Link generation error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  } finally {
    await client.end();
  }
};
