import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const esDevSinCredenciales = !supabaseUrl || !supabaseServiceKey ||
  supabaseUrl === 'https://placeholder.supabase.co';

if (esDevSinCredenciales) {
  console.warn('⚠️  [Supabase] Corriendo en modo DEMO — sin credenciales reales.');
} else {
  console.log('✅ [Supabase] Conectado a:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Helper: obtener regla por clave ─────────────────────
export async function getRegla(clave) {
  if (esDevSinCredenciales) return null;
  const { data, error } = await supabase
    .from('reglas_emma')
    .select('valor')
    .eq('clave', clave)
    .eq('activo', true)
    .single();
  if (error) return null;
  return data?.valor;
}

// ── Helper: todas las reglas como objeto ─────────────────
export async function getAllReglas() {
  // Valores por defecto (usados cuando no hay Supabase conectado)
  const defaults = {
    precio_base: 1500,
    precio_descuento: 1200,
    precio_volumen_min: 950,
    precio_volumen_max: 1000,
    iva_porcentaje: 16,
    anticipo_porcentaje: 50,
    volumen_minimo: 10,
    tiempo_entrega: '24-48',
    nombre_agente: 'Emma',
    cargo_agente: 'Directora de Cuentas',
    empresa: 'Renders HDR',
    jefe_nombre: 'Arq. Rembrandt Blanco Arrambide',
  };

  if (esDevSinCredenciales) return defaults;

  try {
    const { data } = await supabase
      .from('reglas_emma')
      .select('clave, valor, tipo')
      .eq('activo', true);

    if (!data || data.length === 0) return defaults;

    return data.reduce((acc, item) => {
      acc[item.clave] =
        item.tipo === 'numero' ? parseFloat(item.valor) : item.valor;
      return acc;
    }, {});
  } catch {
    return defaults;
  }
}
