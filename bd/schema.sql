-- Schema for Church Attendance App

CREATE TABLE IF NOT EXISTS clases (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS alumnos (
    id SERIAL PRIMARY KEY,
    clase_id INTEGER REFERENCES clases(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    UNIQUE(clase_id, nombre)
);
