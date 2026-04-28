import express from 'express';
import { parsearMensajeTwilio, enviarMensaje, enviarImagen } from '../services/whatsapp.service.js';
import { procesarMensaje } from '../services/emma.service.js';
import { buscarPortafolio, getUrlCompartible } from '../services/drive.service.js';
import { supabase } from '../config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ──────────────────────────────────────────────
// GET /webhook — Verificación Meta (legacy, mantener por compatibilidad)
// ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook Meta verificado');
    return res.status(200).send(challenge);
  }
  
  res.status(200).json({ ok: true, sistema: 'Emma — Renders HDR', modo: 'Twilio' });
});

// ──────────────────────────────────────────────
// POST /webhook — Mensajes de Twilio WhatsApp
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Twilio requiere respuesta TwiML o 200 vacío
  res.set('Content-Type', 'text/xml');
  res.status(200).send('<Response></Response>');

  try {
    // Parsear mensaje de Twilio
    const msg = parsearMensajeTwilio(req.body);
    
    if (!msg.telefono || !msg.mensaje) {
      console.log('⚠️  Mensaje vacío o sin teléfono, ignorando');
      return;
    }

    console.log(`\n📩 WhatsApp [${msg.telefono}]: "${msg.mensaje}"`);

    // ¿El cliente pide ver portafolio / renders?
    const textoLower = msg.mensaje.toLowerCase();
    const pidePortafolio = [
      'ejemplo', 'portfolio', 'portafolio', 'muestra',
      'ver', 'foto', 'imagen', 'trabajo', 'referencia',
      'render', 'fachada', 'interior', '360'
    ].some(kw => textoLower.includes(kw));

    if (pidePortafolio) {
      const archivos = await buscarPortafolio(msg.mensaje, 3);
      
      if (archivos.length > 0) {
        // Emma responde primero con texto
        const { respuesta } = await procesarMensaje(msg.telefono, msg.mensaje);
        await enviarMensaje(msg.telefonoRaw, respuesta);

        // Enviar imágenes del portafolio
        for (const archivo of archivos) {
          const url = getUrlCompartible(archivo);
          const caption = `📐 ${archivo.nombre.replace(/_/g, ' ').replace(/\.\w+$/, '')}`;
          await enviarImagen(msg.telefonoRaw, url, caption);
          await new Promise(r => setTimeout(r, 1000));
        }
        return;
      }
    }

    // Respuesta normal de Emma IA
    const { respuesta } = await procesarMensaje(msg.telefono, msg.mensaje);
    await enviarMensaje(msg.telefonoRaw, respuesta);

    console.log(`✅ Respuesta enviada a ${msg.telefono}`);

  } catch (error) {
    console.error('❌ Error procesando webhook Twilio:', error.message);
  }
});

export default router;
