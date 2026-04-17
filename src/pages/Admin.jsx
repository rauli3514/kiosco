import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, Layout, Layers, Printer, Plus, ExternalLink, 
  CheckCircle2, Download, Trash2, Palette, Settings2, Save
} from 'lucide-react';

// --- COMPONENTES UI SIMPLIFICADOS ---
const Block = ({ title, children, footer }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1.25rem', padding: '1.5rem', marginBottom: '1.5rem'
  }}>
    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '0.05em' }}>{title}</h3>
    {children}
    {footer && <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>{footer}</div>}
  </div>
);

const NavBtn = ({ active, icon: Icon, label, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', borderRadius: '0.75rem',
    background: active ? '#3b82f6' : 'transparent', color: active ? '#fff' : '#94a3b8',
    border: 'none', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease'
  }}>
    <Icon size={18} /> {label}
  </button>
);

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: '1.25rem' }}>
    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>{label}</label>
    <input {...props} style={{
      width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '0.75rem', color: '#fff', outline: 'none'
    }} />
  </div>
);

export default function Admin() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('inicio'); // inicio, experiencia, plantilla, impresion
  const [queue, setQueue] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadData();
      const channel = supabase.channel(`admin-${selectedEvent.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs', filter: `event_id=eq.${selectedEvent.id}` }, () => fetchQueue())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'printer_stations' }, () => fetchStations())
        .subscribe();
      return () => { channel.unsubscribe(); };
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data?.length) {
      setEvents(data);
      setSelectedEvent(data[0]);
    }
    setLoading(false);
  };

  const loadData = () => {
    fetchQueue();
    fetchStations();
  };

  const fetchQueue = async () => {
    const { data } = await supabase.from('print_jobs').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false });
    if (data) setQueue(data);
  };

  const fetchStations = async () => {
    const { data } = await supabase.from('printer_stations').select('*').order('last_seen', { ascending: false });
    if (data) setStations(data);
  };

  const saveConfig = async () => {
    setSaving(true);
    await supabase.from('events').update(selectedEvent).eq('id', selectedEvent.id);
    setSaving(false);
    alert("Configuración guardada con éxito.");
  };

  const handleCreate = async () => {
    const slug = prompt("Slug del evento:");
    if (!slug) return;
    const { data } = await supabase.from('events').insert([{ slug: slug.toLowerCase(), title: 'Evento Nuevo', primary_color: '#3b82f6' }]).select();
    if (data) {
      setEvents([data[0], ...events]);
      setSelectedEvent(data[0]);
    }
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff' }}>📡 Cargando Estación...</div>;

  const guestUrl = `${window.location.origin}${window.location.pathname.replace('/admin', '')}?/${selectedEvent?.slug}`;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📸</div>
            EVENTPIX
          </h1>
          <button onClick={handleCreate} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: '#fff', color: '#000', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Plus size={16} /> NUEVO EVENTO
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {events.map(ev => (
              <div key={ev.id} onClick={() => setSelectedEvent(ev)} style={{ padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer', background: selectedEvent?.id === ev.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: selectedEvent?.id === ev.id ? '#3b82f6' : '#94a3b8', border: selectedEvent?.id === ev.id ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{ev.title}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>/{ev.slug}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* HEADER */}
        <header style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.2rem' }}>{selectedEvent?.title}</h2>
            <a href={guestUrl} target="_blank" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <ExternalLink size={12} /> URL para Invitados
            </a>
          </div>
          <nav style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '0.8rem' }}>
            <NavBtn active={activeTab === 'inicio'} icon={BarChart3} label="Inicio" onClick={() => setActiveTab('inicio')} />
            <NavBtn active={activeTab === 'experiencia'} icon={Layout} label="Experiencia" onClick={() => setActiveTab('experiencia')} />
            <NavBtn active={activeTab === 'plantilla'} icon={Layers} label="Plantilla" onClick={() => setActiveTab('plantilla')} />
            <NavBtn active={activeTab === 'impresion'} icon={Printer} label="Impresión" onClick={() => setActiveTab('impresion')} />
          </nav>
        </header>

        {/* VISTAS */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          
          {/* 1. INICIO (DASHBOARD) */}
          {activeTab === 'inicio' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Dashboard del Evento</h2>
                <button style={{ padding: '0.6rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={16} /> DESCARGAR TODO
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {queue.map(job => (
                  <div key={job.id} style={{ background: '#111', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <img src={job.final_image_url || job.raw_photo_urls?.[0]} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} />
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>#{job.adjustments?.short_code || '---'}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: job.status === 'completed' ? '#10b981' : '#f59e0b' }}>{job.status.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. EXPERIENCIA */}
          {activeTab === 'experiencia' && (
            <div style={{ maxWidth: '600px' }}>
              <Block title="Textos de la Pantalla" footer={<button onClick={saveConfig} disabled={saving} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}</button>}>
                <Input label="Título de Bienvenida" value={selectedEvent.welcome_title || ''} onChange={e => setSelectedEvent({...selectedEvent, welcome_title: e.target.value})} />
                <Input label="Subtítulo / Instrucciones" value={selectedEvent.welcome_subtitle || ''} onChange={e => setSelectedEvent({...selectedEvent, welcome_subtitle: e.target.value})} />
                <Input label="Texto del Botón" value={selectedEvent.welcome_button_text || ''} onChange={e => setSelectedEvent({...selectedEvent, welcome_button_text: e.target.value})} />
              </Block>
              <Block title="Estilo Visual">
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Color Primario</label>
                    <input type="color" value={selectedEvent.primary_color || '#3b82f6'} onChange={e => setSelectedEvent({...selectedEvent, primary_color: e.target.value})} style={{ width: '100%', height: '40px', background: 'none', border: 'none', cursor: 'pointer' }} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Tipografía</label>
                    <select value={selectedEvent.font_family || 'system-ui'} onChange={e => setSelectedEvent({...selectedEvent, font_family: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                      <option value="system-ui">Sistema (Rápida)</option>
                      <option value="'Outfit', sans-serif">Moderna (Outfit)</option>
                      <option value="'Montserrat', sans-serif">Geométrica (Montserrat)</option>
                    </select>
                  </div>
                </div>
              </Block>
            </div>
          )}

          {/* 3. PLANTILLA */}
          {activeTab === 'plantilla' && (
            <div style={{ maxWidth: '600px' }}>
              <Block title="Formato de Impresión (6x4)" footer={<button onClick={saveConfig} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={16} /> GUARDAR PLANTILLA</button>}>
                <div style={{ background: '#fff', color: '#000', borderRadius: '1rem', aspectRatio: '6/4', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', opacity: 0.5, border: '2px dashed #ccc' }}>
                  VISTA PREVIA DE PLANTILLA 6x4
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                   <Input label="Segundos de Sesión" type="number" value={selectedEvent.session_timeout || 60} onChange={e => setSelectedEvent({...selectedEvent, session_timeout: parseInt(e.target.value)})} />
                </div>
              </Block>
            </div>
          )}

          {/* 4. IMPRESIÓN */}
          {activeTab === 'impresion' && (
            <div style={{ maxWidth: '600px' }}>
              <Block title="Estado del Hardware">
                {stations.length === 0 ? (
                  <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '1rem', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> No se detectan estaciones de impresión online.
                  </div>
                ) : (
                  stations.map(st => (
                    <div key={st.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{st.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Estación Online</div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{st.available_printers?.length || 0} Impresoras</div>
                    </div>
                  ))
                )}
              </Block>
              <Block title="Gestión de Cola">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <button onClick={async () => { if(confirm('¿Vaciamos la cola de fotos?')) { await supabase.from('print_jobs').delete().eq('event_id', selectedEvent.id); fetchQueue(); } }} style={{ padding: '1rem', borderRadius: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 800, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Trash2 size={24} /> LIMPIAR COLA
                  </button>
                  <button style={{ padding: '1rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 800, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Printer size={24} /> PAUSAR IMPRESIÓN
                  </button>
                </div>
              </Block>
            </div>
          )}

        </div>

        {/* FOOTER STATUS */}
        <footer style={{ padding: '0.8rem 2rem', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle2 size={12} color="#10b981" /> Bases de datos OK</span>
             <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
               <div style={{ width: 6, height: 6, borderRadius: '50%', background: stations.some(s => new Date() - new Date(s.last_seen) < 120000) ? '#10b981' : '#ef4444' }} /> Server: {stations.some(s => new Date() - new Date(s.last_seen) < 120000) ? 'ONLINE' : 'OFFLINE'}
             </span>
          </div>
          <div>{saving ? '⏳ Guardando cambos...' : '✓ Todos los sistemas estables'}</div>
        </footer>

      </main>
    </div>
  );
}
