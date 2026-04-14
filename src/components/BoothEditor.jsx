import React, { useState } from 'react';
import { Printer, RotateCcw } from 'lucide-react';

const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 1800;
const BORDER_PX = 14;

export const FRAME_PRESETS = {
  simple1: [{ x: 5, y: 5, width: 90, height: 78 }],
  pose2:   [{ x: 5, y: 4, width: 90, height: 43 }, { x: 5, y: 52, width: 90, height: 43 }],
  strip3:  [{ x: 5, y: 3, width: 90, height: 29 }, { x: 5, y: 35, width: 90, height: 29 }, { x: 5, y: 67, width: 90, height: 29 }],
  grid4:   [{ x: 3, y: 3, width: 46, height: 45 }, { x: 51, y: 3, width: 46, height: 45 }, { x: 3, y: 51, width: 46, height: 45 }, { x: 51, y: 51, width: 46, height: 45 }],
};

const loadImage = src => new Promise((res, rej) => {
  const img = new Image(); img.crossOrigin = 'Anonymous';
  img.onload = () => res(img); img.onerror = () => rej(new Error('No cargó: ' + src));
  img.src = src;
});

const drawCover = (ctx, img, x, y, w, h) => {
  const iA = img.width / img.height, bA = w / h;
  let dW, dH, dX, dY;
  if (iA > bA) { dH = h; dW = img.width * (h / img.height); dX = x - (dW - w) / 2; dY = y; }
  else         { dW = w; dH = img.height * (w / img.width); dX = x; dY = y - (dH - h) / 2; }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, dX, dY, dW, dH); ctx.restore();
};

export default function BoothEditor({ template, photos, primaryColor = '#ec4899', onPrint, onBack }) {
  const [isRendering, setIsRendering] = useState(false);

  const frames = Array.isArray(template?.frames_config) && template.frames_config.length > 0
    ? template.frames_config : FRAME_PRESETS.simple1;

  const handleConfirm = async () => {
    setIsRendering(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = TARGET_WIDTH; canvas.height = TARGET_HEIGHT;
      const ctx = canvas.getContext('2d');

      // 1. Fondo oscuro base
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // 2. Imagen de diseño del template (background)
      if (template?.base_image_url) {
        try {
          const bg = await loadImage(template.base_image_url);
          const bA = bg.width / bg.height, cA = TARGET_WIDTH / TARGET_HEIGHT;
          let bW, bH, bX, bY;
          if (bA > cA) { bH = TARGET_HEIGHT; bW = bg.width * (TARGET_HEIGHT / bg.height); bX = -(bW - TARGET_WIDTH) / 2; bY = 0; }
          else         { bW = TARGET_WIDTH;  bH = bg.height * (TARGET_WIDTH / bg.width);  bX = 0; bY = -(bH - TARGET_HEIGHT) / 2; }
          ctx.drawImage(bg, bX, bY, bW, bH);
        } catch {}
      }

      // 3. Fotos con borde blanco + sombra
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const pX = (f.x / 100) * TARGET_WIDTH, pY = (f.y / 100) * TARGET_HEIGHT;
        const pW = (f.width / 100) * TARGET_WIDTH, pH = (f.height / 100) * TARGET_HEIGHT;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 25;
        ctx.fillStyle = '#fff'; ctx.fillRect(pX, pY, pW, pH); ctx.restore();
        if (photos[i]) {
          try {
            const ph = await loadImage(photos[i]);
            drawCover(ctx, ph, pX + BORDER_PX, pY + BORDER_PX, pW - BORDER_PX * 2, pH - BORDER_PX * 2);
          } catch {}
        }
      }

      canvas.toBlob(blob => {
        if (blob) onPrint(blob);
        else { alert('Error generando la imagen.'); setIsRendering(false); }
      }, 'image/jpeg', 0.95);
    } catch (e) {
      alert('Error: ' + e.message); setIsRendering(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.25rem' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, textAlign: 'center' }}>Vista Previa</h2>
      <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0, textAlign: 'center' }}>
        Así saldrá tu foto impresa
      </p>

      {/* PREVIEW GRANDE */}
      <div style={{
        width: '100%', maxWidth: 260, aspectRatio: '2/3', position: 'relative',
        borderRadius: 8, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        backgroundImage: template?.base_image_url ? `url('${template.base_image_url}')` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#111'
      }}>
        {frames.map((f, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${f.x}%`, top: `${f.y}%`, width: `${f.width}%`, height: `${f.height}%`,
            backgroundColor: '#fff', padding: '1.5%', boxSizing: 'border-box',
            overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}>
            {photos[i]
              ? <img src={photos[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📷</div>
            }
          </div>
        ))}
        {isRendering && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#fff' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.875rem' }}>Generando...</span>
          </div>
        )}
      </div>

      {/* BOTONES */}
      <button onClick={handleConfirm} disabled={isRendering} style={{
        width: '100%', padding: '1rem', borderRadius: 99, border: 'none',
        background: isRendering ? '#94a3b8' : primaryColor,
        color: '#fff', fontSize: '1rem', fontWeight: 700,
        cursor: isRendering ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
      }}>
        <Printer size={18} />
        {isRendering ? 'Generando imagen...' : '🖨 Confirmar e Imprimir'}
      </button>

      <button onClick={onBack} disabled={isRendering} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
        color: '#fff', padding: '0.75rem', borderRadius: 99,
        fontSize: '0.875rem', cursor: 'pointer', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
      }}>
        <RotateCcw size={14} /> Retomar fotos
      </button>
    </div>
  );
}
