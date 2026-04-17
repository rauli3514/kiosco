import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCcw, Camera, X, Check, Heart, Star, Sparkles, Printer, Download, Share2 } from 'lucide-react';

// --- CONFIGURACIÓN BASE ---
const FILTERS = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'bw', label: 'B&N', css: 'grayscale(100%)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(60%) saturate(80%) brightness(105%)' },
  { id: 'auto', label: '✨ Auto', css: 'brightness(108%) saturate(115%) contrast(105%)' },
];

const PRESETS = {
  1: [{ x: 4, y: 4, w: 92, h: 78 }],
  2: [{ x: 4, y: 4, w: 92, h: 44 }, { x: 4, y: 52, w: 92, h: 44 }],
  3: [{ x: 4, y: 3, w: 92, h: 29 }, { x: 4, y: 35, w: 92, h: 29 }, { x: 4, y: 67, w: 92, h: 29 }],
  4: [{ x: 3, y: 3, w: 46, h: 45 }, { x: 51, y: 3, w: 46, h: 45 }, { x: 3, y: 51, w: 46, h: 45 }, { x: 51, y: 51, w: 46, h: 45 }],
};

const JOB_STATUS = {
  pending_render:  { emoji: '🎨', label: 'Procesando diseño...', description: 'Estamos uniendo tus fotos' },
  rendering:       { emoji: '⚙️', label: 'Generando imagen...', description: 'Casi listo' },
  pending_print:   { emoji: '🖨️', label: 'En cola para imprimir', description: 'Por favor, espera tu turno' },
  printing:        { emoji: '📄', label: 'Imprimiendo ahora...', description: '¡Tu foto está saliendo!' },
  completed:       { emoji: '✅', label: '¡Impresa con éxito!', description: 'Retirala en el tótem' },
  error:           { emoji: '❌', label: 'Error de proceso', description: 'Reintenta o avisa al staff' },
};

// --- COMPONENTES ATÓMICOS ---
const Screen = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(2, 6, 23, 0.4)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2.5rem', padding: '2.5rem 2rem', width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
    animation: 'zoomFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)', ...style
  }}>{children}</div>
);

const Btn = ({ children, color, onClick, disabled, large, pulse }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: '100%', padding: large ? '1.25rem' : '1rem', borderRadius: '1.25rem', border: 'none',
    background: disabled ? 'rgba(255,255,255,0.05)' : (color || '#3b82f6'),
    color: (color === '#fff' || color === '#ffffff') ? '#000' : '#fff',
    fontSize: large ? '1.1rem' : '0.9rem', fontWeight: 800, cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.2s', boxShadow: disabled ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.3)',
    animation: pulse ? 'btnPulse 2s infinite' : 'none'
  }}>{children}</button>
);

const H2 = ({ children }) => <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.5rem', textAlign: 'center', color: '#fff' }}>{children}</h2>;

// --- COMPONENTE PRINCIPAL ---
export default function Booth() {
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState('welcome');
  const [format, setFormat] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [filterName, setFilterName] = useState('none');
  const [jobId, setJobId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Carga inicial del evento
  useEffect(() => {
    const slug = (window.location.pathname + window.location.search).split('/').pop() || 'demo';
    supabase.from('events').select('*, event_templates(*)').eq('slug', slug.replace('?', '')).single()
      .then(({ data }) => { if(data) setEvent(data); });
  }, []);

  // Lógica de Timeout (Vuelve al inicio si nadie toca nada)
  useEffect(() => {
    if (step === 'welcome') return;
    const timeoutSecs = event?.session_timeout || 90;
    const check = setInterval(() => {
      if (Date.now() - lastActivity > timeoutSecs * 1000) {
        resetBooth();
      }
    }, 5000);
    return () => clearInterval(check);
  }, [step, lastActivity, event]);

  const recordActivity = () => setLastActivity(Date.now());
  const resetBooth = () => {
    setStep('welcome'); setPhotos([]); setFormat(null); setJobId(null); setFilterName('none');
  };

  const currentPrimary = event?.primary_color || '#3b82f6';

  if (!event) return <div style={{ height: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📡 Conectando estación...</div>;

  return (
    <div 
      onClick={recordActivity}
      style={{
        height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        background: event.selected_theme_id === 'default' ? `#000 url(${event.background_url}) center/cover no-repeat` : 'black',
        fontFamily: '"Outfit", sans-serif', position: 'relative'
      }}
    >
      {/* CAPA DE COLOR EVENTOS */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${currentPrimary}22 0%, rgba(0,0,0,0.8) 100%)`, zIndex: 0 }} />

      <main style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
        
        {/* STEP: BIENVENIDA */}
        {step === 'welcome' && (
          <Screen>
             {event.logo_url && <img src={event.logo_url} style={{ width: 100, height: 100, borderRadius: '50%', border: '4px solid #fff', marginBottom: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />}
             <H2>{event.welcome_title || 'Bienvenidos'}</H2>
             <p style={{ color: '#fff', opacity: 0.8, textAlign: 'center', marginBottom: '2.5rem', fontSize: '1.1rem' }}>{event.welcome_subtitle || 'Toca el botón para empezar'}</p>
             <Btn color={currentPrimary} large pulse onClick={() => setStep('formato')}>
               📸 {event.welcome_button_text || 'SACAR FOTO'}
             </Btn>
          </Screen>
        )}

        {/* STEP: FORMATOS */}
        {step === 'formato' && (
          <Screen>
            <H2>Elegí tu diseño</H2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '100%', marginBottom: '2rem' }}>
              {(event.event_templates?.length ? event.event_templates : [1,2,3,4]).map((t, i) => {
                const count = t.photo_count || t;
                const frames = t.frames_config || PRESETS[count];
                return (
                  <button key={i} onClick={() => { setFormat(t); setStep('capture'); }} style={{
                    background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '1.5rem', cursor: 'pointer'
                  }}>
                    <div style={{ width: '100%', aspectRatio: '2/3', background: '#111', borderRadius: '0.75rem', position: 'relative', marginBottom: '0.75rem', overflow: 'hidden' }}>
                      {frames.map((f, idx) => <div key={idx} style={{ position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, width: `${f.w || f.width}%`, height: `${f.h || f.height}%`, background: '#fff', borderRadius: 2 }} />)}
                    </div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>{t.name || `${count} Foto(s)`}</div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep('welcome')} style={{ color: '#fff', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer' }}>← Volver</button>
          </Screen>
        )}

        {/* STEP: CAPTURA (SIMPLIFICADO PARA ESTE EJEMPLO) */}
        {step === 'capture' && (
          <CaptureView 
             format={format} 
             primary={currentPrimary} 
             onDone={(captured) => { setPhotos(captured); setStep('preview'); }} 
             onBack={() => setStep('formato')}
          />
        )}

        {/* STEP: PREVIEW Y ENVÍO */}
        {step === 'preview' && (
          <PreviewView 
            photos={photos} 
            format={format} 
            event={event} 
            primary={currentPrimary}
            onSubmit={async (guestName) => {
               setIsSubmitting(true);
               const { data } = await supabase.from('print_jobs').insert([{
                 event_id: event.id,
                 raw_photo_urls: photos.map(p => p.url),
                 status: 'pending_render',
                 adjustments: { guest_name: guestName, short_code: Math.random().toString(36).substring(2, 6).toUpperCase() },
                 frames_config: format.frames_config || PRESETS[format.photo_count || 1]
               }]).select().single();
               if(data) { setJobId(data.id); setStep('status'); }
               setIsSubmitting(false);
            }}
            onBack={() => setStep('capture')}
          />
        )}

        {/* STEP: ESTADO DE COLA */}
        {step === 'status' && <StatusView jobId={jobId} primary={currentPrimary} onReset={resetBooth} />}

      </main>

      <style>{`
        @keyframes zoomFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes btnPulse { 0% { box-shadow: 0 0 0 0 ${currentPrimary}66; } 70% { box-shadow: 0 0 0 20px ${currentPrimary}00; } 100% { box-shadow: 0 0 0 0 ${currentPrimary}00; } }
      `}</style>
    </div>
  );
}

// --- SUB-VIEWS ---
function CaptureView({ format, primary, onDone, onBack }) {
  const [photos, setPhotos] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const total = format.photo_count || 1;

  const takePhoto = () => {
    if(countdown !== null) return;
    setCountdown(3);
    const itv = setInterval(() => setCountdown(c => {
      if(c === 1) { 
        clearInterval(itv); 
        const mockUrl = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=500";
        setPhotos(p => {
          const updated = [...p, { url: mockUrl, preview: mockUrl }];
          if(updated.length >= total) setTimeout(() => onDone(updated), 800);
          return updated;
        });
        return null; 
      }
      return c - 1;
    }), 1000);
  };

  return (
    <Screen>
      <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginBottom: '1.5rem' }}>
        {Array.from({length: total}).map((_, i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i < photos.length ? primary : 'rgba(255,255,255,0.15)' }} />)}
      </div>
      <div style={{ width: '100%', aspectRatio: '3/4', background: '#111', borderRadius: '2rem', overflow: 'hidden', position: 'relative', marginBottom: '2rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ position: 'absolute', inset: 0, border: '6px solid rgba(255,255,255,0.05)', borderRadius: '2rem', pointerEvents: 'none' }} />
        {countdown && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8rem', color: '#fff', fontWeight: 900 }}>{countdown}</div>}
        {!countdown && photos.length < total && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0.3 }}><Camera size={64} /></div>}
      </div>
      <Btn color={primary} large onClick={takePhoto} disabled={countdown !== null || photos.length >= total}>
        {photos.length < total ? '📸 DISPARAR' : 'PROCESANDO...'}
      </Btn>
      <button onClick={onBack} style={{ color: '#fff', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', marginTop: '1.5rem' }}>Regresar</button>
    </Screen>
  );
}

function PreviewView({ photos, format, primary, onSubmit, onBack }) {
  const [name, setName] = useState('');
  return (
    <Screen>
       <H2>¿Cómo te llamas?</H2>
       <input placeholder="Escribe tu nombre..." value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '1.25rem', borderRadius: '1.25rem', border: 'none', background: '#fff', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold', marginBottom: '1.5rem' }} />
       <div style={{ width: '140px', aspectRatio: '2/3', background: '#000', borderRadius: '0.5rem', overflow: 'hidden', border: '2px solid #fff', marginBottom: '2rem', transform: 'rotate(-2deg)' }}>
          <img src={photos[0]?.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
       </div>
       <Btn color={primary} large onClick={() => onSubmit(name)}>🖨 IMPRIMIR AHORA</Btn>
       <button onClick={onBack} style={{ color: '#fff', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', marginTop: '1.5rem' }}>Elegir fotos de nuevo</button>
    </Screen>
  );
}

function StatusView({ jobId, primary, onReset }) {
  const [job, setJob] = useState(null);
  useEffect(() => {
    const itv = setInterval(() => {
      supabase.from('print_jobs').select('*').eq('id', jobId).single().then(({data}) => {
        if(data) setJob(data);
      });
    }, 3000);
    return () => clearInterval(itv);
  }, [jobId]);

  const s = JOB_STATUS[job?.status] || JOB_STATUS.pending_render;
  const isDone = ['completed', 'approved_for_print', 'printing'].includes(job?.status);

  return (
    <Screen>
       <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{s.emoji}</div>
       <H2>{s.label}</H2>
       <p style={{ color: '#fff', opacity: 0.7, textAlign: 'center', marginBottom: '2rem' }}>{s.description}</p>
       <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '1.5rem', width: '100%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tu código de retiro</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: primary }}>{job?.adjustments?.short_code || '---'}</div>
       </div>
       <div style={{ marginTop: '2.5rem', width: '100%' }}>
          <Btn color="rgba(255,255,255,0.1)" onClick={onReset}>VOLVER AL INICIO</Btn>
       </div>
    </Screen>
  );
}
