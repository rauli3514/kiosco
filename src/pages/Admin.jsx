import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Plus, Layout, RefreshCcw, Image as ImageIcon, Smartphone, Palette, FileImage, Type, Lock, Clock, CreditCard, Unlock } from 'lucide-react';

export default function Admin() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [queue, setQueue] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState('queue'); // queue, design, templates
  
  // Plantillas state
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // Para auto-guardado
  const [isSaving, setIsSaving] = useState(false);

  const [newSlug, setNewSlug] = useState('');
  
  // Printer Stations state
  const [stations, setStations] = useState([]);

  // Sessions (modo paid_photo)
  const [sessions, setSessions] = useState([]);
  const [newToken, setNewToken] = useState('');
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      if (activeTab === 'queue') fetchQueue(selectedEvent.id);
      if (activeTab === 'templates') fetchTemplates(selectedEvent.id);
      if (activeTab === 'design') fetchStations();
      if (activeTab === 'access') fetchSessions(selectedEvent.id);
    }
  }, [selectedEvent, activeTab]);

  const fetchStations = async () => {
    const { data } = await supabase.from('printer_stations').select('*').order('last_seen', { ascending: false });
    if (data) setStations(data);
  };

  const fetchSessions = async (eventId) => {
    const { data } = await supabase.from('event_sessions').select('*')
      .eq('event_id', eventId).order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  const generateToken = async () => {
    if (!selectedEvent) return;
    setGeneratingToken(true);
    const token = newToken.trim().toUpperCase() ||
      Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from('event_sessions').insert([{
      event_id: selectedEvent.id,
      token,
      photos_allowed: selectedEvent.photos_per_session || 1,
    }]);
    if (error) alert('Error: ' + error.message);
    else {
      setNewToken('');
      fetchSessions(selectedEvent.id);
    }
    setGeneratingToken(false);
  };

  const deleteSession = async (sessionId) => {
    await supabase.from('event_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const deleteEvent = async (eventId, eventTitle) => {
    if (!window.confirm(`¿Seguro que querés borrar el evento "${eventTitle}"? Esto eliminará también todos sus trabajos de impresión.`)) return;
    await supabase.from('print_jobs').delete().eq('event_id', eventId);
    await supabase.from('event_sessions').delete().eq('event_id', eventId);
    await supabase.from('event_templates').delete().eq('event_id', eventId);
    await supabase.from('events').delete().eq('id', eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    if (selectedEvent?.id === eventId) setSelectedEvent(null);
  };

  const deleteJob = async (jobId) => {
    await supabase.from('print_jobs').delete().eq('id', jobId);
    setQueue(prev => prev.filter(j => j.id !== jobId));
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) setEvents(data);
  };

  const fetchQueue = async (eventId) => {
    const { data } = await supabase.from('print_jobs').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (data) setQueue(data);
  };

  const fetchTemplates = async (eventId) => {
    const { data } = await supabase.from('event_templates').select('*').eq('event_id', eventId);
    if (data) setTemplates(data);
  };

  const createEvent = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('events').insert([{
      slug: newSlug.toLowerCase().trim(),
      title: 'Nuevo Evento',
      description: 'Por favor, configura tu evento.',
      // Nuevos defaults
      welcome_title: 'Bienvenidos a mi evento',
      welcome_subtitle: 'Tómate una foto y llévate tu recuerdo impreso',
      welcome_button_text: 'COMENZAR',
      primary_color: '#ec4899',
      secondary_color: '#0f172a',
      font_family: 'Inter',
      bg_opacity: 0.5,
      bg_blur: 10,
      background_url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1000',
      logo_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=200'
    }]).select();
    
    if (!error && data) {
      setEvents([data[0], ...events]);
      setShowCreate(false);
      setNewSlug('');
      setSelectedEvent(data[0]);
      setActiveTab('design');
    } else {
      alert("Error: " + error.message);
    }
  };

  const updateEventConfigBulk = async (changes) => {
    const updated = { ...selectedEvent, ...changes };
    setSelectedEvent(updated);
    setIsSaving(true);
    await supabase.from('events').update(changes).eq('id', updated.id);
    setIsSaving(false);
  };

  const handleImageUpload = async (e, table, id, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Feedback de subiendo
    setIsSaving(true);
    
    const fileName = `admin_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('kiosco-prints').upload(fileName, file);
    
    if (uploadError) {
      alert("Error subiendo el archivo: " + uploadError.message);
      setIsSaving(false);
      return;
    }
    
    const { data: publicUrlData } = supabase.storage.from('kiosco-prints').getPublicUrl(fileName);
    
    if (table === 'events') {
      updateEventConfigBulk({ [fieldName]: publicUrlData.publicUrl });
    } else if (table === 'templates') {
      updateTemplateBulk(id, { [fieldName]: publicUrlData.publicUrl });
    }
    setIsSaving(false);
    
    // Opcional: mostrar alert de éxito
    alert(`Imagen cargada con éxito!`);
  };

  const deleteTemplate = async (templateId) => {
    // Si tu navegador bugueaba window.confirm, lo borramos: se elimina directo
    setEditingTemplate(null);
    setTemplates(templates.filter(t => t.id !== templateId));
    await supabase.from('event_templates').delete().eq('id', templateId);
  };

  const createBlankTemplate = async () => {
    const newTpl = {
      event_id: selectedEvent.id,
      name: 'Plantilla Nueva',
      base_image_url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800',
      photo_count: 1,
      frames_config: [{ id: 1, x: 20, y: 20, width: 60, height: 60, borderRadius: 0 }] 
    };
    const { data, error } = await supabase.from('event_templates').insert([newTpl]).select();
    if (data) {
      setTemplates([...templates, data[0]]);
      setEditingTemplate(data[0]);
    }
  };

  const updateTemplateBulk = async (templateId, changes) => {
    const updated = templates.map(t => t.id === templateId ? { ...t, ...changes } : t);
    setTemplates(updated);
    
    if (editingTemplate && editingTemplate.id === templateId) {
      setEditingTemplate({ ...editingTemplate, ...changes });
    }

    await supabase.from('event_templates').update(changes).eq('id', templateId);
  };

  const loadPreset = (presetName) => {
    if (!editingTemplate) return;
    let frames = [];
    if (presetName === 'strip3') {
      frames = [
        { id: 1, x: 10, y: 5, width: 80, height: 28, borderRadius: 0 },
        { id: 2, x: 10, y: 35, width: 80, height: 28, borderRadius: 0 },
        { id: 3, x: 10, y: 65, width: 80, height: 28, borderRadius: 0 }
      ];
    } else if (presetName === 'pose2') { // Agregado: Layout de 2 Fotos
      frames = [
        { id: 1, x: 10, y: 10, width: 80, height: 35, borderRadius: 0 },
        { id: 2, x: 10, y: 55, width: 80, height: 35, borderRadius: 0 }
      ];
    } else if (presetName === 'grid4') {
      frames = [
        { id: 1, x: 5, y: 5, width: 42, height: 40, borderRadius: 0 },
        { id: 2, x: 53, y: 5, width: 42, height: 40, borderRadius: 0 },
        { id: 3, x: 5, y: 48, width: 42, height: 40, borderRadius: 0 },
        { id: 4, x: 53, y: 48, width: 42, height: 40, borderRadius: 0 }
      ];
    } else if (presetName === 'simple1') {
      frames = [{ id: 1, x: 5, y: 5, width: 90, height: 75, borderRadius: 0 }];
    }
    
    updateTemplateBulk(editingTemplate.id, { 
      frames_config: frames, 
      photo_count: frames.length 
    });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui' }}>
      
      {/* Sidebar - TUS EVENTOS */}
      <div style={{ width: '280px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
          <Settings size={20} /> ADMIN PANEL
        </h2>
        
        <button 
          onClick={() => { setShowCreate(true); setSelectedEvent(null); }}
          style={{ width: '100%', background: '#0f172a', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', fontWeight: 'bold' }}>
          <Plus size={18} /> Nuevo Evento
        </button>

        <h3 style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Eventos Activos</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => { setSelectedEvent(ev); setShowCreate(false); }}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: selectedEvent?.id === ev.id ? '#f1f5f9' : 'transparent',
                border: selectedEvent?.id === ev.id ? '1px solid #cbd5e1' : '1px solid transparent',
                position: 'relative',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', paddingRight: '1.5rem' }}>{ev.title || ev.slug}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>/{ev.slug}</div>
              <button
                onClick={e => { e.stopPropagation(); deleteEvent(ev.id, ev.title || ev.slug); }}
                title="Borrar evento"
                style={{
                  position: 'absolute', top: '0.75rem', right: '0.75rem',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1, padding: '2px 4px',
                  borderRadius: '4px',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '100vh', overflow: 'hidden' }}>
        
        {showCreate && !selectedEvent && (
          <div style={{ padding: '3rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <h2>Nombra la URL de tu Evento</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Esta será la página exacta a la que entrarán tus invitados.</p>
              <form onSubmit={createEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input required value={newSlug} onChange={e=>setNewSlug(e.target.value)} placeholder="ej: boda-andres-2026" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  Crear y Diseñar
                </button>
              </form>
            </div>
          </div>
        )}

        {!showCreate && !selectedEvent && (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <h2>← Selecciona o crea un evento en la barra lateral</h2>
          </div>
        )}

        {selectedEvent && (
          <>
            {/* Topbar Menus */}
            <div style={{ background: '#fff', padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedEvent.title}</h1>
                <a 
                  href={window.location.hostname === 'localhost' 
                    ? `/${selectedEvent.slug}` 
                    : `/kiosco/?/${selectedEvent.slug}`} 
                  target="_blank" 
                  style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}
                >
                  Ver Kiosco en Vivo ↗
                </a>
              </div>
              <div style={{ flex: 1 }}></div>

              {['queue', 'design', 'access', 'templates'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    fontWeight: activeTab === tab ? 'bold' : 'normal',
                    color: activeTab === tab ? '#0f172a' : '#64748b',
                    borderBottom: activeTab === tab ? '2px solid #0f172a' : '2px solid transparent'
                  }}
                >
                  {tab === 'queue' && 'Monitor en Vivo'}
                  {tab === 'design' && 'Diseñador Visual'}
                  {tab === 'access' && '🔐 Habilitación'}
                  {tab === 'templates' && 'Plantillas Maker'}
                </button>
              ))}
            </div>

            {/* Tab Views */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              
              {/* === TABLA DE COLA === */}
              {activeTab === 'queue' && (
                <div style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{margin: '0 0 0.25rem 0'}}>Impresiones Entrantes</h2>
                      <p style={{margin: 0, fontSize: '0.8rem', color: '#64748b'}}>{queue.length} trabajos encontrados para este evento</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {queue.length > 0 && (
                        <button
                          onClick={async () => {
                            if (!window.confirm('¿Borrar todos los trabajos de este evento?')) return;
                            await supabase.from('print_jobs').delete().eq('event_id', selectedEvent.id);
                            setQueue([]);
                          }}
                          style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                        >🗑 Limpiar todo</button>
                      )}
                      <button onClick={() => fetchQueue(selectedEvent.id)} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}><RefreshCcw size={14}/> Refrescar</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {queue.map(q => {
                      const statusColors = {
                        pending_render: { bg: '#fef9c3', text: '#854d0e', label: '⏳ Renderizando' },
                        rendering:      { bg: '#dbeafe', text: '#1e40af', label: '⚙️ Procesando' },
                        pending_print:  { bg: '#f1f5f9', text: '#475569', label: '✋ Esperando OK' },
                        approved_for_print: { bg: '#d1fae5', text: '#065f46', label: '🖨️ Imprimiendo...' },
                        printing:       { bg: '#e0e7ff', text: '#3730a3', label: '📄 Enviado a impresora' },
                        completed:      { bg: '#f0fdf4', text: '#166534', label: '✅ Completada' },
                        error:          { bg: '#fee2e2', text: '#991b1b', label: '❌ Error' },
                      };
                      const sc = statusColors[q.status] || statusColors.pending_render;
                      const previewUrl = q.final_image_url || (q.raw_photo_urls && q.raw_photo_urls[0]);
                      return (
                        <div key={q.id} style={{ background: '#fff', padding: '1rem', borderRadius: '0.75rem', width: '180px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                          <button
                            onClick={() => deleteJob(q.id)}
                            title="Borrar"
                            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#fee2e2', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#ef4444', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, zIndex: 5 }}
                          >✕</button>
                          {previewUrl ? (
                            <img src={previewUrl} alt="" style={{width: '100%', height: '140px', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '0.75rem'}} />
                          ) : (
                            <div style={{width:'100%', height:'140px', background:'#f1f5f9', borderRadius:'0.5rem', marginBottom:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem'}}>📷</div>
                          )}
                          <span style={{ display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, background: sc.bg, color: sc.text, marginBottom: '0.5rem' }}>
                            {sc.label}
                          </span>
                          
                          {q.status === 'pending_print' && (
                            <button
                              onClick={async () => {
                                await supabase.from('print_jobs').update({ status: 'approved_for_print' }).eq('id', q.id);
                                fetchQueue(selectedEvent.id);
                              }}
                              style={{
                                background: '#3b82f6', color: '#fff', border: 'none', padding: '0.4rem 0.5rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginBottom: '0.5rem'
                              }}
                            >
                              <RefreshCcw size={12}/> Aprobar Impresión
                            </button>
                          )}

                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 'auto' }}>
                            {new Date(q.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {q.error_message && (
                            <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '0.25rem', wordBreak: 'break-all' }}>{q.error_message}</div>
                          )}
                        </div>
                      );
                    })}
                    {queue.length === 0 && (
                      <div style={{ width: '100%', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                        <p style={{ margin: 0, fontWeight: 600 }}>La cola está vacía</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Las fotos que saque tu kiosco aparecerán aquí.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === DISEÑADOR VISUAL Y PREVIEW === */}
              {activeTab === 'design' && (
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  
                  {/* Builders Panel */}
                  <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                      <h2 style={{margin: 0}}>Kit de Identidad</h2>
                      {isSaving && <span style={{color: '#64748b', fontSize: '0.8rem'}}>Tus cambios se guardan solos automáticamente...</span>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', maxWidth: '600px' }}>
                      
                      {/* Section 1 */}
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Type size={18}/> Bienvenida</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <input placeholder="Título (Ej: Bienvenidos a la boda)" value={selectedEvent.welcome_title || ''} onChange={e => updateEventConfigBulk({ welcome_title: e.target.value })} style={inputStyle} />
                          <textarea placeholder="Subtítulo introductorio" value={selectedEvent.welcome_subtitle || ''} onChange={e => updateEventConfigBulk({ welcome_subtitle: e.target.value })} style={{...inputStyle, resize: 'vertical'}} rows="2"/>
                          <input placeholder="Texto del botón" value={selectedEvent.welcome_button_text || ''} onChange={e => updateEventConfigBulk({ welcome_button_text: e.target.value })} style={inputStyle} />
                        </div>
                      </div>

                      {/* Section 2 */}
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Palette size={18}/> Colores y Temas</h3>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={{flex: 1}}>
                            <label style={labelStyle}>Color Principal</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input type="color" value={selectedEvent.primary_color || '#ec4899'} onChange={e => updateEventConfigBulk({ primary_color: e.target.value })} style={{ width: '40px', height: '40px', padding: 0, border: 'none' }} />
                              <input type="text" value={selectedEvent.primary_color || '#ec4899'} onChange={e => updateEventConfigBulk({ primary_color: e.target.value })} style={inputStyle} />
                            </div>
                          </div>
                          <div style={{flex: 1}}>
                            <label style={labelStyle}>Tipografía Gratuita</label>
                            <select value={selectedEvent.font_family || 'Inter'} onChange={e => updateEventConfigBulk({ font_family: e.target.value })} style={inputStyle}>
                              <option value="Inter">Inter (Elegante y Limpia)</option>
                              <option value="Montserrat">Montserrat (Geométrica)</option>
                              <option value="Playfair Display">Playfair (Bodas y formal)</option>
                              <option value="Outfit">Outfit (Moderna)</option>
                            </select>
                          </div>
                        </div>
                        
                        <label style={labelStyle}>Subir Logo del Evento (PNG/JPG)</label>
                        <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'events', selectedEvent.id, 'logo_url')} style={inputStyle} />

                        <label style={{...labelStyle, marginTop: '1rem'}}>Tema Predefinido (LumaBooth Style)</label>
                        <select 
                          value={selectedEvent.selected_theme_id || 'default'} 
                          onChange={e => updateEventConfigBulk({ selected_theme_id: e.target.value })} 
                          style={inputStyle}
                        >
                          <option value="default">Personalizado (Usa tu imagen)</option>
                          <option value="sunset">Sunset (Naranja/Rosa)</option>
                          <option value="ocean">Ocean (Azul Profundo)</option>
                          <option value="royal">Royal (Oscuro Elegante)</option>
                          <option value="candy">Candy (Pastel)</option>
                          <option value="amethyst">Amethyst (Violeta)</option>
                          <option value="jungle">Jungle (Verde)</option>
                        </select>
                      </div>

                      {/* Section 3 */}
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileImage size={18}/> Fondo Kiosco</h3>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                          <div>
                            <div style={{fontWeight: 'bold', fontSize: '0.9rem'}}>Cámara en Vivo en el Fondo</div>
                            <div style={{fontSize: '0.75rem', color: '#64748b'}}>Muestra la cámara del usuario con un blur</div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={selectedEvent.show_live_camera_bg || false} 
                            onChange={e => updateEventConfigBulk({ show_live_camera_bg: e.target.checked })}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: selectedEvent.selected_theme_id === 'default' ? 1 : 0.5 }}>
                          <label style={labelStyle}>Subir Imagen de Fondo (Wallpaper)</label>
                          <input 
                            disabled={selectedEvent.selected_theme_id !== 'default'}
                            type="file" accept="image/*" onChange={e => handleImageUpload(e, 'events', selectedEvent.id, 'background_url')} style={inputStyle} 
                          />
                          {selectedEvent.background_url && <a href={selectedEvent.background_url} target="_blank" style={{fontSize: '0.75rem', color: '#3b82f6'}}>Ver Fondo Actual</a>}
                          
                          <div style={{ display: 'flex', gap: '2rem' }}>
                            <div style={{flex: 1}}>
                              <label style={labelStyle}>Oscurecimiento</label>
                              <input type="range" min="0" max="0.9" step="0.1" value={selectedEvent.bg_opacity || 0} onChange={e => updateEventConfigBulk({ bg_opacity: parseFloat(e.target.value) })} style={{width: '100%'}}/>
                            </div>
                            <div style={{flex: 1}}>
                              <label style={labelStyle}>Blur (Desenfoque)</label>
                              <input type="range" min="0" max="20" step="1" value={selectedEvent.bg_blur || 0} onChange={e => updateEventConfigBulk({ bg_blur: parseInt(e.target.value) })} style={{width: '100%'}}/>
                            </div>
                          </div>
                        </div>
                        {selectedEvent.selected_theme_id !== 'default' && (
                          <p style={{fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.5rem'}}>⚠️ El tema seleccionado sobrepasa la imagen de fondo personalizada.</p>
                        )}
                      </div>

                      {/* Section 4 — Tiempos y Captura */}
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Smartphone size={18}/> Configuración de Captura</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                              <span>Cuenta regresiva inicial</span>
                              <span style={{fontWeight: 'bold'}}>{selectedEvent.countdown_first_photo || 5} seg</span>
                            </div>
                            <input type="range" min="1" max="15" step="1" 
                              value={selectedEvent.countdown_first_photo || 5} 
                              onChange={e => updateEventConfigBulk({ countdown_first_photo: parseInt(e.target.value) })}
                              style={{width: '100%', accentColor: '#ec4899'}}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                              <span>Intervalo entre fotos</span>
                              <span style={{fontWeight: 'bold'}}>{selectedEvent.countdown_next_photos || 3} seg</span>
                            </div>
                            <input type="range" min="1" max="15" step="1" 
                              value={selectedEvent.countdown_next_photos || 3} 
                              onChange={e => updateEventConfigBulk({ countdown_next_photos: parseInt(e.target.value) })}
                              style={{width: '100%', accentColor: '#ec4899'}}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            <div>
                              <div style={{fontWeight: 'bold', fontSize: '0.9rem'}}>Habilitar Pegatinas</div>
                              <div style={{fontSize: '0.75rem', color: '#64748b'}}>Permite a los usuarios decorar sus fotos</div>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={selectedEvent.enable_stickers !== false} 
                              onChange={e => updateEventConfigBulk({ enable_stickers: e.target.checked })}
                              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 5 — Opciones de Salida */}
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '2px solid #3b82f6', marginTop: '1rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1d4ed8' }}><RefreshCcw size={18}/> Opciones de Salida</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={sharedToggleStyleAdmin}>
                            <span>QR Code</span>
                            <input type="checkbox" checked={selectedEvent.enable_qr !== false} onChange={e => updateEventConfigBulk({ enable_qr: e.target.checked })} />
                          </div>
                          <div style={sharedToggleStyleAdmin}>
                            <span>WhatsApp</span>
                            <input type="checkbox" checked={selectedEvent.enable_whatsapp !== false} onChange={e => updateEventConfigBulk({ enable_whatsapp: e.target.checked })} />
                          </div>
                          <div style={sharedToggleStyleAdmin}>
                            <span>Email</span>
                            <input type="checkbox" checked={selectedEvent.enable_email !== false} onChange={e => updateEventConfigBulk({ enable_email: e.target.checked })} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            <span style={{fontWeight: 'bold', fontSize: '0.9rem'}}>Habilitar Impresión</span>
                            <input type="checkbox" checked={selectedEvent.enable_print !== false} onChange={e => updateEventConfigBulk({ enable_print: e.target.checked })} style={{width: 20, height: 20}} />
                          </div>
                          
                          {selectedEvent.enable_print !== false && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ecfdf5', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.75rem' }}>
                              <div>
                                <span style={{fontWeight: 'bold', fontSize: '0.9rem', display: 'block', color: '#065f46'}}>Lanzar Impresión Automática</span>
                                <span style={{fontSize: '0.7rem', color: '#059669'}}>Imprime directamente al tomar la foto sin esperar confirmación</span>
                              </div>
                              <input type="checkbox" checked={!!selectedEvent.print_auto_start} onChange={e => updateEventConfigBulk({ print_auto_start: e.target.checked })} style={{width: 20, height: 20, accentColor: '#059669'}} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 6 — Configuración Física de Impresora */}
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>🖨 Configuración de Impresora</h3>
                          <button onClick={fetchStations} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <RefreshCcw size={13} /> Actualizar
                          </button>
                        </div>
                        
                        {/* Estaciones de impresión detectadas */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={labelStyle}>Estaciones de Impresión</label>
                          {stations.length === 0 ? (
                            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '0.75rem', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#92400e' }}>Ninguna estación conectada</div>
                                <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Iniciá el servidor local (<code>npm start</code> en /print-server) para detectar impresoras.</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {stations.map(s => {
                                const isOnline = new Date() - new Date(s.last_seen) < 120000;
                                return (
                                  <div key={s.id} style={{ background: '#f8fafc', border: `1px solid ${isOnline ? '#86efac' : '#fca5a5'}`, borderRadius: '0.75rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isOnline ? '#16a34a' : '#dc2626', flexShrink: 0, boxShadow: isOnline ? '0 0 6px #16a34a' : 'none' }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{s.name}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {(s.available_printers || []).length} impresora(s) · última actividad: {new Date(s.last_seen).toLocaleTimeString()}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button 
                                        onClick={async () => {
                                          const p = selectedEvent.selected_printer_name;
                                          if(!p) return alert('Selecciona primero la impresora en el desplegable de abajo.');
                                          await supabase.from('print_jobs').insert([{ event_id: selectedEvent.id, status: 'command_config', adjustments: { command: 'OPEN_PROPERTIES', printer: p } }]);
                                          alert('🚀 Orden de apertura enviada a Windows');
                                        }}
                                        style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                      >
                                        🔧 CONFIGURAR
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if(confirm('¿Eliminar esta estación?')) {
                                            await supabase.from('printer_stations').delete().eq('id', s.id);
                                            fetchStations();
                                          }
                                        }}
                                        style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer' }}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Impresora + Límite */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={labelStyle}>Impresora Destino</label>
                            <select style={inputStyle} value={selectedEvent.selected_printer_name || ''} onChange={e => updateEventConfigBulk({ selected_printer_name: e.target.value })}>
                              <option value="">⚙️ Predeterminada del Sistema / AirPrint</option>
                              {stations.map(s => (s.available_printers || []).map(p => (
                                <option key={`${s.id}-${p}`} value={p}>🖨 {p}  ({s.name})</option>
                              )))}
                            </select>
                            {selectedEvent.selected_printer_name && (
                              <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.3rem' }}>✓ {selectedEvent.selected_printer_name}</p>
                            )}
                          </div>
                        </div>

                        {/* Formato de papel — tarjetas visuales */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={labelStyle}>Formato de Papel</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
                            {[
                              { value: '4x6in', label: '4×6"', desc: 'Estándar', h: 48, w: 32 },
                              { value: '2x6in', label: '2×6"', desc: 'Strip', h: 48, w: 16 },
                              { value: '6x8in', label: '6×8"', desc: 'Grande', h: 40, w: 32 },
                              { value: 'A4',    label: 'A4',   desc: 'Papel Normal', h: 45, w: 32 },
                            ].map(ps => {
                              const sel = (selectedEvent.selected_paper_size || '4x6in') === ps.value;
                              return (
                                <button key={ps.value} onClick={() => updateEventConfigBulk({ selected_paper_size: ps.value })} style={{ background: sel ? '#eff6ff' : '#f8fafc', border: `2px solid ${sel ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '0.875rem 0.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s' }}>
                                  <div style={{ width: ps.w, height: ps.h, background: sel ? '#3b82f6' : '#cbd5e1', borderRadius: '2px' }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: sel ? '#1d4ed8' : '#0f172a' }}>{ps.label}</span>
                                  <span style={{ fontSize: '0.65rem', color: sel ? '#3b82f6' : '#64748b' }}>{ps.desc}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Escala + Auto-print + Test */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                          <div>
                            <label style={labelStyle}>Escala de Impresión</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <input type="range" min="70" max="130" value={selectedEvent.print_scale || 100} onChange={e => updateEventConfigBulk({ print_scale: parseInt(e.target.value) })} style={{ flex: 1 }} />
                              <span style={{ fontWeight: 700, minWidth: '3.5rem' }}>{selectedEvent.print_scale || 100}%</span>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.25rem 0 0' }}>Ajustá si la imagen queda cortada o con bordes blancos.</p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.75rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                                <input type="checkbox" checked={selectedEvent.print_auto_start || false} onChange={e => updateEventConfigBulk({ print_auto_start: e.target.checked })} style={{ width: 18, height: 18 }} />
                                Imprimir automáticamente
                              </label>
                              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.25rem 0 0 1.85rem' }}>Sin confirmación manual del operador.</p>
                            </div>
                            <button
                              onClick={async () => {
                                const { error } = await supabase.from('print_jobs').insert([{
                                  event_id: selectedEvent.id,
                                  raw_photo_urls: ['https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800'],
                                  filter_name: 'none',
                                  adjustments: { brightness: 0, contrast: 0, saturation: 0 },
                                  frames_config: [{ x: 5, y: 5, w: 90, h: 78 }],
                                  stickers_data: [],
                                  status: 'pending_render'
                                }]);
                                if (error) alert('Error: ' + error.message);
                                else alert('✅ Impresión de prueba enviada a la cola.');
                              }}
                              style={{ padding: '0.875rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                              🖨 Enviar Impresión de Prueba
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Mobile Live Simulator */}
                  <div style={{ width: '450px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                    
                    <div style={{ 
                      width: '375px', height: '667px', 
                      backgroundColor: '#222', borderRadius: '40px', overflow: 'hidden',
                      position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '8px solid #1e293b'
                    }}>
                      
                      {/* SIMULADO DEL KIOSCO INVITADO */}
                      <div style={{ 
                        width: '100%', height: '100%', 
                        background: (() => {
                          const themes = {
                            sunset:    'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
                            ocean:     'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
                            royal:     'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
                            candy:     'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
                            amethyst:  'linear-gradient(135deg, #9d50bb 0%, #6e48aa 100%)',
                            jungle:    'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                          };
                          const selected = selectedEvent.selected_theme_id;
                          if (selected && themes[selected]) return themes[selected];
                          return `url('${selectedEvent.background_url}') center/cover no-repeat`;
                        })(),
                        position: 'relative', fontFamily: selectedEvent.font_family
                      }}>
                        
                        {/* Simulación Cámara en Vivo */}
                        {selectedEvent.show_live_camera_bg && (
                          <div style={{ 
                            position: 'absolute', inset: 0, 
                            background: 'rgba(255,255,255,0.1)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 0
                          }}>
                             <Smartphone size={64} style={{opacity: 0.2, color: '#fff'}} />
                          </div>
                        )}
                        
                        {/* Capa de Blur Dinámico */}
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: `rgba(0,0,0,${selectedEvent.bg_opacity || 0})`,
                          backdropFilter: `blur(${selectedEvent.bg_blur || 0}px)`, zIndex: 1
                        }}></div>

                        {/* Capa de UI Frontal Glassmorphism */}
                        <div style={{
                          position: 'absolute', top: '10%', left: '5%', right: '5%', bottom: '10%',
                          background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(16px)',
                          border: '1px solid rgba(255,255,255,0.4)', borderRadius: '2rem',
                          zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', color: '#fff'
                        }}>
                          {selectedEvent.logo_url && (
                            <img src={selectedEvent.logo_url} alt="Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid white', marginBottom: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }} />
                          )}
                          <h1 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{selectedEvent.welcome_title}</h1>
                          <p style={{ fontSize: '1rem', margin: '0 0 3rem 0', opacity: 0.9 }}>{selectedEvent.welcome_subtitle}</p>

                          <button style={{
                            width: '100%', background: selectedEvent.primary_color, color: '#fff',
                            border: 'none', padding: '1.25rem', borderRadius: '99px', fontSize: '1.1rem',
                            fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'default', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                          }}>
                            {selectedEvent.welcome_button_text}
                          </button>
                        </div>
                      </div>

                      {/* Notcha simulada */}
                      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '25px', backgroundColor: '#1e293b', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem', zIndex: 10 }}></div>
                    </div>

                  </div>
                </div>
              )}

              {/* === 🔐 HABILITACIÓN DEL EVENTO === */}
              {activeTab === 'access' && (() => {
                const mode = selectedEvent.access_mode || 'open';
                const modeOptions = [
                  { value: 'open',        icon: '🔓', label: 'Abierto',         desc: 'Cualquier persona puede usar el kiosco sin restricciones.' },
                  { value: 'code',        icon: '🔑', label: 'Código de acceso', desc: 'Los invitados deben ingresar un código que vos les das.' },
                  { value: 'time_based',  icon: '⏰', label: 'Por horario',      desc: 'El kiosco solo funciona dentro de una ventana de tiempo.' },
                  { value: 'paid_photo',  icon: '💳', label: 'Pago por foto',    desc: 'Cada sesión requiere un token que generás después del pago.' },
                ];
                return (
                  <div style={{ padding: '2rem', maxWidth: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                      <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Lock size={20} /> Habilitación del Evento
                      </h2>
                      {/* Override rápido */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: selectedEvent.manual_override_open ? '#dcfce7' : '#f1f5f9', border: `1px solid ${selectedEvent.manual_override_open ? '#86efac' : '#e2e8f0'}`, padding: '0.5rem 1rem', borderRadius: '99px', fontWeight: 600, fontSize: '0.85rem', color: selectedEvent.manual_override_open ? '#15803d' : '#475569' }}>
                        <input type="checkbox" checked={selectedEvent.manual_override_open || false}
                          onChange={e => updateEventConfigBulk({ manual_override_open: e.target.checked })}
                          style={{ accentColor: '#16a34a' }}
                        />
                        {selectedEvent.manual_override_open ? '✅ Forzado abierto' : 'Override manual'}
                      </label>
                    </div>

                    {/* Modo selector — tarjetas */}
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modo de acceso</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                        {modeOptions.map(opt => {
                          const sel = mode === opt.value;
                          return (
                            <button key={opt.value} onClick={() => updateEventConfigBulk({ access_mode: opt.value })} style={{
                              textAlign: 'left', padding: '1rem', borderRadius: '0.75rem', cursor: 'pointer',
                              border: `2px solid ${sel ? '#3b82f6' : '#e2e8f0'}`,
                              background: sel ? '#eff6ff' : '#f8fafc',
                              transition: 'all 0.15s',
                            }}>
                              <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{opt.icon}</div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: sel ? '#1d4ed8' : '#0f172a' }}>{opt.label}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: 1.4 }}>{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Estado del evento */}
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Estado del evento</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Desactivar oculta el kiosco completamente</div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                          <input type="checkbox" checked={selectedEvent.is_active !== false}
                            onChange={e => updateEventConfigBulk({ is_active: e.target.checked })}
                            style={{ width: 18, height: 18 }}
                          />
                          {selectedEvent.is_active !== false ? '🟢 Activo' : '🔴 Desactivado'}
                        </label>
                      </div>
                      <div style={{ marginTop: '1rem' }}>
                        <label style={labelStyle}>Mensaje cuando está cerrado</label>
                        <input value={selectedEvent.access_locked_message || ''} style={inputStyle}
                          placeholder="Ej: El kiosco abre a las 21hs. ¡Gracias!"
                          onChange={e => updateEventConfigBulk({ access_locked_message: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* ── Modo: CÓDIGO ── */}
                    {mode === 'code' && (
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '2px solid #f59e0b', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}>🔑 Código de Acceso</h3>
                        <label style={labelStyle}>Código único del evento</label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <input value={selectedEvent.access_code || ''} style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '1.25rem', fontWeight: 700 }}
                            placeholder="FIESTA2026"
                            onChange={e => updateEventConfigBulk({ access_code: e.target.value.toUpperCase() })}
                          />
                          <button onClick={() => {
                            const r = Math.random().toString(36).slice(2, 8).toUpperCase();
                            updateEventConfigBulk({ access_code: r });
                          }} style={{ padding: '0 1rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Generar
                          </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                          Este código se lo mostrás o imprimís a los invitados. No distingue mayúsculas/minúsculas.
                        </p>
                      </div>
                    )}

                    {/* ── Modo: HORARIO ── */}
                    {mode === 'time_based' && (
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '2px solid #8b5cf6', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c3aed' }}><Clock size={18} /> Ventana Horaria</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                          <div>
                            <label style={labelStyle}>🟢 Apertura</label>
                            <input type="datetime-local" style={inputStyle}
                              value={selectedEvent.access_start_at ? new Date(selectedEvent.access_start_at).toISOString().slice(0,16) : ''}
                              onChange={e => updateEventConfigBulk({ access_start_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>🔴 Cierre</label>
                            <input type="datetime-local" style={inputStyle}
                              value={selectedEvent.access_end_at ? new Date(selectedEvent.access_end_at).toISOString().slice(0,16) : ''}
                              onChange={e => updateEventConfigBulk({ access_end_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                            />
                          </div>
                        </div>
                        {selectedEvent.access_start_at && selectedEvent.access_end_at && (() => {
                          const now = new Date();
                          const start = new Date(selectedEvent.access_start_at);
                          const end = new Date(selectedEvent.access_end_at);
                          const isOpen = now >= start && now <= end;
                          return (
                            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: isOpen ? '#dcfce7' : '#fef3c7', border: `1px solid ${isOpen ? '#86efac' : '#fbbf24'}`, fontSize: '0.85rem', fontWeight: 600, color: isOpen ? '#15803d' : '#92400e' }}>
                              {isOpen ? '🟢 El kiosco está abierto ahora' : (now < start ? '⏰ Todavía no comenzó' : '🏁 El evento ya terminó')}
                            </div>
                          );
                        })()}
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem' }}>
                          Usá la hora local de tu dispositivo. Se guarda en UTC automáticamente.
                        </p>
                      </div>
                    )}

                    {/* ── Modo: PAGO POR FOTO ── */}
                    {mode === 'paid_photo' && (
                      <>
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '2px solid #10b981', marginBottom: '1.5rem' }}>
                          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857' }}><CreditCard size={18} /> Configuración de Precio</h3>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div>
                              <label style={labelStyle}>Moneda</label>
                              <select style={inputStyle} value={selectedEvent.currency || 'ARS'} onChange={e => updateEventConfigBulk({ currency: e.target.value })}>
                                <option value="ARS">ARS (Pesos)</option>
                                <option value="USD">USD (Dólares)</option>
                                <option value="BRL">BRL (Reales)</option>
                                <option value="CLP">CLP (Pesos CL)</option>
                                <option value="MXN">MXN (Pesos MX)</option>
                              </select>
                            </div>
                            <div>
                              <label style={labelStyle}>Precio por sesión</label>
                              <input type="number" min="0" style={inputStyle}
                                value={selectedEvent.price_per_session || 0}
                                onChange={e => updateEventConfigBulk({ price_per_session: parseFloat(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Fotos por sesión</label>
                              <input type="number" min="1" max="10" style={inputStyle}
                                value={selectedEvent.photos_per_session || 1}
                                onChange={e => updateEventConfigBulk({ photos_per_session: parseInt(e.target.value) })}
                              />
                            </div>
                          </div>
                          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#ecfdf5', borderRadius: '0.5rem', fontSize: '0.9rem', color: '#047857', fontWeight: 600 }}>
                            💡 El invitado ve: <strong>{selectedEvent.currency || 'ARS'} {(selectedEvent.price_per_session || 0).toLocaleString('es-AR')}</strong> por {selectedEvent.photos_per_session || 1} foto(s)
                          </div>
                        </div>

                        {/* Generador de Tokens */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                          <h3 style={{ margin: '0 0 1rem 0' }}>🎟 Generar Tokens de Sesión</h3>
                          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                            Cada vez que alguien paga, generás un token único y se lo das. El invitado lo ingresa en el kiosco para desbloquear su sesión.
                          </p>
                          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <input value={newToken} onChange={e => setNewToken(e.target.value.toUpperCase())}
                              placeholder="Opcional: escribí o dejá vacío para auto-generar"
                              maxLength={12} style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em' }}
                            />
                            <button onClick={generateToken} disabled={generatingToken} style={{ padding: '0 1.25rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', opacity: generatingToken ? 0.7 : 1 }}>
                              {generatingToken ? '...' : '+ Crear Token'}
                            </button>
                          </div>

                          {/* Lista de tokens existentes */}
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Tokens activos ({sessions.length})</h4>
                          {sessions.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>Aún no hay tokens generados. Creá uno arriba cuando alguien pague.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 280, overflowY: 'auto' }}>
                              {sessions.map(s => {
                                const used = s.photos_used >= s.photos_allowed;
                                return (
                                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: used ? '#fef2f2' : '#f8fafc', border: `1px solid ${used ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '0.5rem' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.15em', color: used ? '#dc2626' : '#0f172a', flex: 1 }}>
                                      {s.token}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                      {s.photos_used}/{s.photos_allowed} foto(s)
                                    </span>
                                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '99px', fontWeight: 600, background: used ? '#fee2e2' : '#dcfce7', color: used ? '#991b1b' : '#166534' }}>
                                      {used ? 'USADO' : 'DISPONIBLE'}
                                    </span>
                                    <button onClick={() => deleteSession(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: '0.25rem', lineHeight: 1 }} title="Eliminar">✕</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button onClick={() => fetchSessions(selectedEvent.id)} style={{ marginTop: '1rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                            <RefreshCcw size={13} /> Actualizar lista
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* === PLANTILLAS MAKER === */}
              {activeTab === 'templates' && (
                <div style={{ display: 'flex', height: '100%' }}>
                  
                  {/* Lista y Edición */}
                  <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <h2 style={{margin: 0}}>Mis Plantillas</h2>
                      <button onClick={createBlankTemplate} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16}/> Nueva Plantilla
                      </button>
                    </div>

                    {!editingTemplate ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {templates.map(t => (
                          <div key={t.id} onClick={() => setEditingTemplate(t)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: '150px', backgroundImage: `url(${t.base_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                            <div style={{ padding: '1rem', fontWeight: 'bold', borderTop: '1px solid #e2e8f0' }}>{t.name} (Marco de {t.photo_count} fotos)</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', maxWidth: '600px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                           <button onClick={() => setEditingTemplate(null)} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer' }}>← Volver a la Lista</button>
                           <button onClick={() => deleteTemplate(editingTemplate.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer' }}>Eliminar Plantilla</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div><label style={labelStyle}>Nombre de la Plantilla</label><input value={editingTemplate.name} onChange={e => updateTemplateBulk(editingTemplate.id, { name: e.target.value })} style={inputStyle} /></div>
                          <div>
                            <label style={labelStyle}>Subir Fondo de Diseño (JPG o PNG del evento)</label>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>Las fotos se pondrán ENCIMA de esta imagen con borde blanco automático.</p>
                            <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'templates', editingTemplate.id, 'base_image_url')} style={inputStyle} />
                            {editingTemplate.base_image_url && <a href={editingTemplate.base_image_url} target="_blank" style={{fontSize: '0.75rem', color: '#3b82f6'}}>Ver Fondo Actual ↗</a>}
                          </div>
                        </div>

                        <div style={{ margin: '2rem 0', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0' }}>Autocompletado Rápido</h4>
                          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>Elige un "Layout" estándar para rellenar las coordenadas automáticamente:</p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => loadPreset('simple1')} style={{ padding: '0.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}>Simple (1)</button>
                            <button onClick={() => loadPreset('pose2')} style={{ padding: '0.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}>Doble (2)</button>
                            <button onClick={() => loadPreset('strip3')} style={{ padding: '0.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}>Strip (3)</button>
                            <button onClick={() => loadPreset('grid4')} style={{ padding: '0.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}>Grid (4)</button>
                          </div>
                        </div>
                        <h3 style={{ margin: '2rem 0 1rem 0' }}>Posición de las Fotos</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Define dónde aparecerán las fotos (con borde blanco) ENCIMA del fondo de diseño. Usa los Presets de arriba o edita manualmente.</p>
                        
                        {Array.isArray(editingTemplate.frames_config) && editingTemplate.frames_config.map((frame, index) => (
                          <div key={index} style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', position: 'relative' }}>
                            <h4 style={{ margin: '0 0 1rem 0' }}>Foto #{index + 1}</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                              <div><label style={labelStyle}>Punto X (%)</label><input type="number" value={frame.x} onChange={e => { const copy = [...editingTemplate.frames_config]; copy[index].x = parseFloat(e.target.value); updateTemplateBulk(editingTemplate.id, { frames_config: copy }); }} style={inputStyle} /></div>
                              <div><label style={labelStyle}>Punto Y (%)</label><input type="number" value={frame.y} onChange={e => { const copy = [...editingTemplate.frames_config]; copy[index].y = parseFloat(e.target.value); updateTemplateBulk(editingTemplate.id, { frames_config: copy }); }} style={inputStyle} /></div>
                              <div><label style={labelStyle}>Ancho (%)</label><input type="number" value={frame.width} onChange={e => { const copy = [...editingTemplate.frames_config]; copy[index].width = parseFloat(e.target.value); updateTemplateBulk(editingTemplate.id, { frames_config: copy }); }} style={inputStyle} /></div>
                              <div><label style={labelStyle}>Alto (%)</label><input type="number" value={frame.height} onChange={e => { const copy = [...editingTemplate.frames_config]; copy[index].height = parseFloat(e.target.value); updateTemplateBulk(editingTemplate.id, { frames_config: copy }); }} style={inputStyle} /></div>
                            </div>
                            <button 
                              onClick={() => { const copy = editingTemplate.frames_config.filter((_, i) => i !== index); updateTemplateBulk(editingTemplate.id, { frames_config: copy, photo_count: copy.length }); }}
                              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', marginTop: '1rem', cursor: 'pointer' }}>Borrar este cuadro</button>
                          </div>
                        ))}
                        <button onClick={() => { const copy = [...(editingTemplate.frames_config || []), { id: Date.now(), x: 10, y: 10, width: 40, height: 40, borderRadius: 0 }]; updateTemplateBulk(editingTemplate.id, { frames_config: copy, photo_count: copy.length }); }} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>+ Agregar Manualmente (Frame)</button>
                      </div>
                    )}
                  </div>

                  {/* Simulador Visual del Layout */}
                  {editingTemplate && (
                    <div style={{ width: '380px', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1rem' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>Vista previa del diseño impreso</p>
                      <div style={{ 
                        width: '260px', height: '390px',
                        position: 'relative', overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        border: '4px solid #1e293b',
                        // Fondo de diseño del evento
                        backgroundImage: editingTemplate.base_image_url ? `url('${editingTemplate.base_image_url}')` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        backgroundColor: '#111'
                      }}>
                        {/* Fotos simuladas con borde blanco */}
                        {Array.isArray(editingTemplate.frames_config) && editingTemplate.frames_config.map((frame, idx) => (
                           <div key={idx} style={{
                             position: 'absolute',
                             top: `${frame.y}%`, left: `${frame.x}%`,
                             width: `${frame.width}%`, height: `${frame.height}%`,
                             background: '#fff',
                             boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             fontSize: '1.2rem'
                           }}>
                             📷
                           </div>
                        ))}
                      </div>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, textAlign: 'center' }}>Los cuadros blancos son donde<br/>irán las fotos de tus invitados</p>
                    </div>
                  )}

                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Estilos globales de ayuda para inputs
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' };
const labelStyle = { display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#475569', fontWeight: 'bold' };
const sharedToggleStyleAdmin = { 
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
  background: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' 
};
