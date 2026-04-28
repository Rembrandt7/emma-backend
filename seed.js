// seed.js — Inserta datos iniciales de Emma usando cliente Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    db: { schema: 'public' },
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

const REGLAS = [
  // Precios
  { clave: 'precio_base',        valor: '1500',  tipo: 'numero', descripcion: 'Precio base por render en MXN sin IVA', categoria: 'precios' },
  { clave: 'precio_descuento',   valor: '1200',  tipo: 'numero', descripcion: 'Precio con descuento pronto pago', categoria: 'precios' },
  { clave: 'precio_volumen_min', valor: '950',   tipo: 'numero', descripcion: 'Precio mínimo paquete >10 renders', categoria: 'precios' },
  { clave: 'precio_volumen_max', valor: '1000',  tipo: 'numero', descripcion: 'Precio máximo paquete volumen', categoria: 'precios' },
  { clave: 'iva_porcentaje',     valor: '16',    tipo: 'numero', descripcion: 'Porcentaje de IVA', categoria: 'precios' },
  { clave: 'volumen_minimo',     valor: '10',    tipo: 'numero', descripcion: 'Renders mínimos para precio volumen', categoria: 'precios' },
  // Negocio
  { clave: 'anticipo_porcentaje', valor: '50',   tipo: 'numero', descripcion: 'Porcentaje de anticipo requerido', categoria: 'negocio' },
  { clave: 'tiempo_entrega',      valor: '24-48 horas', tipo: 'texto', descripcion: 'Tiempo de entrega tras anticipo', categoria: 'negocio' },
  { clave: 'resolucion_minima',   valor: '2K',   tipo: 'texto', descripcion: 'Resolución mínima de entrega', categoria: 'negocio' },
  // Identidad de Emma
  { clave: 'nombre_agente', valor: 'Emma', tipo: 'texto', descripcion: 'Nombre de la agente IA', categoria: 'identidad' },
  { clave: 'cargo_agente',  valor: 'Directora de Cuentas', tipo: 'texto', descripcion: 'Cargo de la agente', categoria: 'identidad' },
  { clave: 'empresa',       valor: 'Renders HDR', tipo: 'texto', descripcion: 'Nombre de la empresa', categoria: 'identidad' },
  { clave: 'jefe_nombre',   valor: 'Arq. Rembrandt Blanco Arrambide', tipo: 'texto', descripcion: 'Nombre del director', categoria: 'identidad' },
  // Reportes
  { clave: 'email_reporte_1', valor: 'rembrandtro@gmail.com',  tipo: 'texto', descripcion: 'Email 1 para reportes diarios', categoria: 'reportes' },
  { clave: 'email_reporte_2', valor: 'rba_ross@hotmail.com',   tipo: 'texto', descripcion: 'Email 2 para reportes diarios', categoria: 'reportes' },
  { clave: 'hora_reporte',    valor: '8',                      tipo: 'numero', descripcion: 'Hora de envío del reporte (24h)', categoria: 'reportes' },
];

async function seed() {
  console.log('\n🌱 Insertando datos iniciales de Emma...\n');

  // Insertar reglas con upsert (no duplicar si ya existen)
  const { data, error } = await supabase
    .from('reglas_emma')
    .upsert(REGLAS, { onConflict: 'clave', ignoreDuplicates: false })
    .select();

  if (error) {
    console.error('❌ Error al insertar reglas:', error.message);
    console.log('\n💡 Prueba esto en el SQL Editor de Supabase:');
    console.log('   https://supabase.com/dashboard/project/flsgnrrqswvchfkuyeku/sql/new');
    console.log('\n   -- Habilitar acceso a la tabla reglas_emma:');
    console.log('   ALTER TABLE reglas_emma ENABLE ROW LEVEL SECURITY;');
    console.log('   CREATE POLICY "Enable all" ON reglas_emma FOR ALL USING (true);');
  } else {
    console.log(`✅ ${data?.length || REGLAS.length} reglas de Emma insertadas/actualizadas`);

    // Verificar lectura
    const { data: check } = await supabase.from('reglas_emma').select('clave,valor,categoria').order('categoria');
    if (check) {
      console.log('\n📋 Reglas activas en Supabase:');
      const cats = [...new Set(check.map(r => r.categoria))];
      cats.forEach(cat => {
        console.log(`\n  🏷️  ${cat.toUpperCase()}`);
        check.filter(r => r.categoria === cat).forEach(r => {
          console.log(`     • ${r.clave}: ${r.valor}`);
        });
      });
      console.log('\n🎉 ¡Emma está completamente conectada a Supabase!');
      console.log('🤖 El motor IA ya leerá las reglas en tiempo real.\n');
    }
  }
}

seed().catch(console.error);
