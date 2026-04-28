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
