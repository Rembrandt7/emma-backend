import express from 'express';
import { sincronizarPortafolio, buscarPortafolio } from '../services/drive.service.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// GET /api/drive/portfolios — Listar todo el portafolio
router.get('/portfolios', async (req, res) => {
  const { categoria, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let query = supabase
    .from('archivos_drive')
    .select('*', { count: 'exact' })
    .eq('activo', true)
    .order('categoria')
    .order('nombre')
    .range(offset, offset + parseInt(limit) - 1);
  
  if (categoria) query = query.eq('categoria', categoria);
  
  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ data, total: count });
});

// GET /api/drive/search — Búsqueda semántica
router.get('/search', async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });
  
  const resultados = await buscarPortafolio(q, parseInt(limit));
  res.json({ resultados, total: resultados.length, consulta: q });
});

// POST /api/drive/sync — Sincronizar Drive con Supabase
router.post('/sync', async (req, res) => {
  const resultado = await sincronizarPortafolio();
  res.json(resultado);
});

// GET /api/drive/stats — Estadísticas del portafolio
router.get('/stats', async (req, res) => {
  const { data } = await supabase
    .from('archivos_drive')
    .select('categoria')
    .eq('activo', true);
  
  const stats = (data || []).reduce((acc, item) => {
    acc[item.categoria] = (acc[item.categoria] || 0) + 1;
    return acc;
  }, {});
  
  res.json({ total: data?.length || 0, por_categoria: stats });
});

export default router;
