-- MIGRACIÓN: Crear tabla printer_stations
-- Correr este SQL en el editor SQL de Supabase

CREATE TABLE IF NOT EXISTS printer_stations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    available_printers TEXT[],
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status VARCHAR(20) DEFAULT 'online'
);

ALTER TABLE printer_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Printer stations are manageable" 
    ON printer_stations FOR ALL USING (true);
