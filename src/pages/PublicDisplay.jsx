import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, Heart, Star, Sparkles } from 'lucide-react';

export default function PublicDisplay() {
  // Detección manual de slug compatible con /display/slug o ?/display/slug
  const getSlug = () => {
    const path = window.location.pathname + window.location.search;
    const parts = path.split('/');
    // Buscamos la parte después de 'display'
    const displayIdx = parts.findIndex(p => p.includes('display'));
    return parts[displayIdx + 1] || parts[parts.length - 1];
  };

  const slug = getSlug();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activePrinting, setActivePrinting] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [slug]);

  useEffect(() => {
    if (event) {
      fetchPhotos();
      
      // Suscripción Real-time para fotos nuevas e impresiones
      const channel = supabase
        .channel(`public-${event.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'print_jobs', 
          filter: `event_id=eq.${event.id}` 
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchPhotos();
          }
          if (payload.new && payload.new.status === 'printing') {
            setActivePrinting(payload.new);
            setTimeout(() => setActivePrinting(null), 8000);
          }
        })
        .subscribe();
        
      return () => { channel.unsubscribe(); };
    }
  }, [event]);

  // Ciclo del carrusel cada 5 segundos
  useEffect(() => {
    if (photos.length > 1) {
      const interval = setInterval(() => {
        setCurrentIdx(prev => (prev + 1) % photos.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [photos]);

  const fetchEvent = async () => {
    const { data } = await supabase.from('events').select('*').eq('slug', slug).single();
    if (data) setEvent(data);
    setLoading(false);
  };

  const fetchPhotos = async () => {
    const { data } = await supabase.from('print_jobs')
      .select('*')
      .eq('event_id', event?.id)
      .not('final_image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setPhotos(data);
  };

  if (loading) return <div style={{ height: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📡 Conectando con la pantalla del evento...</div>;
  if (!event) return <div style={{ color: '#fff' }}>Evento no encontrado.</div>;

  const currentPhoto = photos[currentIdx];

  return (
    <div style={{ 
      height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', 
      position: 'relative', fontFamily: event.font_family || 'Outfit' 
    }}>
      
      {/* FONDO ANIMADO / BLURRED */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${event.primary_color || '#3b82f6'}dd 0%, #000 100%)`,
        zIndex: 0
      }} />
      
      {currentPhoto && (
        <div key={currentPhoto.id} style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${currentPhoto.final_image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(50px) brightness(0.4)',
          opacity: 0.6,
          zIndex: 1,
          animation: 'zoomBg 20s infinite alternate'
        }} />
      )}

      {/* CONTENIDO PRINCIPAL - FOTO GRANDE */}
      <main style={{ 
        position: 'relative', zIndex: 2, height: '100%', display: 'flex', 
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' 
      }}>
        
        {photos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <Sparkles size={80} style={{ marginBottom: '2rem', opacity: 0.5 }} />
            <h1 style={{ fontSize: '4rem', fontWeight: 900 }}>{event.title}</h1>
            <p style={{ fontSize: '1.5rem', opacity: 0.7 }}>¡Sacate una foto para aparecer aquí!</p>
          </div>
        ) : (
          <div style={{ position: 'relative', height: '85vh', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentPhoto && (
              <div style={{
                height: '100%', width: 'auto', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8)',
                borderRadius: '1.5rem', border: '1rem solid #fff', background: '#fff',
                overflow: 'hidden', animation: 'scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <img 
                  src={currentPhoto.final_image_url} 
                  style={{ height: '100%', width: 'auto', display: 'block' }} 
                  alt="Current"
                />
              </div>
            )}
            
            {/* FLOATING BADGE */}
            <div style={{
              position: 'absolute', bottom: '4rem', right: '-2rem',
              background: '#fff', color: '#000', padding: '1rem 2rem', borderRadius: '1rem',
              transform: 'rotate(5deg)', fontWeight: 900, fontSize: '2.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '1rem'
            }}>
              #{currentPhoto?.adjustments?.short_code || '---'}
              <Heart fill="red" color="red" />
            </div>
          </div>
        )}
      </main>

      {/* NOTIFICACIÓN DE IMPRESIÓN (OVERLAY) */}
      {activePrinting && (
        <div style={{
          position: 'fixed', bottom: '3rem', left: '3rem', right: '3rem',
          background: 'rgba(255,255,255,1)', color: '#000', borderRadius: '2rem',
          padding: '2rem 3rem', display: 'flex', alignItems: 'center', gap: '2rem',
          zIndex: 100, boxShadow: '0 50px 100px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ 
            width: 100, height: 100, borderRadius: '1rem', background: '#f1f5f9', 
            display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
             <Printer size={50} className="animate-pulse" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>Imprimiendo ahora</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>¡{activePrinting.adjustments?.guest_name || 'Alguien'} tu foto está saliendo! 🚀</div>
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: event.primary_color }}>
            #{activePrinting.adjustments?.short_code}
          </div>
        </div>
      )}

      {/* HEADER DISCRETO */}
      <div style={{
        position: 'absolute', top: '2rem', left: '3rem', zIndex: 10,
        color: '#fff', display: 'flex', alignItems: 'center', gap: '1.5rem'
      }}>
        <div style={{ width: 60, height: 60, borderRadius: '1rem', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Star fill="#fff" size={30} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{event.title}</h2>
          <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>Evento en vivo · @rauli3514</p>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomBg { from { transform: scale(1); } to { transform: scale(1.1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}
