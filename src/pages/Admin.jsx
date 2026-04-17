import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, Layout, Image as ImageIcon, Printer, Settings, Plus, 
  RefreshCcw, Download, Monitor, Trash2, Palette, Type, MousePointer2, 
  ExternalLink, CheckCircle2, AlertCircle, Clock, Zap, Layers, Smartphone
} from 'lucide-react';

// --- COMPONENTES ATÓMICOS PREMIUM ---
const GlassCard = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '1.25rem',
    padding: '1.5rem',
    ...style
  }}>{children}</div>
);

const NavButton = ({ active, icon: Icon, label, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.75rem 1.25rem', borderRadius: '0.75rem',
    background: active ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
    color: active ? '#fff' : '#94a3b8',
    border: 'none', cursor: 'pointer', fontWeight: 600,
    transition: 'all 0.2s ease',
    boxShadow: active ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
  }}>
    <Icon size={18} /> {label}
  </button>
);

const SectionTitle = ({ title, subtitle }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#fff' }}>{title}</h2>
    {subtitle && <p style={{ color: '#94a3b8', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>{subtitle}</p>}
  </div>
);

// --- ESTILOS UTILES ---
const inputStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.75rem', padding: '0.75rem 1rem', color: '#fff', width: '100%', outline: 'none'
};
const labelStyle = { color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' };

export default function Admin() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, experience, template, print, settings
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [stations, setStations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Inicialización
  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadEventData();
      // Suscripción en tiempo real a la cola de este evento
      const subscription = supabase
        .channel(`jobs-${selectedEvent.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs', filter: `event_id=eq.${selectedEvent.id}` }, () => {
          fetchQueue();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'printer_stations' }, () => {
          fetchStations();
        })
        .subscribe();
      return () => { subscription.unsubscribe(); };
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) {
      setEvents(data);
      if (!selectedEvent && data.length > 0) setSelectedEvent(data[0]);
    }
    setLoading(false);
  };

  const loadEventData = async () => {
    fetchQueue();
    fetchStations();
    fetchTemplates();
  };

  const fetchQueue = async () => {
    const { data } = await supabase.from('print_jobs').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false });
    if (data) setQueue(data);
  };

  const fetchStations = async () => {
    const { data } = await supabase.from('printer_stations').select('*').order('last_seen', { ascending: false });
    if (data) setStations(data);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from('event_templates').select('*').eq('event_id', selectedEvent.id);
    if (data) setTemplates(data);
  };

  const updateEvent = async (changes) => {
    setIsSaving(true);
    setSelectedEvent(prev => ({ ...prev, ...changes }));
    await supabase.from('events').update(changes).eq('id', selectedEvent.id);
    setIsSaving(false);
  };

  const downloadAllPhotos = async () => {
    if (!queue.length) return alert("No hay fotos para descargar.");
    const urls = queue.map(j => j.final_image_url).filter(Boolean);
    if (!urls.length) return alert("Aún no hay fotos procesadas.");
    
    // Mostramos feedback al usuario
    alert(`Iniciando descarga de ${urls.length} fotos... Por favor, permite las descargas múltiples si el navegador lo solicita.`);
    
    urls.forEach((url, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `foto_${selectedEvent.slug}_${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 500); // Descarga secuencial con delay para no saturar el navegador
    });
  };

  const handleCreateEvent = async () => {
    const slug = prompt("URL del evento (ej: cumple-rauly):");
    if (!slug) return;
    const { data, error } = await supabase.from('events').insert([{
      slug: slug.toLowerCase().replace(/\s/g, '-'),
      title: 'Nuevo Evento de Foto',
      primary_color: '#3b82f6',
      countdown_first_photo: 5,
      countdown_next_photos: 3,
      enable_qr: true,
      enable_print: true
    }]).select();
    if (data) {
      setEvents([data[0], ...events]);
      setSelectedEvent(data[0]);
    }
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff' }}>📡 Cargando Estación de Control...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#020617', color: '#f8fafc', overflow: 'hidden', fontFamily: '"Outfit", sans-serif' }}>
      
      {/* SIDEBAR - GESTIÓN DE EVENTOS */}
      <aside style={{ width: '280px', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={24} color="#fff" fill="#fff" />
            </div>
            <h1 style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.02em', margin: 0 }}>EVENTPIX PRO</h1>
          </div>

          <button onClick={handleCreateEvent} style={{ 
            width: '100%', padding: '0.875rem', borderRadius: '1rem', background: '#fff', color: '#000', border: 'none', 
            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            marginBottom: '2rem', transition: 'transform 0.2s ease'
          }}>
            <Plus size={18} strokeWidth={3} /> CREAR EVENTO
          </button>

          <div style={labelStyle}>Mis Eventos Activos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
            {events.map(ev => (
              <div key={ev.id} onClick={() => setSelectedEvent(ev)} style={{
                padding: '1rem', borderRadius: '1rem', cursor: 'pointer',
                background: selectedEvent?.id === ev.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${selectedEvent?.id === ev.id ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                transition: 'all 0.2s ease'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.1rem' }}>{ev.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>/{ev.slug}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* HEADER FLOTANTE */}
        <header style={{ 
          padding: '1.5rem 2.5rem', background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{selectedEvent?.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <a href={`/${selectedEvent?.slug}`} target="_blank" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ExternalLink size={12} /> URL Inivitados
              </a>
              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={12} /> Sistema Operativo
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <NavButton active={activeTab === 'dashboard'} icon={BarChart3} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
            <NavButton active={activeTab === 'experience'} icon={Layout} label="Experiencia" onClick={() => setActiveTab('experience')} />
            <NavButton active={activeTab === 'template'} icon={Layers} label="Plantilla" onClick={() => setActiveTab('template')} />
            <NavButton active={activeTab === 'print'} icon={Printer} label="Impresión" onClick={() => setActiveTab('print')} />
            <NavButton active={activeTab === 'settings'} icon={Settings} label="Extra" onClick={() => setActiveTab('settings')} />
          </div>
        </header>

        {/* CONTENIDO SCROLLEABLE */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', position: 'relative' }}>
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <SectionTitle title="Monitor de Galería" subtitle="Controla en tiempo real las fotos capturadas." />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => {
                      const url = window.location.hostname === 'localhost' 
                        ? `/display/${selectedEvent.slug}` 
                        : `/kiosco/?/display/${selectedEvent.slug}`;
                      window.open(url, '_blank');
                    }}
                    style={{ ...inputStyle, width: 'auto', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Monitor size={16} /> PANTALLA PÚBLICA (TV)
                  </button>
                  <button 
                    onClick={downloadAllPhotos}
                    style={{ ...inputStyle, width: 'auto', background: '#3b82f6', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Download size={16} /> DESCARGAR TODO
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
                {queue.map(job => (
                  <GlassCard key={job.id} style={{ padding: '0.75rem', position: 'relative', overflow: 'hidden' }}>
                    <img 
                      src={job.final_image_url || job.raw_photo_urls?.[0]} 
                      style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: '1rem', background: '#000' }} 
                      alt="Job"
                    />
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        <div style={{ fontWeight: 800, color: '#fff' }}>{job.adjustments?.short_code || '---'}</div>
                        {new Date(job.created_at).toLocaleTimeString()}
                      </div>
                      <div style={{ 
                        padding: '0.4rem 0.75rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 800,
                        background: job.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: job.status === 'completed' ? '#10b981' : '#94a3b8',
                        border: `1px solid ${job.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)'}`
                      }}>
                        {job.status.toUpperCase()}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* TAB: EXPERIENCIA (ESTILOS) */}
          {activeTab === 'experience' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2.5rem', animation: 'fadeIn 0.3s ease-out' }}>
              <div>
                <SectionTitle title="Editor de Experiencia" subtitle="Define cómo verán los invitados tu kiosco digital." />
                
                <GlassCard style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <label style={labelStyle}>Título de Bienvenida</label>
                      <input style={inputStyle} value={selectedEvent.welcome_title || ''} onChange={e => updateEvent({ welcome_title: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Texto del Botón</label>
                      <input style={inputStyle} value={selectedEvent.welcome_button_text || ''} onChange={e => updateEvent({ welcome_button_text: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>Mensaje de Invitación</label>
                      <textarea style={{ ...inputStyle, resize: 'none' }} rows={3} value={selectedEvent.welcome_subtitle || ''} onChange={e => updateEvent({ welcome_subtitle: e.target.value })} />
                    </div>
                  </div>
                </GlassCard>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <GlassCard>
                    <label style={labelStyle}><Palette size={14} /> Identidad Visual</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ ...labelStyle, fontSize: '0.6rem' }}>Color de Marca</label>
                        <input type="color" value={selectedEvent.primary_color || '#3b82f6'} onChange={e => updateEvent({ primary_color: e.target.value })} style={{ width: '100%', height: '40px', border: 'none', background: 'none' }} />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ ...labelStyle, fontSize: '0.6rem' }}>Tipografía</label>
                        <select style={inputStyle} value={selectedEvent.font_family || 'Outfit'} onChange={e => updateEvent({ font_family: e.target.value })}>
                          <option value="Outfit">Outfit (Moderna)</option>
                          <option value="Inter">Inter (Limpia)</option>
                          <option value="Montserrat">Montserrat (Geométrica)</option>
                          <option value="Playfair Display">Bodas (Clásica)</option>
                        </select>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <label style={labelStyle}><ImageIcon size={14} /> Portada y Logo</label>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}>📸 Cambiar Imagen de Fondo</button>
                      <button style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}>🎯 Cambiar Logo Principal</button>
                    </div>
                  </GlassCard>
                </div>
              </div>

              {/* SIMULADOR PREVIEW */}
              <div>
                <h3 style={labelStyle}>Vista Previa (Mobil)</h3>
                <div style={{ 
                  width: '100%', aspectRatio: '9/16', background: selectedEvent.primary_color || '#3b82f6', 
                  borderRadius: '3rem', border: '8px solid #000', overflow: 'hidden', position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem'
                }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8, color: '#fff', marginBottom: '1rem' }}>EVENTO PRO</div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '0 0 1rem 0', fontFamily: selectedEvent.font_family }}>{selectedEvent.welcome_title || 'BIENVENIDOS'}</h2>
                  <p style={{ fontSize: '0.9rem', color: '#fff', opacity: 0.9, marginBottom: '2rem' }}>{selectedEvent.welcome_subtitle || 'Toca el botón para empezar'}</p>
                  <button style={{ padding: '1rem 2rem', borderRadius: '99px', background: '#fff', color: '#000', border: 'none', fontWeight: 900, fontSize: '1rem' }}>
                    {selectedEvent.welcome_button_text || 'COMENZAR'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PLANTILLA (EDITOR) */}
          {activeTab === 'template' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <SectionTitle title="Diseño de Impresión" subtitle="Personaliza el formato de salida 6x4 (4x6in)." />
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 500px', gap: '2.5rem' }}>
                <GlassCard>
                  <label style={labelStyle}>Seleccionar Formato Base</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    {[{id: 'simple', l: '1 Foto (Full)', p: 1}, {id: 'strip', l: 'Foto Strip (Tira)', p: 3}, {id: 'grid', l: 'Cuadrícula 2x2', p: 4}].map(f => (
                      <div key={f.id} style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                        <div style={{ fontWeight: 800 }}>{f.l}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{f.p} Capturas</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '2rem' }}>
                    <label style={labelStyle}>Elementos Extra</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 700 }}>Marca de Agua (Logo)</div>
                        <input type="checkbox" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 700 }}>Texto Personalizado Inferior</div>
                        <input type="checkbox" />
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <div style={{ background: '#fff', borderRadius: '1rem', aspectRatio: '6/4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', position: 'relative', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)' }}>
                   <div style={{ border: '2px dashed #3b82f6', width: '80%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 900, opacity: 0.5 }}>
                     FRAME FOTO #1
                   </div>
                   <div style={{ position: 'absolute', bottom: '10px', right: '20px', fontSize: '0.8rem', color: '#94a3b8' }}>EVENTPIX PRO RENDER</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: IMPRESIÓN (HARDWARE) */}
          {activeTab === 'print' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <SectionTitle title="Centro de Impresión" subtitle="Gestiona impresoras físicas y cola de trabajos." />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                <GlassCard>
                  <label style={labelStyle}>Estado de Servidores</label>
                  {stations.map(st => {
                    const online = new Date() - new Date(st.last_seen) < 120000;
                    return (
                      <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.03)', border: `1px solid ${online ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, marginBottom: '1rem' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: online ? '#10b981' : '#ef4444', boxShadow: online ? '0 0 10px #10b981' : 'none' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800 }}>{st.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{st.available_printers?.length || 0} impresoras detectadas</div>
                        </div>
                        <button style={{ ...inputStyle, width: 'auto', padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.1)' }}>RECONECTAR</button>
                      </div>
                    );
                  })}
                  
                  <div style={{ marginTop: '2rem' }}>
                    <label style={labelStyle}>Impresora Seleccionada</label>
                    <select style={inputStyle} value={selectedEvent.selected_printer_name || ''} onChange={e => updateEvent({ selected_printer_name: e.target.value })}>
                      <option value="">-- Seleccionar Impresora Remota --</option>
                      {stations.flatMap(s => s.available_printers || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </GlassCard>

                <GlassCard>
                  <label style={labelStyle}>Controles de Cola</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <button style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', height: '100px', flexFlow: 'column', gap: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RefreshCcw size={24} /> PAUSAR IMPRESIÓN
                    </button>
                    <button onClick={async () => { if(confirm('¿Limpiar cola?')) { await supabase.from('print_jobs').delete().eq('event_id', selectedEvent.id); fetchQueue(); } }} style={{ ...inputStyle, background: 'rgba(185, 28, 28, 0.1)', color: '#ef4444', border: '1px solid rgba(185, 28, 28, 0.2)', height: '100px', flexFlow: 'column', gap: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={24} /> VACIAR COLA
                    </button>
                  </div>
                  <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Trabajos en cola</span>
                      <span style={{ fontWeight: 800 }}>{queue.filter(j => j.status !== 'completed').length}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: '#3b82f6' }} />
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {/* TAB: CONFIGURACIÓN EXTRA */}
          {activeTab === 'settings' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <SectionTitle title="Límites y Mantenimiento" subtitle="Configura restricciones operativas para el evento." />
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
                <GlassCard>
                  <label style={labelStyle}><Monitor size={14} /> Límites de Evento</label>
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <span>Límite de Impresiones Totales</span>
                        <span style={{ fontWeight: 800 }}>300</span>
                      </div>
                      <input type="range" min="0" max="1000" style={{ width: '100%' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <span>Tiempo de Sesión (Seg)</span>
                        <span style={{ fontWeight: 800 }}>{selectedEvent.session_timeout || 60} s</span>
                      </div>
                      <input type="range" min="30" max="300" style={{ width: '100%' }} value={selectedEvent.session_timeout || 60} onChange={e => updateEvent({ session_timeout: parseInt(e.target.value) })} />
                    </div>
                  </div>
                </GlassCard>

                <GlassCard>
                  <label style={labelStyle}><Trash2 size={14} /> Gestión de Datos</label>
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>Auto-limpieza</div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Borrar fotos tras 24hs</div>
                      </div>
                      <input type="checkbox" />
                    </div>
                    <button style={{ ...inputStyle, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 800 }}>RESETEAR EVENTO COMPLETO</button>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

        </div>

        {/* BARRA DE ESTADO INFERIOR */}
        <footer style={{ 
          padding: '0.75rem 2.5rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b'
        }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle2 size={12} color="#10b981" /> Supabase Conectado</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: stations.some(s => new Date() - new Date(s.last_seen) < 120000) ? '#10b981' : '#ef4444' }} /> 
              Print Server: {stations.some(s => new Date() - new Date(s.last_seen) < 120000) ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div>{isSaving ? '💾 Guardando cambios...' : '✓ Sincronizado'}</div>
        </footer>

      </main>

      {/* ESTILOS GLOBALES INYECTADOS */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        input[type="range"] { accent-color: #3b82f6; cursor: pointer; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

const sharedToggleStyleAdmin = { 
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
  background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)',
  fontSize: '0.85rem', fontWeight: 'bold' 
};
