import express from 'express';
import { supabase } from '../config/supabase.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configurar transporter de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.GMAIL_APP_PASSWORD  // App Password de Gmail
  }
});

// ──────────────────────────────────────────────
// Generar datos del reporte
// ──────────────────────────────────────────────
async function generarDatosReporte(fecha = new Date()) {
  const fechaStr = fecha.toISOString().split('T')[0];
  const inicioDia = `${fechaStr}T00:00:00Z`;
  const finDia    = `${fechaStr}T23:59:59Z`;
  
  const [leads, conversaciones, cotizaciones, proyectos, anticipos] = await Promise.all([
    // Nuevos leads del día
    supabase.from('clientes').select('id', { count: 'exact' })
      .gte('creado_en', inicioDia).lte('creado_en', finDia),
    
    // Conversaciones activas del día
    supabase.from('conversaciones').select('cliente_id', { count: 'exact' })
      .gte('creado_en', inicioDia).lte('creado_en', finDia),
    
    // Cotizaciones enviadas
    supabase.from('proyectos').select('id', { count: 'exact' })
      .eq('estado', 'cotizacion')
      .gte('creado_en', inicioDia).lte('creado_en', finDia),
    
    // Proyectos entregados hoy
    supabase.from('proyectos').select('total')
      .eq('estado', 'entregado')
      .gte('actualizado_en', inicioDia).lte('actualizado_en', finDia),
    
    // Anticipos recibidos hoy
    supabase.from('proyectos').select('anticipo_pagado')
      .eq('estado', 'anticipo_recibido')
      .gte('actualizado_en', inicioDia).lte('actualizado_en', finDia)
  ]);
  
  const totalFact = proyectos.data?.reduce((s, p) => s + (p.total || 0), 0) || 0;
  const totalAnticipo = anticipos.data?.reduce((s, p) => s + (p.anticipo_pagado || 0), 0) || 0;
  
  return {
    fecha: fechaStr,
    nuevos_leads: leads.count || 0,
    conversaciones_activas: conversaciones.count || 0,
    cotizaciones_enviadas: cotizaciones.count || 0,
    ventas_cerradas: proyectos.data?.length || 0,
    total_facturado: totalFact,
    anticipos_recibidos: totalAnticipo
  };
}

// ──────────────────────────────────────────────
// Enviar email de reporte
// ──────────────────────────────────────────────
export async function enviarReporteDiario() {
  const datos = await generarDatosReporte();
  const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #0f0f1a; color: #e0e0e0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header p { color: rgba(255,255,255,0.8); margin: 5px 0 0; }
        .card { background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 8px; padding: 20px; margin-bottom: 12px; }
        .metric { display: flex; justify-content: space-between; align-items: center; }
        .metric-label { color: #8888aa; }
        .metric-value { color: #7c3aed; font-size: 22px; font-weight: bold; }
        .metric-value.green { color: #10b981; }
        .footer { text-align: center; color: #555; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Reporte Diario — Emma</h1>
          <p>Renders HDR · ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="card">
          <div class="metric">
            <span class="metric-label">👥 Nuevos leads</span>
            <span class="metric-value">${datos.nuevos_leads}</span>
          </div>
        </div>
        
        <div class="card">
          <div class="metric">
            <span class="metric-label">💬 Conversaciones activas</span>
            <span class="metric-value">${datos.conversaciones_activas}</span>
          </div>
        </div>
        
        <div class="card">
          <div class="metric">
            <span class="metric-label">📋 Cotizaciones enviadas</span>
            <span class="metric-value">${datos.cotizaciones_enviadas}</span>
          </div>
        </div>
        
        <div class="card">
          <div class="metric">
            <span class="metric-label">✅ Ventas cerradas</span>
            <span class="metric-value green">${datos.ventas_cerradas}</span>
          </div>
        </div>
        
        <div class="card">
          <div class="metric">
            <span class="metric-label">💰 Anticipos recibidos</span>
            <span class="metric-value green">${fmt(datos.anticipos_recibidos)}</span>
          </div>
        </div>
        
        <div class="card">
          <div class="metric">
            <span class="metric-label">🏆 Total facturado</span>
            <span class="metric-value green">${fmt(datos.total_facturado)}</span>
          </div>
        </div>
        
        <div class="footer">
          Reporte generado automáticamente por Emma · Renders HDR<br>
          Arq. Rembrandt Blanco Arrambide
        </div>
      </div>
    </body>
    </html>
  `;
  
  const emails = [
    process.env.EMAIL_REPORTE_1,
    process.env.EMAIL_REPORTE_2
  ].filter(Boolean);
  
  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: `"Emma — Renders HDR" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: `📊 Reporte Emma | ${datos.fecha} | ${datos.nuevos_leads} leads · ${datos.ventas_cerradas} ventas`,
        html
      });
      console.log(`✅ Reporte enviado a ${email}`);
    } catch (e) {
      console.error(`❌ Error enviando reporte a ${email}:`, e.message);
    }
  }
  
  // Guardar en Supabase
  await supabase.from('reportes_diarios').upsert({
    ...datos,
    enviado_email: true,
    reporte_json: datos
  }, { onConflict: 'fecha' });
  
  return datos;
}

// GET /api/reports/today
router.get('/today', async (req, res) => {
  const datos = await generarDatosReporte();
  res.json(datos);
});

// POST /api/reports/send-email
router.post('/send-email', async (req, res) => {
  const resultado = await enviarReporteDiario();
  res.json({ ok: true, reporte: resultado });
});

// GET /api/reports/history
router.get('/history', async (req, res) => {
  const { data } = await supabase
    .from('reportes_diarios')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(30);
  res.json(data || []);
});

export { generarDatosReporte };
export default router;
