-- SCHEMAS PARA KIOSCO DIGITAL (Actualizado)

-- 1. Tabla de Eventos
CREATE TABLE events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Welcome Screen Config
    welcome_title TEXT DEFAULT 'Bienvenidos',
    welcome_subtitle TEXT DEFAULT 'Tómate una foto y llévate tu recuerdo impreso',
    welcome_button_text TEXT DEFAULT 'COMENZAR',
    
    -- Design Identity
    primary_color VARCHAR(10) DEFAULT '#ec4899',
    secondary_color VARCHAR(10) DEFAULT '#0f172a',
    font_family VARCHAR(50) DEFAULT 'Inter',
    logo_url TEXT,
    background_url TEXT,
    bg_opacity FLOAT DEFAULT 0.5,
    bg_blur INTEGER DEFAULT 10,
    show_live_camera_bg BOOLEAN DEFAULT FALSE,
    selected_theme_id VARCHAR(50) DEFAULT 'default',
    
    -- Capture Config
    countdown_first_photo INTEGER DEFAULT 5,
    countdown_next_photos INTEGER DEFAULT 3,
    enable_stickers BOOLEAN DEFAULT TRUE,
    
    -- Output Config
    enable_qr BOOLEAN DEFAULT TRUE,
    enable_whatsapp BOOLEAN DEFAULT TRUE,
    enable_email BOOLEAN DEFAULT TRUE,
    enable_print BOOLEAN DEFAULT TRUE,
    
    -- Printer Hardware Config
    selected_printer_name TEXT,
    selected_paper_size VARCHAR(50) DEFAULT '4x6in', -- 4x6in, 2x6in, A4, etc.
    print_auto_start BOOLEAN DEFAULT FALSE,
    print_limit INTEGER DEFAULT 999,
    print_scale INTEGER DEFAULT 100,
    print_offset_x INTEGER DEFAULT 0,
    print_offset_y INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Estaciones de Impresión (Local Servers)
CREATE TABLE printer_stations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,             -- Nombre de la PC / Estación
    available_printers TEXT[],              -- Lista de impresoras detectadas localmente
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status VARCHAR(20) DEFAULT 'online'     -- online, offline
);

-- 3. Plantillas de Eventos
CREATE TABLE event_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    base_image_url TEXT,                    -- El fondo de la impresión (PNG/JPG)
    photo_count INTEGER DEFAULT 1,
    frames_config JSONB NOT NULL,           -- [{x, y, width, height, borderRadius}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Cola de Impresión (Print Jobs)
CREATE TABLE print_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    template_id UUID REFERENCES event_templates(id) ON DELETE SET NULL,
    
    raw_photo_urls TEXT[] NOT NULL,         -- Fotos originales tomadas por el usuario
    final_image_url TEXT,                   -- Resultado final renderizado
    
    filter_name VARCHAR(50) DEFAULT 'none',
    adjustments JSONB,                      -- {brightness, contrast, saturation}
    frames_config JSONB,                    -- Copia de la config de frames al momento del job
    base_image_url TEXT,                    -- Copia del fondo al momento del job
    stickers_data JSONB,                    -- [{id, emoji, photoIdx, x, y, scale}, ...]
    
    status VARCHAR(20) DEFAULT 'pending_render', -- pending_render, rendering, pending_print, printing, completed, error
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS POLICIES
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE printer_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Public templates are viewable by everyone" ON event_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert to print jobs" ON print_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view their job status" ON print_jobs FOR SELECT USING (true);
CREATE POLICY "Update for the render server" ON print_jobs FOR UPDATE USING (true);
CREATE POLICY "Printer stations are manageable" ON printer_stations FOR ALL USING (true);
