-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN: Motor de Habilitación de Eventos
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Modo de acceso al evento:
--   'open'        → Abierto, sin restricciones
--   'paid_photo'  → El usuario paga por cada grupo de fotos (X fotos por sesión)
--   'time_based'  → El kiosco está habilitado solo por X horas desde que se activa
--   'code'        → Se requiere un código de acceso (ej: dado en la entrada)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS access_mode VARCHAR(20) DEFAULT 'open',

  -- Para modo 'paid_photo': cuánto cuesta por sesión y cuántas fotos incluye
  ADD COLUMN IF NOT EXISTS price_per_session NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photos_per_session INTEGER DEFAULT 1,

  -- Para modo 'time_based': ventana de tiempo habilitada
  ADD COLUMN IF NOT EXISTS access_start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_end_at   TIMESTAMP WITH TIME ZONE,

  -- Para modo 'code': el código que se valida del lado del cliente
  ADD COLUMN IF NOT EXISTS access_code TEXT,

  -- Moneda (para mostrar correctamente el precio)
  ADD COLUMN IF NOT EXISTS currency VARCHAR(5) DEFAULT 'ARS',

  -- Mensaje personalizado cuando el evento está cerrado / restringido
  ADD COLUMN IF NOT EXISTS access_locked_message TEXT DEFAULT 'Este evento no está disponible en este momento.',

  -- Permite al operador "abrir manualmente" sin cambiar la configuración
  ADD COLUMN IF NOT EXISTS manual_override_open BOOLEAN DEFAULT FALSE;

-- Índice rápido por access_mode
CREATE INDEX IF NOT EXISTS idx_events_access_mode ON events(access_mode);

-- ──────────────────────────────────────────────────────────
-- Tabla de sesiones pagadas (para modo 'paid_photo')
-- Cada vez que un huésped paga, se crea un token de sesión
-- que permite hacer foto_count fotos.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_sessions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  token       VARCHAR(12) NOT NULL UNIQUE,  -- token corto alfanumérico
  photos_allowed INTEGER NOT NULL DEFAULT 1,
  photos_used    INTEGER NOT NULL DEFAULT 0,
  paid_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  expires_at  TIMESTAMP WITH TIME ZONE,      -- NULL = no expira
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS para event_sessions
ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view their session" ON event_sessions FOR SELECT USING (true);
CREATE POLICY "Operator can insert sessions" ON event_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Update session usage" ON event_sessions FOR UPDATE USING (true);

-- ──────────────────────────────────────────────────────────
-- Vista helper: estado actual de acceso de un evento
-- (útil para debugging desde Supabase UI)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW event_access_status AS
SELECT
  id,
  slug,
  title,
  access_mode,
  is_active,
  manual_override_open,
  access_start_at,
  access_end_at,
  CASE
    WHEN manual_override_open = TRUE THEN 'open_override'
    WHEN is_active = FALSE THEN 'inactive'
    WHEN access_mode = 'open' THEN 'open'
    WHEN access_mode = 'code' THEN 'requires_code'
    WHEN access_mode = 'paid_photo' THEN 'requires_payment'
    WHEN access_mode = 'time_based' AND now() BETWEEN access_start_at AND access_end_at THEN 'open_time'
    WHEN access_mode = 'time_based' AND now() < access_start_at THEN 'not_started'
    WHEN access_mode = 'time_based' AND now() > access_end_at THEN 'expired'
    ELSE 'unknown'
  END AS access_status
FROM events;
