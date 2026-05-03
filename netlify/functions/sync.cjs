const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  const { data } = JSON.parse(event.body);
  if (!data) {
    return { 
      statusCode: 400, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Missing data" }) 
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Start Transaction
    await client.query('BEGIN');

    // 1. Get current classes from DB
    const dbClasesRes = await client.query('SELECT id, nombre FROM clases');
    const dbClases = dbClasesRes.rows;
    const dbClaseNames = dbClases.map(c => c.nombre);
    
    const incomingClaseNames = Object.keys(data);

    // 2. Remove classes that are NOT in the PDF
    const clasesToRemove = dbClaseNames.filter(name => !incomingClaseNames.includes(name));
    for (const className of clasesToRemove) {
      await client.query('DELETE FROM clases WHERE nombre = $1', [className]);
    }

    // 3. Process each class from PDF
    for (const className of incomingClaseNames) {
      let claseId;
      const existingClase = dbClases.find(c => c.nombre === className);
      
      if (!existingClase) {
        // Add new class
        const insertRes = await client.query('INSERT INTO clases (nombre) VALUES ($1) RETURNING id', [className]);
        claseId = insertRes.rows[0].id;
      } else {
        claseId = existingClase.id;
      }

      // Sync students for this class
      const incomingStudents = data[className];
      const dbStudentsRes = await client.query('SELECT nombre FROM alumnos WHERE clase_id = $1', [claseId]);
      const dbStudents = dbStudentsRes.rows.map(s => s.nombre);

      // Remove students not in PDF
      const studentsToRemove = dbStudents.filter(name => !incomingStudents.includes(name));
      if (studentsToRemove.length > 0) {
        await client.query('DELETE FROM alumnos WHERE clase_id = $1 AND nombre = ANY($2)', [claseId, studentsToRemove]);
      }

      // 4. Batch add students not in DB
      const studentsToAdd = incomingStudents.filter(name => !dbStudents.includes(name));
      if (studentsToAdd.length > 0) {
        await client.query(`
          INSERT INTO alumnos (clase_id, nombre) 
          SELECT $1, unnest($2::text[]) 
          ON CONFLICT DO NOTHING
        `, [claseId, studentsToAdd]);
      }
    }

    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Sync successful" })
    };

  } catch (error) {
    console.error("Sync Error:", error);
    try {
      await client.query('ROLLBACK');
    } catch (rbError) {
      console.error("Rollback Error:", rbError);
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  } finally {
    await client.end();
  }
};
