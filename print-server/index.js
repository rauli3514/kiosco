import { createClient } from '@supabase/supabase-js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CONFIGURACIÓN DE NODO
const MODE = process.env.MODE || 'BOTH'; // RENDER, PRINT, BOTH
const STATION_NAME = process.env.STATION_NAME || 'Main-Station';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

console.log(`
  🚀 EVENTPIX SYSTEM ACTIVATED
  ----------------------------
  Nodo: ${STATION_NAME}
  Modo: ${MODE}
  Estado: Conectado a Supabase
  ----------------------------
`);

const processRender = async () => {
  if (['RENDER', 'BOTH'].indexOf(MODE) === -1) return;

  const { data: jobs } = await supabase.from('print_jobs')
    .select('*')
    .eq('status', 'pending_render')
    .limit(1);

  if (!jobs?.length) return;
  const job = jobs[0];

  console.log(`🎨 [RENDER] Iniciando proceso para sesión #${job.id}`);
  await supabase.from('print_jobs').update({ status: 'rendering' }).eq('id', job.id);

  try {
    const canvas = createCanvas(1200, 1800); // 4x6 a 300dpi aprox
    const ctx = canvas.getContext('2d');

    // 1. Fondo de la plantilla
    if (job.base_image_url) {
      const bg = await loadImage(job.base_image_url);
      ctx.drawImage(bg, 0, 0, 1200, 1800);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1200, 1800);
    }

    // 2. Dibujar Fotos
    const frames = job.frames_config || [{x:5, y:5, w:90, h:70}];
    for (let i = 0; i < frames.length; i++) {
        const photoUrl = job.raw_photo_urls?.[i];
        if (photoUrl) {
            const img = await loadImage(photoUrl);
            const f = frames[i];
            // Dibujar con margen interno
            ctx.drawImage(img, (f.x/100*1200)+10, (f.y/100*1800)+10, (f.w/100*1200)-20, (f.h/100*1800)-20);
        }
    }

    // 3. Subir Resultado
    const buffer = canvas.toBuffer('image/jpeg');
    const fileName = `render_${job.id}.jpg`;
    await supabase.storage.from('kiosco-prints').upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
    
    const { data: url } = supabase.storage.from('kiosco-prints').getPublicUrl(fileName);
    
    await supabase.from('print_jobs').update({ 
      status: 'approved_for_print', 
      final_image_url: url.publicUrl 
    }).eq('id', job.id);

    console.log(`✅ [RENDER] Finalizado con éxito.`);
  } catch (e) {
    console.error(`❌ [RENDER] FALLÓ:`, e);
    await supabase.from('print_jobs').update({ status: 'error', error_message: e.message }).eq('id', job.id);
  }
};

const processPrint = async () => {
  if (['PRINT', 'BOTH'].indexOf(MODE) === -1) return;

  const { data: jobs } = await supabase.from('print_jobs')
    .select('*')
    .eq('status', 'approved_for_print')
    .limit(1);

  if (!jobs?.length) return;
  const job = jobs[0];

  console.log(`🖨️ [PRINT] Descargando imagen para imprimir: ${job.id}`);
  await supabase.from('print_jobs').update({ status: 'printing' }).eq('id', job.id);

  try {
    const { data: event } = await supabase.from('events').select('*').eq('id', job.event_id).single();
    const tempPath = path.join(__dirname, `print_${job.id}.jpg`);
    
    const res = await fetch(job.final_image_url);
    const dest = fs.createWriteStream(tempPath);
    const body = await res.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(body));

    const printer = event?.selected_printer_name || '';
    const ps = `Add-Type -AssemblyName System.Drawing; $doc = New-Object System.Drawing.Printing.PrintDocument; $doc.PrinterSettings.PrinterName = '${printer}'; $doc.add_PrintPage({ param($s, $e); $img = [System.Drawing.Image]::FromFile('${tempPath.replace(/\\/g, '/')}'); $e.Graphics.DrawImage($img, 0, 0, $e.PageBounds.Width, $e.PageBounds.Height); $img.Dispose(); }); $doc.Print();`;

    exec(`powershell -Command "${ps}"`, async (err) => {
        if (err) throw err;
        await supabase.from('print_jobs').update({ status: 'completed' }).eq('id', job.id);
        console.log(`✅ [PRINT] Enviado a impresora física.`);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    });
  } catch (e) {
    console.error(`❌ [PRINT] FALLÓ:`, e);
    await supabase.from('print_jobs').update({ status: 'error', error_message: e.message }).eq('id', job.id);
  }
};

const heartbeat = async () => {
    const cmd = 'wmic printer get name';
    exec(cmd, async (err, stdout) => {
        const printers = stdout.split('\n').map(s => s.trim()).filter(s => s && s !== 'Name');
        await supabase.from('printer_stations').upsert({
            name: STATION_NAME,
            available_printers: printers,
            last_seen: new Date().toISOString(),
            status: 'online',
            mode: MODE
        }, { onConflict: 'name' });
    });
};

// Loops independientes
setInterval(processRender, 3000);
setInterval(processPrint, 4000);
setInterval(heartbeat, 15000);
heartbeat();
