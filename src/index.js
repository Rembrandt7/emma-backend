import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

import webhookRouter  from './routes/webhook.js';
import clientsRouter  from './routes/clients.js';
import driveRouter    from './routes/drive.js';
import reportsRouter, { enviarReporteDiario } from './routes/reports.js';
import { sincronizarPortafolio } from './services/drive.service.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────
app.use(cors({
  origin: [process.env.DASHBOARD_URL || 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger básico
app.use((req, res, next) => {
  const ts = new Date().toLocaleTimeString('es-MX');
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── Rutas ──────────────────────────────────────
app.use('/webhook',      webhookRouter);
app.use('/api/clients',  clientsRouter);
app.use('/api/drive',    driveRouter);
app.use('/api/reports',  reportsRouter);

// Ruta de settings (reglas de Emma)
app.get('/api/settings', async (req, res) => {
  const { supabase } = await import('./config/supabase.js');
  const { data } = await supabase.from('reglas_emma').select('*').eq('activo', true).order('categoria').order('clave');
  res.json(data || []);
});

app.patch('/api/settings/:clave', async (req, res) => {
  const { supabase } = await import('./config/supabase.js');
  const { data, error } = await supabase
    .from('reglas_emma')
    .update({ valor: req.body.valor, actualizado_en: new Date().toISOString() })
    .eq('clave', req.params.clave)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'Emma — Renders HDR',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Diagnóstico de variables (temporal)
app.get('/diag', async (req, res) => {
  const vars = {
    TWILIO_ACCOUNT_SID:  process.env.TWILIO_ACCOUNT_SID ? '✅ ' + process.env.TWILIO_ACCOUNT_SID.substring(0,8) : '❌ FALTA',
    TWILIO_AUTH_TOKEN:   process.env.TWILIO_AUTH_TOKEN  ? '✅ ***' : '❌ FALTA',
    TWILIO_FROM:         process.env.TWILIO_WHATSAPP_FROM || '❌ FALTA',
    GEMINI_API_KEY:      process.env.GEMINI_API_KEY ? '✅ ' + process.env.GEMINI_API_KEY.substring(0,12) : '❌ FALTA',
    SUPABASE_URL:        process.env.SUPABASE_URL ? '✅ OK' : '❌ FALTA',
    SUPABASE_ANON_KEY:   process.env.SUPABASE_ANON_KEY ? '✅ OK' : '❌ FALTA',
    GOOGLE_DRIVE_FOLDER: process.env.GOOGLE_DRIVE_FOLDER_ID || '❌ FALTA',
    NODE_ENV:            process.env.NODE_ENV || 'development',
  };

  // Probar Gemini
  let geminiTest = '⏳ no probado';
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('Responde solo "OK"');
    geminiTest = '✅ ' + result.response.text().trim();
  } catch (e) {
    geminiTest = '❌ ' + e.message;
  }

  res.json({ variables: vars, gemini: geminiTest });
});


// ── Cron Jobs ──────────────────────────────────

// Reporte diario a las 8:00 AM (hora MX)
cron.schedule('0 8 * * *', async () => {
  console.log('⏰ Enviando reporte diario...');
  await enviarReporteDiario();
}, { timezone: 'America/Monterrey' });

// Sincronizar portafolio de Drive cada 6 horas
cron.schedule('0 */6 * * *', async () => {
  console.log('🔄 Sincronizando portafolio de Google Drive...');
  await sincronizarPortafolio();
}, { timezone: 'America/Monterrey' });

// ── Iniciar servidor ────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║     🤖 EMMA — RENDERS HDR BACKEND   ║
║     Sistema de Ventas Inteligente   ║
╠══════════════════════════════════════╣
║  🚀 Servidor: http://localhost:${PORT}  ║
║  📱 Webhook:  /webhook              ║
║  🔑 Health:   /health               ║
╚══════════════════════════════════════╝
  `);
});

export default app;
