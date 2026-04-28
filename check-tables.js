// check-tables.js — Verifica tablas via Supabase REST API directamente
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const tablas = ['clientes', 'proyectos', 'conversaciones', 'archivos_drive', 'citas', 'reglas_emma', 'reportes_diarios'];

async function check() {
  console.log('\n🔍 Verificando tablas en Supabase...\n');

  for (const tabla of tablas) {
    const { data, error } = await supabase.from(tabla).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${tabla} — ${error.message}`);
    } else {
      console.log(`  ✅ ${tabla} — OK`);
    }
  }

  // Verificar reglas_emma con datos
  console.log('\n📋 Consultando reglas_emma:');
  const { data: reglas, error: err2 } = await supabase
    .from('reglas_emma')
    .select('clave, valor, categoria')
    .order('categoria');

  if (err2) {
    console.log(`  ⚠️  ${err2.message}`);
    console.log('\n  🚨 Las tablas NO se crearon correctamente.');
    console.log('  👉 ¿Apareció algún error cuando corriste el SQL en el editor de Supabase?');
    console.log('  👉 Link: https://supabase.com/dashboard/project/flsgnrrqswvchfkuyeku/sql/new');
  } else if (!reglas || reglas.length === 0) {
    console.log('  ⚠️  Tabla existe pero sin datos (faltan los INSERT del SQL)');
  } else {
    console.log(`  ✅ ${reglas.length} reglas encontradas:`);
    reglas.forEach(r => console.log(`     • [${r.categoria}] ${r.clave}: ${r.valor}`));
    console.log('\n🎉 ¡Emma está lista y conectada a Supabase!');
  }
}

check().catch(console.error);
