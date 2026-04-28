import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// GET /api/clients — Lista paginada
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, tipo, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let query = supabase
    .from('clientes')
    .select('*, proyectos(count), conversaciones(count)', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);
  
  if (tipo) query = query.eq('tipo_cliente', tipo);
  if (search) query = query.or(`nombre.ilike.%${search}%,telefono.ilike.%${search}%`);
  
  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/clients/:id — Detalle con historial
router.get('/:id', async (req, res) => {
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  if (error || !cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  
  // Obtener proyectos y conversaciones
  const [proyectos, conversaciones] = await Promise.all([
    supabase.from('proyectos').select('*').eq('cliente_id', cliente.id).order('creado_en', { ascending: false }),
    supabase.from('conversaciones').select('*').eq('cliente_id', cliente.id).order('creado_en', { ascending: false }).limit(50)
  ]);
  
  res.json({
    ...cliente,
    proyectos: proyectos.data || [],
    conversaciones: conversaciones.data || []
  });
});

// PATCH /api/clients/:id — Actualizar
router.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('clientes')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/clients/:id/quote — Generar cotización
router.post('/:id/quote', async (req, res) => {
  const { cantidad, tipo_render, tipo_descuento = 'base' } = req.body;
  
  const { calcularCotizacion, formatearCotizacion } = await import('../services/emma.service.js');
  const { getAllReglas } = await import('../config/supabase.js');
  
  const reglas = await getAllReglas();
  const cotizacion = calcularCotizacion(parseInt(cantidad), reglas, tipo_descuento);
  const textoFormateado = formatearCotizacion(cotizacion, tipo_render);
  
  // Guardar proyecto como cotización
  const { data } = await supabase.from('proyectos').insert({
    cliente_id: req.params.id,
    titulo: `${tipo_render} × ${cantidad}`,
    tipo_render,
    cantidad_renders: cantidad,
    precio_unitario: cotizacion.precioUnitario,
    subtotal: cotizacion.subtotal,
    iva: cotizacion.iva,
    total: cotizacion.total,
    anticipo_pagado: 0,
    saldo_pendiente: cotizacion.total,
    estado: 'cotizacion'
  }).select().single();
  
  res.json({ cotizacion, textoFormateado, proyecto: data });
});

export default router;
