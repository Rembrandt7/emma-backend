import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase, getAllReglas } from '../config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_OK = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'PENDIENTE';
if (!GEMINI_OK) {
  console.warn('âš ï¸  [Emma] Sin GEMINI_API_KEY â€” respuestas en modo DEMO.');
}

const genAI = GEMINI_OK ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// ===============================================
// PERSONALIDAD Y PROMPT BASE DE EMMA
// ===============================================
async function buildSystemPrompt(reglas) {
  return `
Eres ${reglas.nombre_agente || 'Emma'}, ${reglas.cargo_agente || 'Directora de Cuentas'} de ${reglas.empresa || 'Renders HDR'}.
Tu jefe directo es el ${reglas.jefe_nombre || 'Arq. Rembrandt Blanco Arrambide'}.

## Tu Personalidad
- Profesionalista y experta en arquitectura y visualizaciÃ³n 3D fotorrealista
- EmpÃ¡tica, cÃ¡lida pero enfocada en resultados
- Hablas siempre en espaÃ±ol, con lenguaje arquitectÃ³nico preciso
- Usas emojis estratÃ©gicamente (no en exceso)
- Respondes de forma concisa pero completa
- Tu objetivo principal: CERRAR VENTAS de renders fotorrealistas 2K

## Estructura de Precios (SIEMPRE respetar)
- Precio Base: $${reglas.precio_base || 1500} MXN + IVA (${reglas.iva_porcentaje || 16}%) por render
- Con descuento (pronto pago/interÃ©s especial): $${reglas.precio_descuento || 1200} MXN + IVA
- Paquetes >10 renders: Entre $${reglas.precio_volumen_min || 950} y $${reglas.precio_volumen_max || 1000} MXN + IVA

## Reglas de Negocio INQUEBRANTABLES
1. SIEMPRE solicitar el 50% de anticipo para iniciar CUALQUIER proyecto
2. El tiempo de entrega (${reglas.tiempo_entrega || '24-48 horas'}) comienza DESPUÃ‰S de recibir el anticipo
3. El 50% restante se paga al entregar y aprobar los renders
4. NUNCA bajar del precio de paquete ($${reglas.precio_volumen_min || 950}) sin autorizaciÃ³n del Arq. Rembrandt

## Flujo de ConversaciÃ³n
1. SALUDO: PresÃ©ntate con nombre y empresa
2. CALIFICACIÃ“N: Pregunta tipo de proyecto (interior/exterior/recorrido/planta)
3. NECESIDADES: Cantidad de renders, nivel de detalle, fecha lÃ­mite
4. COTIZACIÃ“N: Presenta precio claro con desglose (subtotal + IVA = total)
5. CIERRE: Solicita datos para el anticipo, comparte cuenta de banco
6. POSTVENTA: Confirma recepciÃ³n del anticipo, da fecha exacta de entrega

## Cuando pidan ver portafolio
- Di que vas a buscar ejemplos especÃ­ficos de lo que necesitan
- Si piden interiores â†’ busca en Interiores_Residenciales
- Si piden exteriores/fachadas â†’ busca en Fachadas_Exteriores
- Si piden recorridos â†’ busca en Recorridos_360
- Si piden plantas â†’ busca en Plantas_Fugadas

## Datos de Contacto para Pagos (pedir confirmaciÃ³n antes de compartir)
- OXXO Pay o transferencia bancaria
- Solicita siempre el comprobante de pago

## IMPORTANTE
- Si el cliente pide descuentos agresivos, consulta con "el Arq. Rembrandt" antes de autorizar
- MantÃ©n SIEMPRE un tono positivo, nunca discutas
- Si no sabes algo tÃ©cnico especÃ­fico, di que lo consultas con el equipo de producciÃ³n
- Los renders son FOTORREALISTAS en resoluciÃ³n 2K (mÃ­nimo), puedes ofrecer 4K como upgrade
`.trim();
}

// ===============================================
// CALCULAR COTIZACIÃ“N
// ===============================================
export function calcularCotizacion(cantidad, reglas, tipoDescuento = 'base') {
  let precioUnitario;

  if (cantidad > (reglas.volumen_minimo || 10)) {
    precioUnitario = reglas.precio_volumen_max || 1000;
  } else if (tipoDescuento === 'descuento') {
    precioUnitario = reglas.precio_descuento || 1200;
  } else {
    precioUnitario = reglas.precio_base || 1500;
  }

  const subtotal = cantidad * precioUnitario;
  const iva = subtotal * ((reglas.iva_porcentaje || 16) / 100);
  const total = subtotal + iva;
  const anticipo = total * 0.5;
  const saldo = total * 0.5;

  return {
    cantidad, precioUnitario, subtotal, iva, total, anticipo, saldo,
    tiempoEntrega: reglas.tiempo_entrega || '24-48 horas'
  };
}

// ===============================================
// FORMATEAR COTIZACIÃ“N PARA WHATSAPP
// ===============================================
export function formatearCotizacion(cotizacion, tipoRender) {
  const fmt = (n) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
  return `
ðŸ“‹ *COTIZACIÃ“N â€” Renders HDR*
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸŽ¨ Tipo: ${tipoRender}
ðŸ“ Cantidad: ${cotizacion.cantidad} render${cotizacion.cantidad > 1 ? 's' : ''}
ðŸ’° Precio unitario: $${fmt(cotizacion.precioUnitario)} MXN
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Subtotal: $${fmt(cotizacion.subtotal)} MXN
IVA (16%): $${fmt(cotizacion.iva)} MXN
*TOTAL: $${fmt(cotizacion.total)} MXN*
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
âœ… *Anticipo (50%): $${fmt(cotizacion.anticipo)} MXN*
ðŸ“¦ Saldo al entregar: $${fmt(cotizacion.saldo)} MXN
â±ï¸ Entrega: ${cotizacion.tiempoEntrega} despuÃ©s del anticipo

_Renders fotorrealistas 2K incluidos_
_Revisiones ilimitadas hasta tu aprobaciÃ³n_
`.trim();
}

// ===============================================
// MOTOR PRINCIPAL: Procesar mensaje con Gemini
// ===============================================
export async function procesarMensaje(telefono, mensajeTexto) {
  try {
    const reglas = await getAllReglas();

    // â”€â”€ Modo DEMO: sin Gemini API Key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!GEMINI_OK) {
      const demo = `Hola! ðŸ‘‹ Soy *Emma*, Directora de Cuentas de *Renders HDR*.\n\nRecibÃ­ tu mensaje correctamente. El sistema estÃ¡ en *modo demo* â€” cuando configures tu GEMINI_API_KEY en el archivo *.env*, responderÃ© con IA real.\n\nðŸ’° Precio base: $${reglas.precio_base || 1500} MXN + IVA por render fotorrealista 2K.\nðŸ“ž Â¿Tienes un proyecto en mente? Con gusto te hago una cotizaciÃ³n.`;
      return { respuesta: demo, cliente: { telefono }, tokensUsados: 0 };
    }

    // â”€â”€ Modo PRODUCCIÃ“N: Gemini activo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const systemPrompt = await buildSystemPrompt(reglas);

    // Obtener o crear cliente en Supabase
    let { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefono', telefono)
      .single();

    if (!cliente) {
      const { data: nuevo } = await supabase
        .from('clientes')
        .insert({ telefono, tipo_cliente: 'prospecto' })
        .select()
        .single();
      cliente = nuevo;
    }

    // Historial de los Ãºltimos 10 mensajes
    const { data: historialDB } = await supabase
      .from('conversaciones')
      .select('direccion, contenido')
      .eq('cliente_id', cliente?.id)
      .order('creado_en', { ascending: false })
      .limit(10);

    const historial = (() => {
      const msgs = (historialDB || []).reverse().map(m => ({
        role: m.direccion === 'entrante' ? 'user' : 'model',
        parts: [{ text: m.contenido || '' }]
      })).filter(m => m.parts[0].text.trim() !== '');

      // Gemini requiere que el historial empiece con 'user' y sea alternado
      // Eliminamos desde el inicio hasta encontrar el primer 'user'
      let inicio = msgs.findIndex(m => m.role === 'user');
      const historialFiltrado = inicio >= 0 ? msgs.slice(inicio) : [];

      // Aseguramos que sea alternado (user, model, user, model...)
      const alternado = [];
      let expectedRole = 'user';
      for (const msg of historialFiltrado) {
        if (msg.role === expectedRole) {
          alternado.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        }
      }
      return alternado;
    })();

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: systemPrompt
    });

    const chat = model.startChat({ history: historial });
    const result = await chat.sendMessage(mensajeTexto);
    const respuesta = result.response.text();
    const tokensUsados = result.response.usageMetadata?.totalTokenCount || 0;

    // Persistir conversaciÃ³n
    if (cliente?.id) {
      await supabase.from('conversaciones').insert([
        { cliente_id: cliente.id, direccion: 'entrante',  contenido: mensajeTexto, tokens_usados: 0 },
        { cliente_id: cliente.id, direccion: 'saliente',  contenido: respuesta, tokens_usados: tokensUsados }
      ]);
    }

    return { respuesta, cliente, tokensUsados };

  } catch (error) {
    console.error('âŒ Error en motor Emma:', error.message);
    return {
      respuesta: 'Disculpa, tuve un problema tÃ©cnico momentÃ¡neo. El Arq. Rembrandt me indicÃ³ que te contactarÃ© enseguida. ðŸ™',
      cliente: null,
      tokensUsados: 0
    };
  }
}

export default { procesarMensaje, calcularCotizacion, formatearCotizacion };




