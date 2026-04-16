import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCcw } from 'lucide-react';

// ─── Filtros disponibles ──────────────────────────────────────────
const FILTERS = [
  { id: 'none',          label: 'Original',       css: 'none' },
  { id: 'bw',            label: 'B&N',             css: 'grayscale(100%)' },
  { id: 'vintage',       label: 'Vintage',         css: 'sepia(60%) saturate(80%) brightness(105%)' },
  { id: 'high_contrast', label: 'Alto Contraste',  css: 'contrast(160%) brightness(108%)' },
  { id: 'auto',          label: '✨ Auto Mejora',  css: 'brightness(108%) saturate(115%) contrast(105%)' },
];

// ─── Temas de LumaBooth ──────────────────────────────────────────
const THEMES = {
  default:   { bg: 'transparent' },
  sunset:    { bg: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' },
  ocean:     { bg: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)' },
  royal:     { bg: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
  candy:     { bg: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)' },
  amethyst:  { bg: 'linear-gradient(135deg, #9d50bb 0%, #6e48aa 100%)' },
  jungle:    { bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
};

// ─── Biblioteca de Pegatinas ─────────────────────────────────────
const STICKERS = [
  { id: 'glasses',   emoji: '🕶️', label: 'Gafas' },
  { id: 'hat',       emoji: '🎩', label: 'Galera' },
  { id: 'heart',     emoji: '❤️', label: 'Amor' },
  { id: 'star',      emoji: '⭐', label: 'Estrellas' },
  { id: 'crown',     emoji: '👑', label: 'Reina' },
  { id: 'mustache',  emoji: '👨🏻‍', label: 'Bigote' },
  { id: 'sparkles',  emoji: '✨', label: 'Brillos' },
  { id: 'camera',    emoji: '📸', label: 'Cámara' },
  { id: 'party',     emoji: '🎉', label: 'Fiesta' },
];

const PRESETS = {
  1: [{ x: 4,  y: 4,  w: 92, h: 78 }],
  2: [{ x: 4,  y: 4,  w: 92, h: 44 }, { x: 4, y: 52, w: 92, h: 44 }],
  3: [{ x: 4,  y: 3,  w: 92, h: 29 }, { x: 4, y: 35, w: 92, h: 29 }, { x: 4, y: 67, w: 92, h: 29 }],
  4: [{ x: 3,  y: 3,  w: 46, h: 45 }, { x: 51, y: 3, w: 46, h: 45 }, { x: 3, y: 51, w: 46, h: 45 }, { x: 51, y: 51, w: 46, h: 45 }],
};

// ─── Modos de acceso ────────────────────────────────────────────
// 'open'       → sin restricciones
// 'code'       → requiere código de acceso
// 'time_based' → habilitado solo en ventana horaria
// 'paid_photo' → requiere token de sesión paga

// ─── Barra de estado del job ──────────────────────────────────────
const JOB_STATUS = {
  pending_render:  { emoji: '🎨', label: 'En espera de procesamiento...' },
  rendering:       { emoji: '⚙️', label: 'Generando tu foto...' },
  pending_print:   { emoji: '🖨️', label: 'Lista para imprimir' },
  printing:        { emoji: '📄', label: 'Imprimiendo ahora...' },
  completed:       { emoji: '✅', label: '¡Impresa con éxito!' },
  error:           { emoji: '❌', label: 'Error. Reintenta.' },
};

const sharedToggleStyle = { 
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
  background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' 
};

// ═══════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════
function Screen({ children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '1.5rem', padding: '2rem 1.75rem', width: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
      animation: 'fadeIn 0.25s ease-out', ...style
    }}>{children}</div>
  );
}

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: '1.25rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current - 1 ? 24 : 8, height: 8, borderRadius: 99,
          background: i < current ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  );
}

function Btn({ children, color, large, onClick, disabled, full = true }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? '100%' : 'auto',
      padding: large ? '1rem 1.5rem' : '0.75rem 1.25rem',
      borderRadius: 99, border: 'none',
      background: disabled ? 'rgba(255,255,255,0.1)' : (color || '#ec4899'),
      color: (color === '#ffffff' || color === '#fff' || !color) ? '#000' : '#fff',
      fontSize: large ? '1.05rem' : '0.9rem', fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
      boxShadow: disabled ? 'none' : '0 8px 20px rgba(0,0,0,0.2)', marginTop: '0.25rem',
      textShadow: (color === '#ffffff' || color === '#fff') ? 'none' : '0 1px 2px rgba(0,0,0,0.2)',
    }}>{children}</button>
  );
}

function BtnGhost({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '0.85rem', borderRadius: 99,
      border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)',
      color: '#fff', fontSize: '0.9rem', cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
      marginTop: '0.25rem',
    }}>{children}</button>
  );
}

function BtnBack({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none',
      color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem',
      cursor: 'pointer', marginTop: '1.25rem', padding: '0.5rem',
    }}>← Volver</button>
  );
}

function Spinner({ size = 36 }) {
  return <div style={{
    width: size, height: size, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: '#fff', animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  }} />;
}

// ─── Componente Cámara en Vivo (Fondo) ────────────────────────────
function LiveCameraBackground({ active }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    let stream;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.warn("No se pudo acceder a la cámara para el fondo:", e);
      }
    };
    start();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [active]);

  if (!active) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', transform: 'scaleX(-1)', zIndex: -1,
        opacity: 0.6,
      }}
    />
  );
}

const H2 = ({ children }) => <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.4rem', textAlign: 'center', lineHeight: 1.2, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{children}</h2>;
const Hint = ({ children }) => <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0 0 1.5rem', textAlign: 'center', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontWeight: 500 }}>{children}</p>;

// ═══════════════════════════════════════════════════════════════════
// ACCESS ENGINE SCREENS
// ═══════════════════════════════════════════════════════════════════

// ── Pantalla: Evento Cerrado / Bloqueado ──────────────────────────
function ScreenLocked({ event }) {
  const msg = event?.access_locked_message || 'Este evento no está disponible en este momento.';
  return (
    <Screen style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
      <H2>{event?.title || 'Evento'}</H2>
      <Hint>{msg}</Hint>
      <div style={{
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '1rem', padding: '1.25rem', fontSize: '0.85rem', opacity: 0.7, color: '#fff'
      }}>
        Consultá con el organizador para más información.
      </div>
    </Screen>
  );
}

// ── Pantalla: Fuera de horario (time_based) ───────────────────────
function ScreenTimeLocked({ event }) {
  const start = event?.access_start_at ? new Date(event.access_start_at) : null;
  const end   = event?.access_end_at   ? new Date(event.access_end_at)   : null;
  const now   = new Date();
  const fmt = d => d ? d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const notStarted = start && now < start;

  return (
    <Screen style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{notStarted ? '⏰' : '🏁'}</div>
      <H2>{event?.title || 'Evento'}</H2>
      <Hint>{notStarted ? 'El kiosco aún no está habilitado.' : 'El tiempo del evento ha finalizado.'}</Hint>
      {start && end && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '1rem', padding: '1.25rem', width: '100%'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fff' }}>
            <span style={{ opacity: 0.6 }}>🟢 Apertura</span>
            <strong>{fmt(start)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fff' }}>
            <span style={{ opacity: 0.6 }}>🔴 Cierre</span>
            <strong>{fmt(end)}</strong>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ── Pantalla: Ingresar Código de Acceso ───────────────────────────
function ScreenCodeGate({ event, onUnlock }) {
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState(false);
  const primary = event?.primary_color || '#ec4899';

  const handleSubmit = () => {
    if (code.trim().toUpperCase() === (event?.access_code || '').toUpperCase()) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1200);
    }
  };

  return (
    <Screen style={{ textAlign: 'center' }}>
      {event?.logo_url && (
        <img src={event.logo_url} alt="logo" style={{
          width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.4)', marginBottom: '1.25rem'
        }} />
      )}
      <H2>Acceso al Kiosco</H2>
      <Hint>Ingresá el código que recibiste al entrar al evento</Hint>
      <div style={{ width: '100%', marginBottom: '1rem' }}>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="CÓDIGO"
          maxLength={12}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '1rem 1.25rem', borderRadius: '0.75rem',
            border: error ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.2)',
            background: error ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)',
            color: '#fff', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.25em',
            textAlign: 'center', outline: 'none',
            transition: 'border 0.2s, background 0.2s',
            fontFamily: 'monospace',
          }}
        />
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.5rem 0 0', fontWeight: 600 }}>Código incorrecto. Intentá de nuevo.</p>}
      </div>
      <Btn color={primary} large onClick={handleSubmit} disabled={!code.trim()}>
        🔓 Ingresar
      </Btn>
    </Screen>
  );
}

// ── Pantalla: Pago por Sesión ─────────────────────────────────────
function ScreenPaidGate({ event, onSessionActivated }) {
  const [token, setToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const primary = event?.primary_color || '#ec4899';
  const currency = event?.currency || 'ARS';
  const price = event?.price_per_session ?? 0;
  const photosPerSession = event?.photos_per_session ?? 1;

  const handleValidate = async () => {
    const trimmed = token.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const { data: session, error: dbErr } = await supabase
        .from('event_sessions')
        .select('*')
        .eq('event_id', event.id)
        .eq('token', trimmed)
        .single();

      if (dbErr || !session) {
        setError('Token inválido. Verificá e intentá de nuevo.');
        setLoading(false);
        return;
      }
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        setError('Este token ha expirado.');
        setLoading(false);
        return;
      }
      if (session.photos_used >= session.photos_allowed) {
        setError('Este token ya fue utilizado al máximo de fotos permitidas.');
        setLoading(false);
        return;
      }
      // Token válido → habilitar booth
      onSessionActivated(session);
    } catch (e) {
      setError('Error al verificar. Intentá nuevamente.');
    }
    setLoading(false);
  };

  return (
    <Screen style={{ textAlign: 'center' }}>
      {event?.logo_url && (
        <img src={event.logo_url} alt="logo" style={{
          width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.4)', marginBottom: '1.25rem'
        }} />
      )}
      <H2>{event?.title || 'Foto Kiosco'}</H2>

      {/* Pricing card */}
      <div style={{
        background: 'rgba(255,255,255,0.08)', border: `1px solid ${primary}55`,
        borderRadius: '1.25rem', padding: '1.25rem', width: '100%', marginBottom: '1.5rem'
      }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.6, color: '#fff', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Precio por sesión</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: primary }}>
          {currency} {Number(price).toLocaleString('es-AR')}
        </div>
        <div style={{ fontSize: '0.85rem', opacity: 0.7, color: '#fff', marginTop: '0.25rem' }}>
          Incluye {photosPerSession} {photosPerSession === 1 ? 'foto impresa' : 'fotos impresas'}
        </div>
      </div>

      <Hint>Luego del pago, ingresá el código que te dará el operador</Hint>

      <div style={{ width: '100%', marginBottom: '1rem' }}>
        <input
          type="text"
          value={token}
          onChange={e => setToken(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleValidate()}
          placeholder="TOKEN DE SESIÓN"
          maxLength={12}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '1rem 1.25rem', borderRadius: '0.75rem',
            border: error ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.2)',
            background: error ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)',
            color: '#fff', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.2em',
            textAlign: 'center', outline: 'none', transition: 'border 0.2s',
            fontFamily: 'monospace',
          }}
        />
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.5rem 0 0', fontWeight: 600 }}>{error}</p>}
      </div>

      <Btn color={primary} large onClick={handleValidate} disabled={!token.trim() || loading}>
        {loading ? <><Spinner size={18} /> Verificando...</> : '✅ Validar Token'}
      </Btn>
    </Screen>
  );
}


// ═══════════════════════════════════════════════════════════════════
// STEP 1 – Bienvenida
// ═══════════════════════════════════════════════════════════════════
function StepWelcome({ event, onStart }) {
  const c = event.primary_color || '#ec4899';
  const showLiveCam = event.show_live_camera_bg ?? false;

  return (
    <Screen style={{ position: 'relative', overflow: 'hidden' }}>
      <LiveCameraBackground active={showLiveCam} />
      
      {event.logo_url && (
        <img src={event.logo_url} alt="logo" style={{
          width: 96, height: 96, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.6)', marginBottom: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          zIndex: 1
        }} />
      )}
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.5rem', textAlign: 'center', lineHeight: 1.2, color: '#fff', zIndex: 1, textShadow: '0 2px 15px rgba(0,0,0,0.6)' }}>
        {event.welcome_title || 'Bienvenidos'}
      </h1>
      <p style={{ fontSize: '1rem', opacity: 0.95, margin: '0 0 2.5rem', textAlign: 'center', color: '#fff', zIndex: 1, textShadow: '0 1px 8px rgba(0,0,0,0.6)', fontWeight: 600 }}>
        {event.welcome_subtitle || 'Llevate tu recuerdo impreso'}
      </p>
      <div style={{ width: '100%', zIndex: 1 }}>
        <Btn color={c} large onClick={onStart} style={{ animation: 'pulseWelcomeBtn 2s infinite' }}>
          📸 {event.welcome_button_text || 'SACAR MI FOTO'}
        </Btn>
        <style>{`
          @keyframes pulseWelcomeBtn {
            0% { transform: scale(1); box-shadow: 0 0 0 0 ${c}80; }
            50% { transform: scale(1.05); box-shadow: 0 0 30px 10px ${c}00; }
            100% { transform: scale(1); box-shadow: 0 0 0 0 ${c}00; }
          }
        `}</style>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2 – Elegir formato
// ═══════════════════════════════════════════════════════════════════
function StepFormato({ templates, primaryColor, onSelect, onBack }) {
  const options = templates.length > 0 ? templates.map(t => ({
    id: t.id, label: t.name, count: t.photo_count || t.frames_config?.length || 1,
    frames: t.frames_config, template: t,
  })) : [1, 2, 3, 4].map(n => ({
    id: String(n), label: `${n} ${n === 1 ? 'foto' : 'fotos'}`, count: n,
    frames: PRESETS[n], template: null,
  }));

  return (
    <Screen>
      <StepDots current={1} total={3} />
      <H2>Elegí tu plantilla</H2>
      <Hint>Así va a quedar tu foto impresa</Hint>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '100%', marginBottom: '1.5rem' }}>
        {options.map(opt => {
          const frames = opt.frames || PRESETS[opt.count] || PRESETS[1];
          return (
            <button key={opt.id} onClick={() => onSelect(opt)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(255,255,255,0.15)',
              padding: '0.75rem', borderRadius: '1rem', color: '#fff',
              cursor: 'pointer', transition: 'transform 0.2s, border 0.2s',
            }}>
              {/* Preview más grande */}
              <div style={{
                width: '100%', aspectRatio: '2/3', backgroundColor: '#111', borderRadius: '0.5rem',
                position: 'relative', overflow: 'hidden', marginBottom: '0.75rem',
                backgroundImage: opt.template?.base_image_url ? `url('${opt.template.base_image_url}')` : 'linear-gradient(45deg, #1f2937, #111827)',
                backgroundSize: 'cover', backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {frames.map((f, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: `${f.x}%`, top: `${f.y}%`,
                    width: `${f.w || f.width}%`, height: `${f.h || f.height}%`,
                    background: 'rgba(255,255,255,0.9)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#666', fontSize: '1.5rem', fontWeight: 'bold'
                  }}>📷</div>
                ))}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', textAlign: 'center' }}>{opt.label}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{opt.count} {opt.count === 1 ? 'pose' : 'poses'}</div>
            </button>
          );
        })}
      </div>
      <BtnBack onClick={onBack} />
    </Screen>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3 – Carga de fotos
// ═══════════════════════════════════════════════════════════════════
function StepCaptureBooth({ format, photos, primaryColor, onPhotoAdded, onContinue, onBack }) {
  const cameraRef = useRef(); 
  const canvasRef = useRef();
  const [stream, setStream] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState(false);
  const count = format.count;
  const done = photos.length >= count;

  useEffect(() => {
    if (done) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(s => {
        setStream(s);
        if (cameraRef.current) cameraRef.current.srcObject = s;
      })
      .catch(err => console.error("No se pudo acceder a la cámara", err));

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [done]);

  const snapPhoto = () => {
    if (countdown !== null || done) return;
    let c = 3;
    setCountdown(c);
    const interval = setInterval(() => {
      c--;
      if (c > 0) {
        setCountdown(c);
      } else {
        clearInterval(interval);
        setCountdown(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 200);

        if (cameraRef.current && canvasRef.current) {
          const video = cameraRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          
          // Espejar para que coincida con la cámara frontal
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0);
          
          canvas.toBlob(blob => {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            Object.assign(file, { preview: URL.createObjectURL(file) });
            onPhotoAdded(file);
          }, 'image/jpeg', 0.95);
        }
      }
    }, 1000);
  };

  return (
    <Screen style={{ position: 'relative', overflow: 'hidden' }}>
      <StepDots current={2} total={3} />
      <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginBottom: '1rem', zIndex: 2 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i < photos.length ? primaryColor : 'rgba(255,255,255,0.2)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      
      <H2 style={{ zIndex: 2 }}>{done ? '¡Todas listas!' : `Foto ${photos.length + 1} de ${count}`}</H2>

      {/* Slots de miniaturas arriba de la cámara */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', zIndex: 2 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            width: 44, height: 60, borderRadius: '4px', overflow: 'hidden',
            border: photos[i] ? `2px solid ${primaryColor}` : '2px dashed rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.4)', position: 'relative',
          }}>
            {photos[i] && <img src={photos[i].preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
        ))}
      </div>

      {!done ? (
        <div style={{ width: '100%', position: 'relative', aspectRatio: '3/4', borderRadius: '1rem', overflow: 'hidden', backgroundColor: '#000', marginBottom: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <video
            ref={cameraRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          {countdown !== null && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '6rem', fontWeight: 900, textShadow: '0 4px 20px rgba(0,0,0,0.8)'
            }}>
              {countdown}
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      ) : (
        <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '1rem', overflow: 'hidden', backgroundColor: '#111', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: 2, padding: 2 }}>
           {photos.map((p, i) => (
              <img key={i} src={p.preview} style={{ flex: 1, minWidth: '48%', height: count === 1 ? '100%' : '50%', objectFit: 'cover', borderRadius: '0.5rem' }} />
           ))}
        </div>
      )}

      {!done ? (
        <Btn color={primaryColor} large onClick={snapPhoto} disabled={countdown !== null}>
          📸 ¡Disparar!
        </Btn>
      ) : (
        <Btn color={primaryColor} large onClick={onContinue}>Elegir filtros →</Btn>
      )}
      
      <BtnBack onClick={onBack} />

      {/* Efecto visual de flash blanco */}
      {flash && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 9999,
          animation: 'flashAnim 0.8s ease-out forwards', pointerEvents: 'none'
        }} />
      )}
      <style>{`
        @keyframes flashAnim {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </Screen>
  );
}
function StepEditor({ format, photos, filterName, adjustments, onFilterChange, onAdjustChange, onContinue, onBack, primaryColor }) {
  const frames = format.frames || PRESETS[format.count] || PRESETS[1];
  const activeFilter = FILTERS.find(f => f.id === filterName) || FILTERS[0];

  const fullCss = activeFilter.id !== 'none' ? activeFilter.css : 'none';

  return (
    <Screen>
      <StepDots current={3} total={3} />
      <H2>Personaliza tu foto</H2>

      <div style={{
        width: '100%', maxWidth: 220, aspectRatio: '2/3', position: 'relative',
        borderRadius: 8, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        margin: '0 auto 1.25rem',
        backgroundImage: format.template?.base_image_url ? `url('${format.template.base_image_url}')` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#111',
      }}>
        {frames.map((f, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${f.x}%`, top: `${f.y}%`,
            width: `${f.w || f.width}%`, height: `${f.h || f.height}%`,
            backgroundColor: '#fff', padding: '1.5%', boxSizing: 'border-box', overflow: 'hidden',
          }}>
            {photos[i] ? (
              <img src={photos[i].preview} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                filter: fullCss, transition: 'filter 0.3s',
              }} />
            ) : <div style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', width: '100%', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => onFilterChange(f.id)} style={{
            flexShrink: 0, padding: '0.4rem 0.75rem', borderRadius: 99,
            border: filterName === f.id ? `2px solid ${primaryColor}` : '2px solid rgba(255,255,255,0.2)',
            background: filterName === f.id ? primaryColor + '33' : 'rgba(255,255,255,0.07)',
            color: '#fff', fontSize: '0.8rem', fontWeight: filterName === f.id ? 700 : 400,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{f.label}</button>
        ))}
      </div>
      
      <Btn color={primaryColor} large onClick={onContinue} style={{ marginTop: '1rem' }}>Ver Preview Final →</Btn>
      <BtnBack onClick={onBack} />

      <p style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.75rem', textAlign: 'center', color: '#fff' }}>
        Los filtros se aplican en alta calidad al generar la impresión
      </p>
    </Screen>
  );
}

function StepPreview({ format, photos, filterName, adjustments, stickers, primaryColor, onConfirm, onBack, isSubmitting }) {
  const [guestName, setGuestName] = useState('');
  const frames = format.frames || PRESETS[format.count] || PRESETS[1];
  const activeFilter = FILTERS.find(f => f.id === filterName) || FILTERS[0];
  const fullCss = [
    activeFilter.id !== 'none' ? activeFilter.css : '',
    `brightness(${1 + (adjustments.brightness || 0) / 100})`,
    `contrast(${1 + (adjustments.contrast || 0) / 100})`,
    `saturate(${1 + (adjustments.saturation || 0) / 100})`,
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem', color: '#fff' }}>
      <H2>Identificá tu foto</H2>
      <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0, textAlign: 'center' }}>
        El organizador podrá entregarla más fácil
      </p>

      <div style={{ width: '100%', maxWidth: 240, marginBottom: '0.5rem' }}>
        <input 
          type="text" 
          placeholder="Tu Nombre (Opcional)"
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          maxLength={30}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.875rem', borderRadius: '0.75rem',
            border: '2px solid rgba(255,255,255,0.8)', background: '#fff',
            color: '#0f172a', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold'
          }}
        />
      </div>

      <div style={{
        width: '100%', maxWidth: 240, aspectRatio: '2/3', position: 'relative',
        borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
        backgroundImage: format.template?.base_image_url ? `url('${format.template.base_image_url}')` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#111',
      }}>
        {frames.map((f, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${f.x}%`, top: `${f.y}%`,
            width: `${f.w || f.width}%`, height: `${f.h || f.height}%`,
            backgroundColor: '#fff', padding: '1.5%', boxSizing: 'border-box', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            {photos[i] ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <img src={photos[i].preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: fullCss }} />
                {/* Renderizar stickers sobre la miniatura */}
                {(stickers || []).filter(s => s.photoIdx === i).map(s => (
                  <div key={s.id} style={{
                    position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
                    transform: `translate(-50%, -50%) scale(${(s.scale || 1) * 0.4})`, 
                    fontSize: '3.5rem', pointerEvents: 'none', zIndex: 10
                  }}>
                    {s.emoji}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>
            )}
          </div>
        ))}
        {isSubmitting && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <Spinner />
            <span style={{ fontSize: '0.875rem', color: '#fff' }}>Enviando...</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: 240, marginTop: '0.5rem' }}>
        <Btn color={primaryColor} large onClick={() => onConfirm(guestName)} disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : '🖨 Confirmar e Imprimir'}
        </Btn>
        <BtnGhost onClick={onBack} disabled={isSubmitting}>✏️ Editar</BtnGhost>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 5 — Pegatinas (Stickers)
// ═══════════════════════════════════════════════════════════════════
function StepStickers({ photos, stickers, onAdd, onMove, onScale, onRemove, onContinue, onBack, primaryColor }) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [activeDragId, setActiveDragId] = useState(null);
  const containerRef = useRef(null);

  // Lógica de arrastre estable (Bulletproof)
  const handleMove = (e) => {
    if (!activeDragId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    
    let x = ((touch.clientX - rect.left) / rect.width) * 100;
    let y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    onMove(activeDragId, x, y);
  };

  useEffect(() => {
    if (!activeDragId) return;
    const stop = () => setActiveDragId(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', stop);
    };
  }, [activeDragId]);


  return (
    <Screen style={{ padding: '1.25rem', userSelect: 'none' }}>
      <StepDots current={3} total={4} />
      <H2>Personaliza tu foto</H2>
      <Hint>Arrastrá los elementos sobre la foto.</Hint>

      <div 
        ref={containerRef}
        style={{
          width: '100%', aspectRatio: '1/1', background: '#000', borderRadius: '1.25rem',
          position: 'relative', overflow: 'hidden', marginBottom: '1.25rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)', touchAction: 'none'
        }}
      >
        {photos[activePhotoIdx] && (
          <img src={photos[activePhotoIdx].preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        )}
        
        {stickers.filter(s => s.photoIdx === activePhotoIdx).map(s => (
          <div
            key={s.id}
            onMouseDown={() => setActiveDragId(s.id)}
            onTouchStart={() => setActiveDragId(s.id)}
            style={{
              position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
              transform: `translate(-50%, -50%) scale(${s.scale || 1})`, 
              fontSize: '4.5rem', cursor: 'move', zIndex: 50,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              userSelect: 'none', touchAction: 'none',
              filter: activeDragId === s.id ? 'drop-shadow(0 0 10px rgba(255,255,255,0.8))' : 'none'
            }}
          >
            <span style={{ pointerEvents: 'none' }}>{s.emoji}</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '-12px', pointerEvents: 'auto' }}>
              <button 
                onMouseDown={e => e.stopPropagation()} 
                onTouchStart={e => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onScale(s.id, -0.2); }} 
                style={smallRoundBtn}
              >-</button>
              <button 
                onMouseDown={e => e.stopPropagation()} 
                onTouchStart={e => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onScale(s.id, 0.2); }} 
                style={smallRoundBtn}
              >+</button>
              <button 
                onMouseDown={e => e.stopPropagation()} 
                onTouchStart={e => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onRemove(s.id); }} 
                style={{...smallRoundBtn, background: '#ef4444', color: '#fff'}}
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Selector de Fotos (si hay más de una) */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', width: '100%' }}>
          {photos.map((p, i) => (
            <img 
              key={i} src={p.preview} onClick={() => setActivePhotoIdx(i)}
              style={{
                width: 60, height: 60, borderRadius: '0.5rem', objectFit: 'cover',
                border: activePhotoIdx === i ? `2px solid ${primaryColor}` : '2px solid transparent',
                opacity: activePhotoIdx === i ? 1 : 0.5
              }}
            />
          ))}
        </div>
      )}

      {/* Biblioteca de Stickers */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', 
        width: '100%', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', 
        borderRadius: '1rem', marginBottom: '1.5rem' 
      }}>
        {STICKERS.map(s => (
          <button
            key={s.id}
            onClick={() => onAdd(s.emoji, activePhotoIdx)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', 
              borderRadius: '0.5rem', padding: '0.5rem', fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            {s.emoji}
          </button>
        ))}
      </div>

      <Btn color={primaryColor} large onClick={onContinue}>Siguiente: Preview Final →</Btn>
      <BtnBack onClick={onBack} />
    </Screen>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 6 – Cola + estado en tiempo real
// ═══════════════════════════════════════════════════════════════════
// ─── Render client-side fallback ─────────────────────────────────
const CLIENT_RENDER_W = 1200;
const CLIENT_RENDER_H = 1800;
const CLIENT_BORDER   = 14;

const loadImgClient = src => new Promise((res, rej) => {
  const img = new Image(); img.crossOrigin = 'Anonymous';
  img.onload = () => res(img); img.onerror = rej;
  img.src = src;
});

const drawCoverClient = (ctx, img, x, y, w, h) => {
  const iA = img.width / img.height, bA = w / h;
  let dW, dH, dX, dY;
  if (iA > bA) { dH = h; dW = img.width * h / img.height; dX = x - (dW - w) / 2; dY = y; }
  else         { dW = w; dH = img.height * w / img.width; dX = x; dY = y - (dH - h) / 2; }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, dX, dY, dW, dH); ctx.restore();
};

const clientRender = async (jobData) => {
  const { raw_photo_urls, frames_config, base_image_url, filter_name, adjustments, stickers_data } = jobData;
  const frames = frames_config || PRESETS[1];
  const canvas = document.createElement('canvas');
  canvas.width = CLIENT_RENDER_W; canvas.height = CLIENT_RENDER_H;
  const ctx = canvas.getContext('2d');

  // 1. Fondo
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, CLIENT_RENDER_W, CLIENT_RENDER_H);

  // 2. Imagen de diseño
  if (base_image_url) {
    try {
      const bg = await loadImgClient(base_image_url);
      const bA = bg.width / bg.height, cA = CLIENT_RENDER_W / CLIENT_RENDER_H;
      let bW, bH, bX, bY;
      if (bA > cA) { bH = CLIENT_RENDER_H; bW = bg.width * CLIENT_RENDER_H / bg.height; bX = -(bW - CLIENT_RENDER_W) / 2; bY = 0; }
      else         { bW = CLIENT_RENDER_W; bH = bg.height * CLIENT_RENDER_W / bg.width; bX = 0; bY = -(bH - CLIENT_RENDER_H) / 2; }
      ctx.drawImage(bg, bX, bY, bW, bH);
    } catch {}
  }

  // 3. Aplicar filtro CSS al contexto
  const filterMap = {
    bw:            'grayscale(100%)',
    vintage:       'sepia(60%) saturate(80%) brightness(105%)',
    high_contrast: 'contrast(160%) brightness(108%)',
    auto:          'brightness(108%) saturate(115%) contrast(105%)',
  };
  const adj = adjustments || { brightness: 0, contrast: 0, saturation: 0 };
  const filterParts = [
    filterMap[filter_name] || '',
    `brightness(${1 + adj.brightness / 100})`,
    `contrast(${1 + adj.contrast / 100})`,
    `saturate(${1 + adj.saturation / 100})`,
  ].filter(Boolean);
  ctx.filter = filterParts.join(' ');

  // 4. Fotos con borde blanco
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const pX = ((f.x ?? 4) / 100) * CLIENT_RENDER_W;
    const pY = ((f.y ?? 4) / 100) * CLIENT_RENDER_H;
    const pW = ((f.w ?? f.width ?? 92) / 100) * CLIENT_RENDER_W;
    const pH = ((f.h ?? f.height ?? 78) / 100) * CLIENT_RENDER_H;
    ctx.filter = 'none';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 25;
    ctx.fillStyle = '#fff'; ctx.fillRect(pX, pY, pW, pH); ctx.restore();
    if (raw_photo_urls && raw_photo_urls[i]) {
      try {
        const ph = await loadImgClient(raw_photo_urls[i]);
        ctx.filter = filterParts.join(' ');
        drawCoverClient(ctx, ph, pX + CLIENT_BORDER, pY + CLIENT_BORDER, pW - CLIENT_BORDER * 2, pH - CLIENT_BORDER * 2);
        ctx.filter = 'none';

        // ─── Renderizar Stickers sobre la foto ─────────────────
        const photoStickers = (stickers_data || []).filter(s => s.photoIdx === i);
        photoStickers.forEach(s => {
          ctx.save();
          const sSize = 90 * (s.scale || 1);
          ctx.font = `${sSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const sx = pX + CLIENT_BORDER + (s.x / 100) * (pW - CLIENT_BORDER * 2);
          const sy = pY + CLIENT_BORDER + (s.y / 100) * (pH - CLIENT_BORDER * 2);
          ctx.fillText(s.emoji, sx, sy);
          ctx.restore();
        });
      } catch (e) { console.error("Render photo error:", e); }
    }
  }

  return new Promise(res => canvas.toBlob(blob => res(blob), 'image/jpeg', 0.95));
};

// ─── StepQueue con fallback automático ───────────────────────────
function StepQueue({ jobId, event, primaryColor, onReset }) {
  const [job, setJob] = useState(null);
  const [queuePos, setQueuePos] = useState(null);
  const [isFallbackRendering, setIsFallbackRendering] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const fallbackTriggered = useRef(false);
  const startTime = useRef(Date.now());

  // ... (runClientFallback logic stays the same)

  // ─── Render server fallback logic (Restaurada) ─────────────────
  const runClientFallback = async (jobData) => {
    if (fallbackTriggered.current) return;
    fallbackTriggered.current = true;
    setIsFallbackRendering(true);
    try {
      await supabase.from('print_jobs').update({ status: 'rendering', updated_at: new Date().toISOString() }).eq('id', jobId);
      setJob(prev => ({ ...prev, status: 'rendering' }));

      const blob = await clientRender(jobData);
      const fileName = `final_${jobId}.jpg`;
      const { error: upErr } = await supabase.storage.from('kiosco-prints').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('kiosco-prints').getPublicUrl(fileName);
      await supabase.from('print_jobs').update({
        status: 'pending_print',
        final_image_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      setJob(prev => ({ ...prev, status: 'pending_print', final_image_url: urlData.publicUrl }));
    } catch (e) {
      console.error('Client fallback error:', e);
      await supabase.from('print_jobs').update({ status: 'error', error_message: e.message }).eq('id', jobId);
      setJob(prev => ({ ...prev, status: 'error' }));
    }
    setIsFallbackRendering(false);
  };

  // Configuración de compartir del evento
  const canQR = event?.enable_qr !== false;
  const canWA = event?.enable_whatsapp !== false;
  const canMail = event?.enable_email !== false;
  const canPrint = event?.enable_print !== false;

  useEffect(() => {
    let interval;
    const poll = async () => {
      const { data } = await supabase.from('print_jobs').select('*').eq('id', jobId).single();
      if (data) {
        setJob(data);
        const { count } = await supabase.from('print_jobs')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending_render', 'rendering', 'pending_print', 'printing'])
          .lt('created_at', new Date().toISOString());
        setQueuePos(Math.max(1, count || 1));

        const elapsed = Date.now() - startTime.current;
        if (data.status === 'pending_render' && elapsed > 15000 && !fallbackTriggered.current) {
          runClientFallback(data);
        }
      }
    };
    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  const status = job?.status || 'pending_render';
  const s = JOB_STATUS[status] || JOB_STATUS.pending_render;
  
  // Modificación clave: Mostramos los botones si ya hay imagen final, aunque falte imprimir
  const isDone = ['approved_for_print', 'pending_print', 'printing', 'completed'].includes(status);
  const isError = status === 'error';

  const stages = ['pending_render', 'rendering', 'pending_print', 'printing', 'completed'];
  const currentStageIdx = stages.indexOf(status);

  const frames = format?.frames || PRESETS[format?.count] || PRESETS[1];
  const activeFilter = FILTERS.find(f => f.id === filterName) || FILTERS[0];
  const fullCss = [
    activeFilter.id !== 'none' ? activeFilter.css : '',
    `brightness(${1 + (adjustments?.brightness || 0) / 100})`,
    `contrast(${1 + (adjustments?.contrast || 0) / 100})`,
    `saturate(${1 + (adjustments?.saturation || 0) / 100})`,
  ].filter(Boolean).join(' ') || 'none';

  if (!job && !isFallbackRendering) {
    return (
      <Screen style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner size={48} />
        <p style={{ marginTop: '1rem', color: '#fff', opacity: 0.8 }}>Conectando con la cola de impresión...</p>
      </Screen>
    );
  }

  return (
    <Screen style={{ 
      textAlign: 'center', 
      gap: '1.5rem', 
      width: '100%', 
      maxWidth: isDone ? '500px' : '420px',
      minHeight: isDone ? 'auto' : '450px',
      justifyContent: 'center',
      padding: '2.5rem'
    }}>
      
      {!isDone && !isError && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ fontSize: '3.5rem', animation: 'pulse 2s infinite' }}>{s.emoji}</div>
          <H2>{isFallbackRendering ? 'Generando tu foto...' : 'Tu foto está en cola'}</H2>
          
          <div style={{
            background: 'rgba(255,255,255,0.08)', padding: '1.5rem', borderRadius: '1.5rem', 
            border: '1px solid rgba(255,255,255,0.15)', width: '100%', textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Mostrale este código al staff
            </div>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: primaryColor, letterSpacing: '0.2em', textShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
              {job?.adjustments?.short_code || '---'}
            </div>
          </div>

          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', opacity: 0.9 }}>
            Escaneá el QR al finalizar para descargar 📥
          </div>

          <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '1rem' }}>
            {stages.map((st, i) => (
              <div key={st} style={{
                flex: 1, height: 6, borderRadius: 99,
                background: i <= currentStageIdx ? primaryColor : 'rgba(255,255,255,0.15)',
                transition: 'background 0.5s',
              }} />
            ))}
          </div>
          
          {queuePos && !isFallbackRendering && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '0.6rem 1.2rem' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginRight: '0.5rem' }}>#{queuePos}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.6, color: '#fff' }}>en la cola</span>
            </div>
          )}
        </div>
      )}

      {isDone && (
        <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            
            {/* Foto Final */}
            <div style={{ flex: 1, minWidth: '240px' }}>
              {job?.final_image_url ? (
                <img src={job.final_image_url} alt="Tu foto"
                  style={{ width: '100%', borderRadius: '1rem', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', border: '4px solid #fff' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '2/3', background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner />
                </div>
              )}
              <div style={{ marginTop: '1.5rem' }}>
                 <Btn color={primaryColor} onClick={onReset}>🔄 SACAR OTRA FOTO</Btn>
              </div>
            </div>

            {/* Sidebar de Acciones (LumaBooth Style) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '70px' }}>
              {canQR && job?.final_image_url && (
                <div style={actionCircleStyle} onClick={() => setShowQRModal(true)}>
                  <div style={{fontSize: '1.4rem'}}>📱</div>
                  <span style={actionLabelStyle}>QR</span>
                </div>
              )}
              {canWA && (
                <div style={actionCircleStyle} onClick={() => {
                  const msg = encodeURIComponent(`¡Mi foto en ${event.title}! Descárgala aquí: ${job?.final_image_url}`);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}>
                  <div style={{fontSize: '1.4rem'}}>💬</div>
                  <span style={actionLabelStyle}>WhatsApp</span>
                </div>
              )}
              {canMail && (
                <div style={actionCircleStyle} onClick={() => window.open(`mailto:?subject=Tu foto de EventPix&body=Descárgala aquí: ${job?.final_image_url}`)}>
                  <div style={{fontSize: '1.4rem'}}>📧</div>
                  <span style={actionLabelStyle}>Email</span>
                </div>
              )}
              {canPrint && job?.status !== 'completed' && job?.status !== 'pending_print' && (
                <div style={{...actionCircleStyle, background: 'rgba(255,255,255,0.1)', cursor: 'wait', opacity: 0.5}}>
                  <div style={{fontSize: '1.2rem', animation: 'spin 2s linear infinite'}}>⏳</div>
                  <span style={actionLabelStyle}>Cola</span>
                </div>
              )}
              <div style={actionCircleStyle} onClick={() => {
                const a = document.createElement('a'); a.href = job.final_image_url;
                a.download = 'foto_eventpix.jpg'; a.click();
              }}>
                <div style={{fontSize: '1.4rem'}}>⬇️</div>
                <span style={actionLabelStyle}>Guardar</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {isError && <Btn color="#ef4444" onClick={onReset}>Reintentar</Btn>}

      {isDone && (
        <div style={{ width: '100%', animation: 'fadeIn 0.5s ease-out' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✨</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.25rem', color: '#fff' }}>¡FOTO LISTA!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Ya puedes descargarla o compartirla</p>
          
          <div style={{ 
            aspectRatio: '2/3', background: '#0a0a0a', borderRadius: '1rem', 
            overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 15px 35px rgba(0,0,0,0.7)',
            border: '2px solid rgba(255,255,255,0.1)'
          }}>
            <img src={job?.final_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Final" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Btn color={primaryColor} style={{ padding: '1.2rem', fontSize: '1.1rem' }} onClick={() => setShowQRModal(true)}>
              📥 DESCARGAR / COMPARTIR QR
            </Btn>
            <Btn style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={onReset}>
              VOLVER AL INICIO
            </Btn>
          </div>
        </div>
      )}

      {/* MODAL DEL QR */}
      {showQRModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }} onClick={() => setShowQRModal(false)}>
          <div style={{ 
            background: '#fff', padding: '2.5rem', borderRadius: '2rem', 
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            maxWidth: '320px', width: '100%', position: 'relative',
            animation: 'fadeIn 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowQRModal(false)} style={{
              position: 'absolute', top: '1rem', right: '1rem', background: '#f1f5f9',
              border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
            }}>✕</button>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#0f172a', margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800 }}>¡Tu foto está lista!</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Escaneá con tu celular para descargarla al instante</p>
            </div>

            <div style={{ 
              background: '#f8fafc', padding: '1rem', borderRadius: '1.25rem', 
              display: 'inline-block', border: '1px solid #e2e8f0', marginBottom: '1.5rem'
            }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(job?.final_image_url)}`} 
                alt="QR Code"
                style={{ width: 200, height: 200, display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a 
                href={job?.final_image_url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  background: primaryColor, color: '#fff', textDecoration: 'none',
                  padding: '0.85rem', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 700,
                  boxShadow: `0 8px 16px ${primaryColor}44`
                }}
              >
                Abrir imagen directa
              </a>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>
                Puebe tardar unos segundos en cargar dependiendo de tu conexión.
              </p>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

const actionCircleStyle = {
  width: '64px', height: '64px', background: '#fff', borderRadius: '50%', color: '#000',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.3)', transition: 'transform 0.2s'
};

const actionLabelStyle = { fontSize: '0.65rem', fontWeight: 'bold', marginTop: '2px', textTransform: 'uppercase' };

const smallRoundBtn = {
  background: 'rgba(255,255,255,0.9)', color: '#000', border: 'none', borderRadius: '50%',
  width: 26, height: 26, fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
};


// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function Booth() {
  const [event, setEvent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Access Engine ────────────────────────────────────────────────
  // accessState: 'checking' | 'locked' | 'time_locked' | 'code_gate' | 'paid_gate' | 'granted'
  const [accessState, setAccessState] = useState('checking');
  const [activeSession, setActiveSession] = useState(null); // para modo paid_photo

  const [step, setStep] = useState('welcome');
  const [format, setFormat] = useState(null);
  const [photos, setPhotos] = useState([]); // [{ file, preview }]
  const [filterName, setFilterName] = useState('none');
  const [adjustments, setAdjustments] = useState({ brightness: 0, contrast: 0, saturation: 0 });
  const [jobId, setJobId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stickers, setStickers] = useState([]); // [{id, emoji, photoIdx, x, y}]

  useEffect(() => {
    (async () => {
      // Extrae el slug del evento (ej: 'misXVluana')
      // Soporta /kiosco/slug, /slug o el hack de GitHub Pages ?/slug
      const fullPath = window.location.pathname + window.location.search;
      let slug = fullPath.split('?').pop().split('/').filter(Boolean).pop();

      if (!slug || slug === 'kiosco') slug = 'demo';

      const { data: ev } = await supabase.from('events').select('*').eq('slug', slug).single();
      if (ev) {
        setEvent(ev);
        const { data: tpls } = await supabase.from('event_templates').select('*').eq('event_id', ev.id);
        setTemplates(tpls || []);
        // ── Evaluar modo de acceso ──
        evaluateAccess(ev);
      } else {
        // Evento demo / no encontrado → acceso abierto
        setEvent({ primary_color: '#ec4899', welcome_title: 'Bienvenidos', welcome_subtitle: 'Captura tu recuerdo', welcome_button_text: 'SACAR MI FOTO', font_family: 'Inter', bg_opacity: 0.55, bg_blur: 10, background_url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200', access_mode: 'open' });
        setAccessState('granted');
      }
      setLoading(false);
    })();
  }, []);

  // ── Motor de evaluación de acceso ────────────────────────────────
  const evaluateAccess = (ev) => {
    // Override manual del operador → siempre abierto
    if (ev.manual_override_open) { setAccessState('granted'); return; }

    // Evento desactivado
    if (ev.is_active === false) { setAccessState('locked'); return; }

    const mode = ev.access_mode || 'open';

    if (mode === 'open') {
      setAccessState('granted');
    } else if (mode === 'code') {
      setAccessState('code_gate');
    } else if (mode === 'paid_photo') {
      setAccessState('paid_gate');
    } else if (mode === 'time_based') {
      const now = new Date();
      const start = ev.access_start_at ? new Date(ev.access_start_at) : null;
      const end   = ev.access_end_at   ? new Date(ev.access_end_at)   : null;
      if (start && end && now >= start && now <= end) {
        setAccessState('granted');
      } else {
        setAccessState('time_locked');
      }
    } else {
      setAccessState('granted');
    }
  };

  const addPhoto = (file) => {
    const preview = URL.createObjectURL(file);
    setPhotos(prev => [...prev, { file, preview }]);
  };

  const handleAdjust = (key, val) => setAdjustments(prev => ({ ...prev, [key]: val }));

  const handleAddSticker = (emoji, photoIdx) => {
    const newSticker = {
      id: Math.random().toString(36).substr(2, 9),
      emoji,
      photoIdx,
      x: 50,
      y: 50,
      scale: 1
    };
    setStickers([...stickers, newSticker]);
  };

  const handleMoveSticker = (id, x, y) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
  };

  const handleScaleSticker = (id, delta) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, scale: Math.max(0.4, (s.scale || 1) + delta) } : s));
  };

  const handleRemoveSticker = (id) => {
    setStickers(prev => prev.filter(s => s.id !== id));
  };

  // ─── Enviar job al backend (NO genera imagen aquí) ───────────────
  const handleSubmit = async (guestName) => {
    setIsSubmitting(true);
    try {
      // 1. Subir fotos RAW a Supabase Storage
      const photoUrls = [];
      for (const photo of photos) {
        const fileName = `raw_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await supabase.storage.from('kiosco-prints').upload(fileName, photo.file, { contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('kiosco-prints').getPublicUrl(fileName);
        photoUrls.push(urlData.publicUrl);
      }

      // Generate session code
      const sessionCode = Math.random().toString(36).substring(2,6).toUpperCase();
      const updatedAdjustments = { ...adjustments, guest_name: guestName || 'Anónimo', short_code: sessionCode };
      setAdjustments(updatedAdjustments);

      // 2. Crear print_job con configuración (NO imagen final)
      const frames = format.frames || PRESETS[format.count] || PRESETS[1];
      const { data: jobData, error: jobErr } = await supabase.from('print_jobs').insert([{
        event_id: event?.id || null,
        template_id: format.template?.id || null,
        raw_photo_urls: photoUrls,
        filter_name: filterName,
        adjustments: updatedAdjustments,
        frames_config: frames,
        base_image_url: format.template?.base_image_url || null,
        status: 'pending_render',
        stickers_data: stickers // Guardamos las pegatinas
      }]).select().single();

      if (jobErr) throw jobErr;

      // 3. Si hay sesión activa (modo paid_photo), incrementar fotos_used
      if (activeSession) {
        await supabase
          .from('event_sessions')
          .update({ photos_used: activeSession.photos_used + photos.length })
          .eq('id', activeSession.id);
        // Actualizar estado local
        const newUsed = activeSession.photos_used + photos.length;
        if (newUsed >= activeSession.photos_allowed) {
          // Sesión agotada → volver a pedir token al finalizar
          setActiveSession({ ...activeSession, photos_used: newUsed });
        } else {
          setActiveSession({ ...activeSession, photos_used: newUsed });
        }
      }

      setJobId(jobData.id);
      setStep('queue');
    } catch (e) {
      console.error("DETALLE DEL ERROR AL ENVIAR:", e);
      alert('❌ ERROR AL ENVIAR A COLA: ' + (e.message || "Error desconocido"));
    }
    setIsSubmitting(false);
  };

  const reset = () => {
    setPhotos([]); setFormat(null); setJobId(null);
    setFilterName('none'); setAdjustments({ brightness: 0, contrast: 0, saturation: 0 });
    setStickers([]);

    // En modo paid_photo: si la sesión se agotó, volver a pedir token
    if (event?.access_mode === 'paid_photo' && activeSession) {
      const newUsed = activeSession.photos_used;
      if (newUsed >= activeSession.photos_allowed) {
        setActiveSession(null);
        setAccessState('paid_gate');
        return;
      }
    }
    // En modo time_based: re-evaluar por si el tiempo expiró
    if (event?.access_mode === 'time_based') {
      evaluateAccess(event);
      if (accessState !== 'granted') return;
    }
    setStep('welcome');
  };

  if (loading || !event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a' }}>
      <Spinner size={48} />
    </div>
  );

  // ── Access Engine: renderizar gate screens antes del booth ────────
  const primary = event.primary_color || '#ec4899';
  const theme = THEMES[event.selected_theme_id] || THEMES.default;
  const bgStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', fontFamily: `'${event.font_family || 'Inter'}', sans-serif`,
    background: theme.bg !== 'transparent' ? theme.bg : (event.background_url ? `url('${event.background_url}') center/cover no-repeat` : '#0f0f1a'),
    backgroundColor: theme.bg === 'transparent' ? '#0f0f1a' : 'transparent',
    position: 'relative',
  };
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 0,
    backgroundColor: theme.bg !== 'transparent' ? 'transparent' : `rgba(0,0,0,${event.bg_opacity ?? 0.55})`,
    backdropFilter: theme.bg !== 'transparent' ? 'none' : `blur(${event.bg_blur ?? 8}px)`,
    WebkitBackdropFilter: theme.bg !== 'transparent' ? 'none' : `blur(${event.bg_blur ?? 8}px)`,
  };
  const animations = `
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes fadeIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    input[type=range]  { -webkit-appearance: none; height: 4px; border-radius: 99px; background: rgba(255,255,255,0.2); outline: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: ${primary}; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  `;

  if (accessState === 'checking') return (
    <div style={{ ...bgStyle }}><div style={overlayStyle} /><Spinner size={48} /></div>
  );

  if (accessState === 'locked') return (
    <div style={bgStyle}>
      <div style={overlayStyle} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <ScreenLocked event={event} />
      </div>
      <style>{animations}</style>
    </div>
  );

  if (accessState === 'time_locked') return (
    <div style={bgStyle}>
      <div style={overlayStyle} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <ScreenTimeLocked event={event} />
      </div>
      <style>{animations}</style>
    </div>
  );

  if (accessState === 'code_gate') return (
    <div style={bgStyle}>
      <div style={overlayStyle} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <ScreenCodeGate event={event} onUnlock={() => setAccessState('granted')} />
      </div>
      <style>{animations}</style>
    </div>
  );

  if (accessState === 'paid_gate') return (
    <div style={bgStyle}>
      <div style={overlayStyle} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <ScreenPaidGate
          event={event}
          onSessionActivated={(session) => {
            setActiveSession(session);
            setAccessState('granted');
          }}
        />
      </div>
      <style>{animations}</style>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: `'${event.font_family || 'Inter'}', sans-serif`,
      background: theme.bg !== 'transparent' ? theme.bg : (event.background_url ? `url('${event.background_url}') center/cover no-repeat` : '#0f0f1a'),
      backgroundColor: theme.bg === 'transparent' ? '#0f0f1a' : 'transparent',
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundColor: theme.bg !== 'transparent' ? 'transparent' : `rgba(0,0,0,${event.bg_opacity ?? 0.55})`,
        backdropFilter: theme.bg !== 'transparent' ? 'none' : `blur(${event.bg_blur ?? 8}px)`,
        WebkitBackdropFilter: theme.bg !== 'transparent' ? 'none' : `blur(${event.bg_blur ?? 8}px)`,
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {step === 'welcome'  && <StepWelcome event={event} onStart={() => setStep('formato')} />}
        {step === 'formato'  && <StepFormato templates={templates} primaryColor={primary}
          onSelect={fmt => { setFormat(fmt); setPhotos([]); setStep('upload'); }}
          onBack={() => setStep('welcome')} />}
        {step === 'upload'   && format && <StepCaptureBooth format={format} photos={photos} primaryColor={primary}
          onPhotoAdded={addPhoto}
          onContinue={() => setStep('editor')}
          onBack={() => { setPhotos([]); setStep(templates.length > 1 ? 'formato' : 'welcome'); }} />}
        {step === 'editor'   && format && <StepEditor
          format={format} photos={photos}
          filterName={filterName} adjustments={adjustments}
          onFilterChange={setFilterName} onAdjustChange={handleAdjust}
          primaryColor={primary}
          onContinue={() => {
            if (event.enable_stickers !== false) setStep('stickers');
            else setStep('preview');
          }}
          onBack={() => setStep('upload')} />}
        {step === 'stickers' && format && (
          <StepStickers 
            photos={photos} stickers={stickers}
            onAdd={handleAddSticker} onMove={handleMoveSticker} onScale={handleScaleSticker} onRemove={handleRemoveSticker}
            primaryColor={primary}
            onContinue={() => setStep('preview')}
            onBack={() => setStep('editor')}
          />
        )}
        {step === 'preview'  && format && (
          <Screen>
            <StepPreview format={format} photos={photos}
              filterName={filterName} adjustments={adjustments} stickers={stickers}
              primaryColor={primary}
              onConfirm={handleSubmit}
              onBack={() => {
                if (event.enable_stickers !== false) setStep('stickers');
                else setStep('editor');
              }}
              isSubmitting={isSubmitting} />
          </Screen>
        )}
        {step === 'queue'    && jobId && event && (
          <StepQueue 
            jobId={jobId} 
            event={event} 
            primaryColor={primary} 
            onReset={reset} 
            photos={photos} 
            format={format} 
            filterName={filterName} 
            adjustments={adjustments} 
          />
        )}
      </div>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        input[type=range]  { -webkit-appearance: none; height: 4px; border-radius: 99px; background: rgba(255,255,255,0.2); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: ${primary}; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
      `}</style>
    </div>
  );
}
