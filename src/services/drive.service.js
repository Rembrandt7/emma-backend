import { google } from 'googleapis';
import { supabase } from '../config/supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mapeo de carpetas de portafolio a categorías
const CARPETAS_CATEGORIAS = {
  '01 - Fachadas Exteriores':      'fachadas_exteriores',
  '02 - Interiores Residenciales': 'interiores_residenciales',
  '03 - Recorridos 360':           'recorridos_360',
  '04 - Plantas Fugadas':          'plantas_fugadas',
  // Nombres alternativos por si acaso
  'Fachadas_Exteriores':           'fachadas_exteriores',
  'Interiores_Residenciales':      'interiores_residenciales',
  'Recorridos_360':                'recorridos_360',
  'Plantas_Fugadas':               'plantas_fugadas'
};

// Palabras clave por categoría para búsqueda semántica
const PALABRAS_CLAVE = {
  fachadas_exteriores:      ['fachada', 'exterior', 'frente', 'piedra', 'madera', 'acero', 'minimalista', 'contemporaneo', 'moderno'],
  interiores_residenciales: ['interior', 'sala', 'cocina', 'recamara', 'habitacion', 'bano', 'comedor', 'marmol', 'textura'],
  recorridos_360:           ['recorrido', '360', 'video', 'animacion', 'tour', 'virtual'],
  plantas_fugadas:          ['planta', 'fugada', 'perspectiva', 'axonometrica', 'corte']
};

// ===============================================
// AUTENTICACIÓN GOOGLE
// ===============================================
async function getAuth() {
  // En Railway/producción: credenciales en variable base64
  // En local: archivo credentials.json
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    const credsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
    const credentials = JSON.parse(credsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return auth;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  return auth;
}

// ===============================================
// SINCRONIZAR DRIVE → SUPABASE
// ===============================================
export async function sincronizarPortafolio() {
  try {
    const auth = await getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID no configurado');
    
    let sincronizados = 0;
    
    // Listar subcarpetas
    const { data: subcarpetasRes } = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)'
    });
    
    for (const subcarpeta of subcarpetasRes.files || []) {
      const categoria = CARPETAS_CATEGORIAS[subcarpeta.name];
      if (!categoria) continue;
      
      // Listar archivos en esta subcarpeta
      const { data: archivosRes } = await drive.files.list({
        q: `'${subcarpeta.id}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'files(id, name, mimeType, size, thumbnailLink, webContentLink, webViewLink)',
        pageSize: 100
      });
      
      for (const archivo of archivosRes.files || []) {
        const { error } = await supabase
          .from('archivos_drive')
          .upsert({
            drive_id: archivo.id,
            nombre: archivo.name,
            categoria,
            url_publica: archivo.webViewLink,
            url_descarga: archivo.webContentLink,
            thumbnail_url: archivo.thumbnailLink,
            mime_type: archivo.mimeType,
            tamano_bytes: parseInt(archivo.size || '0'),
            activo: true,
            actualizado_en: new Date().toISOString()
          }, { onConflict: 'drive_id' });
        
        if (!error) sincronizados++;
      }
    }
    
    console.log(`✅ Drive sincronizado: ${sincronizados} archivos procesados`);
    return { ok: true, sincronizados };
    
  } catch (error) {
    console.error('❌ Error sincronizando Drive:', error);
    return { ok: false, error: error.message };
  }
}

// ===============================================
// BUSCAR ARCHIVOS POR CONSULTA (SEMÁNTICO)
// ===============================================
export async function buscarPortafolio(consulta, limite = 3) {
  const consultaLower = consulta.toLowerCase();
  
  // Detectar categoría por palabras clave
  let categoriaDetectada = null;
  let mejorPuntaje = 0;
  
  for (const [cat, palabras] of Object.entries(PALABRAS_CLAVE)) {
    const puntaje = palabras.filter(p => consultaLower.includes(p)).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      categoriaDetectada = cat;
    }
  }
  
  let query = supabase
    .from('archivos_drive')
    .select('*')
    .eq('activo', true)
    .order('enviado_count', { ascending: true }) // Priorizar los menos enviados
    .limit(limite);
  
  if (categoriaDetectada) {
    query = query.eq('categoria', categoriaDetectada);
  }
  
  // También buscar por nombre del archivo
  if (!categoriaDetectada && consultaLower.length > 3) {
    query = query.ilike('nombre', `%${consulta}%`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error buscando portafolio:', error);
    return [];
  }
  
  return data || [];
}

// ===============================================
// REGISTRAR ENVÍO DE ARCHIVO
// ===============================================
export async function registrarEnvio(driveId) {
  await supabase.rpc('increment', { 
    table_name: 'archivos_drive', 
    column_name: 'enviado_count',
    row_id: driveId 
  });
}

// ===============================================
// OBTENER URL PÚBLICA COMPARTIBLE
// ===============================================
export function getUrlCompartible(archivo) {
  // Convertir a URL directa de descarga de Google Drive
  return `https://drive.google.com/uc?export=download&id=${archivo.drive_id}`;
}

export default { sincronizarPortafolio, buscarPortafolio, registrarEnvio, getUrlCompartible };
