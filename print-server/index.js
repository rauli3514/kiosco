import { createClient } from '@supabase/supabase-js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const TARGET_W = 1200;
const TARGET_H = 1800;
const BORDER_PX = 14;

console.log('🚀 EventPix Render+Print Server iniciando...');
console.log(`📡 Conectado a: ${process.env.SUPABASE_URL}`);

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════

const downloadFile = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar: ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
};

const drawCover = (ctx, img, x, y, w, h) => {
  const iA = img.width / img.height;
  const bA = w / h;
  let dW, dH, dX, dY;
  if (iA > bA) { dH = h; dW = img.width * h / img.height; dX = x - (dW - w) / 2; dY = y; }
  else         { dW = w; dH = img.height * w / img.width; dX = x; dY = y - (dH - h) / 2; }
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, dX, dY, dW, dH);
  ctx.restore();
};

// ─── Aplicar filtros al ImageData (pixel manipulation) ────────────
const applyFilter = (ctx, filterName, adjustments, w, h) => {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const { brightness = 0, contrast = 0, saturation = 0 } = adjustments || {};

  // Factor de multiplicación: brightness/contrast/saturation en rango -50..+50
  const bFactor = 1 + brightness / 100;
  const cFactor = 1 + contrast / 100;
  const sFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    // 1. Filtro base
    if (filterName === 'bw') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gray;
    } else if (filterName === 'vintage') {
      r = r * 0.9 + 30; g = g * 0.85 + 15; b = b * 0.6;
    } else if (filterName === 'high_contrast') {
      r = ((r / 255 - 0.5) * 1.6 + 0.5) * 255;
      g = ((g / 255 - 0.5) * 1.6 + 0.5) * 255;
      b = ((b / 255 - 0.5) * 1.6 + 0.5) * 255;
    } else if (filterName === 'auto') {
      // Auto-enhance: boost saturation + slight brightness
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.15;
      g = avg + (g - avg) * 1.15;
      b = avg + (b - avg) * 1.15;
      r *= 1.05; g *= 1.05; b *= 1.05;
    }

    // 2. Brightness
    r *= bFactor; g *= bFactor; b *= bFactor;

    // 3. Contrast
    r = ((r / 255 - 0.5) * cFactor + 0.5) * 255;
    g = ((g / 255 - 0.5) * cFactor + 0.5) * 255;
    b = ((b / 255 - 0.5) * cFactor + 0.5) * 255;

    // 4. Saturation
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luminance + (r - luminance) * sFactor;
    g = luminance + (g - luminance) * sFactor;
    b = luminance + (b - luminance) * sFactor;

    // Clamping
    data[i]     = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, 0, 0);
};

// ═══════════════════════════════════════════════════════════════════
// RENDER ENGINE — genera imagen final en 1200x1800px
// ═══════════════════════════════════════════════════════════════════

const renderJob = async (job) => {
  console.log(`\n🎨 Renderizando job [${job.id}]...`);
  console.log(`   Filtro: ${job.filter_name} | Fotos: ${job.raw_photo_urls?.length}`);

  const canvas = createCanvas(TARGET_W, TARGET_H);
  const ctx = canvas.getContext('2d');

  // 1. Fondo negro base
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);

  // 2. Fondo de diseño del template
  if (job.base_image_url) {
    try {
      const bgBuf = await downloadFile(job.base_image_url);
      const bgImg = await loadImage(bgBuf);
      const bA = bgImg.width / bgImg.height, cA = TARGET_W / TARGET_H;
      let bW, bH, bX, bY;
      if (bA > cA) { bH = TARGET_H; bW = bgImg.width * TARGET_H / bgImg.height; bX = -(bW - TARGET_W) / 2; bY = 0; }
      else         { bW = TARGET_W; bH = bgImg.height * TARGET_W / bgImg.width; bX = 0; bY = -(bH - TARGET_H) / 2; }
      ctx.drawImage(bgImg, bX, bY, bW, bH);
      console.log('   ✅ Fondo de diseño aplicado');
    } catch (e) { console.warn('   ⚠️  No se pudo cargar el fondo:', e.message); }
  }

  // 3. Fotos en sus frames con borde blanco
  const frames = job.frames_config || [{ x: 4, y: 4, w: 92, h: 78 }];
  const photoUrls = job.raw_photo_urls || [];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const pX = ((f.x ?? 4) / 100) * TARGET_W;
    const pY = ((f.y ?? 4) / 100) * TARGET_H;
    const pW = ((f.w ?? f.width ?? 92) / 100) * TARGET_W;
    const pH = ((f.h ?? f.height ?? 78) / 100) * TARGET_H;

    // Borde blanco con sombra
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pX, pY, pW, pH);
    ctx.restore();

    if (photoUrls[i]) {
      try {
        const photoBuf = await downloadFile(photoUrls[i]);
        const photo = await loadImage(photoBuf);
        drawCover(ctx, photo, pX + BORDER_PX, pY + BORDER_PX, pW - BORDER_PX * 2, pH - BORDER_PX * 2);
        console.log(`   ✅ Foto ${i + 1} colocada en frame`);

        // ─── Renderizar Stickers sobre la foto ─────────────────
        const stickers = (job.stickers_data || []).filter(s => s.photoIdx === i);
        stickers.forEach(s => {
          ctx.save();
          // Dimensiones proporcionales (90px es el base en el editor)
          const sSize = 90 * (s.scale || 1);
          ctx.font = `${sSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Posición relativa al área de la foto (sin contar el borde blanco del frame)
          const sx = pX + BORDER_PX + (s.x / 100) * (pW - BORDER_PX * 2);
          const sy = pY + BORDER_PX + (s.y / 100) * (pH - BORDER_PX * 2);
          ctx.fillText(s.emoji, sx, sy);
          ctx.restore();
        });
      } catch (e) { console.warn(`   ⚠️  No se cargó foto ${i + 1}:`, e.message); }
    }
  }

  // 4. Aplicar filtros + ajustes pixel-accurate
  const filterName = job.filter_name || 'none';
  const adjustments = job.adjustments || { brightness: 0, contrast: 0, saturation: 0 };
  if (filterName !== 'none' || adjustments.brightness !== 0 || adjustments.contrast !== 0 || adjustments.saturation !== 0) {
    applyFilter(ctx, filterName, adjustments, TARGET_W, TARGET_H);
    console.log(`   ✅ Filtro "${filterName}" aplicado`);
  }

  // 5. Exportar como JPEG buffer
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  console.log(`   📦 Canvas generado: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  return buffer;
};

// ═══════════════════════════════════════════════════════════════════
// GESTIÓN DE IMPRESORAS LOCALES
// ═══════════════════════════════════════════════════════════════════

const getLocalPrinters = () => new Promise((res) => {
  const cmd = process.platform === 'darwin' ? 'lpstat -a | awk \'{print $1}\'' : 'wmic printer get name';
  exec(cmd, (err, stdout) => {
    if (err) return res([]);
    const list = stdout.split('\n').map(s => s.trim()).filter(s => s && s !== 'Name');
    res(list);
  });
});

const announceStation = async () => {
  const printers = await getLocalPrinters();
  const stationName = process.env.STATION_NAME || `Station-${process.platform}-${path.basename(__dirname)}`;
  
  const { data, error } = await supabase.from('printer_stations').upsert({
    name: stationName,
    available_printers: printers,
    last_seen: new Date().toISOString(),
    status: 'online'
  }, { onConflict: 'name' }).select();

  if (error) console.error('❌ Error anunciando estación:', error.message);
  else console.log(`📡 Estación "${stationName}" sincronizada. Impresoras detectadas: ${printers.length}`);
};

// ═══════════════════════════════════════════════════════════════════
// LOOP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

let isWorking = false;

const sendToPrinter = (filePath, printerName, paperSize, scale = 100, ox = 0, oy = 0) => new Promise((res, rej) => {
  // En macOS/Linux usamos lpr con parámetros detallados
  // media=Custom.4x6in es común para impresoras térmicas (DNP, Citizen, Mitsu)
  let cmd;
  if (process.platform === 'darwin') {
    const p = printerName ? `-P "${printerName}"` : '';
    const m = paperSize ? `-o media=${paperSize}` : '-o media=Custom.4x6in';
    const s = scale !== 100 ? `-o scaling=${scale}` : '';
    // Los offsets son más complejos en lpr directo, pero scaling suele bastar
    cmd = `lpr ${p} ${m} ${s} "${filePath}"`;
  } else {
    // Windows fallback
    cmd = `mspaint /pt "${filePath}"`;
  }
  
  console.log(`   🖨️  Ejecutando: ${cmd}`);
  exec(cmd, (err) => err ? rej(err) : res());
});

const checkAndProcess = async () => {
  if (isWorking) return;
  isWorking = true;
  try {
    // 1. Refrescar estado de la estación cada cierto tiempo
    if (Math.random() > 0.95) await announceStation();

    // ── A. Buscar jobs para RENDERIZAR (ya implementado arriba) ──
    const { data: renderJobs } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('status', 'pending_render')
      .order('created_at', { ascending: true })
      .limit(1);

    if (renderJobs && renderJobs.length > 0) {
      const job = renderJobs[0];
      console.log(`\n📬 Job de render encontrado: ${job.id}`);
      await supabase.from('print_jobs').update({ status: 'rendering', updated_at: new Date().toISOString() }).eq('id', job.id);
      try {
        const imageBuffer = await renderJob(job);
        const fileName = `final_${job.id}.jpg`;
        const { error: upErr } = await supabase.storage.from('kiosco-prints').upload(fileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('kiosco-prints').getPublicUrl(fileName);
        await supabase.from('print_jobs').update({ status: 'pending_print', final_image_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('id', job.id);
        console.log(`✅ Render completado`);
      } catch (e) {
        console.error('❌ Error en render:', e.message);
        await supabase.from('print_jobs').update({ status: 'error', error_message: e.message, updated_at: new Date().toISOString() }).eq('id', job.id);
      }
    }

    // ── B. Buscar jobs para IMPRIMIR ────────────────────────────
    const { data: printJobs } = await supabase
      .from('print_jobs')
      .select('*, events(selected_printer_name, selected_paper_size, print_scale, print_offset_x, print_offset_y)')
      .eq('status', 'pending_print')
      .order('created_at', { ascending: true })
      .limit(1);

    if (printJobs && printJobs.length > 0) {
      const job = printJobs[0];
      const ev = job.events || {};
      console.log(`\n🖨️  Job de impresión encontrado: ${job.id}`);
      await supabase.from('print_jobs').update({ status: 'printing', updated_at: new Date().toISOString() }).eq('id', job.id);

      try {
        const fileName = `print_${job.id}.jpg`;
        const localPath = path.join(DOWNLOADS_DIR, fileName);
        const buf = await downloadFile(job.final_image_url);
        fs.writeFileSync(localPath, buf);

        await sendToPrinter(
          localPath, 
          ev.selected_printer_name, 
          ev.selected_paper_size,
          ev.print_scale,
          ev.print_offset_x,
          ev.print_offset_y
        );

        await supabase.from('print_jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', job.id);
        console.log(`✅ Impresión completada: ${job.id}`);
        fs.unlinkSync(localPath);
      } catch (e) {
        console.error('❌ Error en impresión:', e.message);
        await supabase.from('print_jobs').update({ status: 'error', error_message: e.message, updated_at: new Date().toISOString() }).eq('id', job.id);
      }
    }

  } catch (e) {
    console.error('💥 Error crítico en el loop:', e.message);
  } finally {
    isWorking = false;
  }
};

// Arrancar
console.log('✅ Servidor activo. Revisando cola cada 3 segundos...\n');
announceStation();
setInterval(checkAndProcess, 3000);
checkAndProcess();
