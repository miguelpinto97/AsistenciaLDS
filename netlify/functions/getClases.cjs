const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event, context) => {
  const { date } = event.queryStringParameters || {};
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Fetch all classes and their students, plus attendance if date is provided
    const res = await client.query(`
      SELECT 
        c.id as clase_id, 
        c.nombre as clase, 
        a.id as alumno_id, 
        a.nombre as alumno,
        EXISTS (
          SELECT 1 FROM asistencias ast 
          WHERE ast.alumno_id = a.id AND ast.fecha = $1
        ) as asistio
      FROM clases c
      LEFT JOIN alumnos a ON c.id = a.clase_id
      ORDER BY c.nombre, a.nombre
    `, [date || null]);

    // Group by class
    const grouped = res.rows.reduce((acc, row) => {
      if (!acc[row.clase]) {
        acc[row.clase] = {
          id: row.clase_id,
          students: []
        };
      }
      if (row.alumno) {
        acc[row.clase].students.push({
          id: row.alumno_id,
          nombre: row.alumno,
          asistio: row.asistio
        });
      }
      return acc;
    }, {});

    // Check if date is locked
    const dateStr = date || null;
    const lockRes = await client.query('SELECT 1 FROM fechas_cerradas WHERE fecha = $1', [dateStr]);
    const isLocked = lockRes.rows.length > 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: grouped, isLocked })
    };

  } catch (error) {
    console.error("Fetch error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    await client.end();
  }
};
