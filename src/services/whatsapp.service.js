// whatsapp.service.js — Emma usa Twilio para WhatsApp
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // 'whatsapp:+14155238886' (sandbox) o tu número

let client = null;

function getClient() {
  if (!client && accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

// ─────────────────────────────────────────────
// ENVIAR MENSAJE DE TEXTO
// ─────────────────────────────────────────────
export async function enviarMensaje(telefono, texto) {
  try {
    const tw = getClient();
    if (!tw) {
      console.warn('⚠️  Twilio no configurado — mensaje no enviado');
      return { ok: false, error: 'Twilio no configurado' };
    }

    // Formato WhatsApp de Twilio
    const to = telefono.startsWith('whatsapp:')
      ? telefono
      : `whatsapp:+${telefono.replace(/\D/g, '')}`;

    const message = await tw.messages.create({
      from: fromNumber,
      to,
      body: texto
    });

    console.log(`✅ Mensaje enviado a ${to} — SID: ${message.sid}`);
    return { ok: true, sid: message.sid };

  } catch (err) {
    console.error('❌ Error Twilio al enviar:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// ENVIAR IMAGEN/MEDIA
// ─────────────────────────────────────────────
export async function enviarImagen(telefono, urlImagen, caption = '') {
  try {
    const tw = getClient();
    if (!tw) return { ok: false, error: 'Twilio no configurado' };

    const to = telefono.startsWith('whatsapp:')
      ? telefono
      : `whatsapp:+${telefono.replace(/\D/g, '')}`;

    const message = await tw.messages.create({
      from: fromNumber,
      to,
      body: caption,
      mediaUrl: [urlImagen]
    });

    console.log(`✅ Imagen enviada a ${to} — SID: ${message.sid}`);
    return { ok: true, sid: message.sid };

  } catch (err) {
    console.error('❌ Error Twilio al enviar imagen:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// PARSEAR MENSAJE ENTRANTE DE TWILIO
// ─────────────────────────────────────────────
export function parsearMensajeTwilio(body) {
  // Twilio envía los datos como form-urlencoded
  return {
    telefono: (body.From || '').replace('whatsapp:+', '').replace('whatsapp:', ''),
    telefonoRaw: body.From || '',
    mensaje: body.Body || '',
    mediaUrl: body.MediaUrl0 || null,
    mediaType: body.MediaContentType0 || null,
    sid: body.MessageSid || '',
    timestamp: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────
// VERIFICAR FIRMA DE TWILIO (Seguridad)
// ─────────────────────────────────────────────
export function verificarFirmaTwilio(signature, url, params) {
  if (!authToken) return true; // En dev sin token, pasar
  return twilio.validateRequest(authToken, signature, url, params);
}

// ─────────────────────────────────────────────
// ESTADO DEL SERVICIO
// ─────────────────────────────────────────────
export function estadoTwilio() {
  return {
    configurado: !!(accountSid && authToken && fromNumber),
    accountSid: accountSid ? accountSid.substring(0, 8) + '...' : 'NO CONFIGURADO',
    from: fromNumber || 'NO CONFIGURADO',
    modo: fromNumber?.includes('14155238886') ? 'SANDBOX (pruebas)' : 'PRODUCCIÓN'
  };
}

export default { enviarMensaje, enviarImagen, parsearMensajeTwilio, verificarFirmaTwilio, estadoTwilio };
