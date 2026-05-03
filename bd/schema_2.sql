-- Schema V2 for Church Attendance App (Escuela Dominical)

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

CREATE TABLE IF NOT EXISTS asistencias (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alumno_id, fecha)
);
CREATE TABLE IF NOT EXISTS enlaces_cortos (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    url_larga TEXT NOT NULL,
    clase_id INTEGER REFERENCES clases(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
