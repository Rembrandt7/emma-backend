// migrate.js — Ejecuta migraciones SQL en Supabase vía Management API
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const PROJECT_REF   = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

console.log('\n🗄️  MIGRACIONES EMMA — Supabase');
console.log(`📡 Proyecto: ${PROJECT_REF}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const sqlPath = path.join(__dirname, 'src', 'config', 'migration.sql');
const sqlCompleto = readFileSync(sqlPath, 'utf-8');

// Dividir en statements ejecutables (quitar comentarios de bloque y dividir por ;)
function parsearSQL(sql) {
  return sql
    .replace(/--[^\n]*/g, '')         // quitar comentarios --
    .replace(/\/\*[\s\S]*?\*\//g, '') // quitar comentarios /* */
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

async function ejecutarSQL(statement) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ query: statement })
  });
  return resp;
}

// Usar la API de query directa
async function ejecutarConFetch(statement) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    }
  });
  return resp.status;
}

async function main() {
  const statements = parsearSQL(sqlCompleto);
  console.log(`📋 Total de statements a ejecutar: ${statements.length}\n`);

  let exitosos = 0;
  let fallidos  = 0;
  const errores = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 55).replace(/\s+/g, ' ');

    try {
      // Intentar via pg endpoint
      const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ query: stmt })
      });

      const body = await resp.json().catch(() => ({}));

      if (resp.ok || resp.status === 200) {
        console.log(`  ✅ [${i+1}/${statements.length}] ${preview}...`);
        exitosos++;
      } else {
        // Ignorar errores de "ya existe"
        const msg = body?.message || body?.error || JSON.stringify(body);
        if (msg.includes('already exists') || msg.includes('ya existe') || msg.includes('duplicate')) {
          console.log(`  ⏭️  [${i+1}/${statements.length}] Ya existe: ${preview}...`);
          exitosos++;
        } else if (resp.status === 401 || resp.status === 403) {
          // Key no tiene permiso — necesitamos service_role real
          console.log(`  🔑 Permiso insuficiente para: ${preview}...`);
          fallidos++;
          errores.push({ stmt: preview, error: 'Requiere service_role key' });
        } else {
          console.log(`  ⚠️  [${i+1}/${statements.length}] ${preview}...`);
          console.log(`         Error: ${msg.substring(0, 80)}`);
          fallidos++;
          errores.push({ stmt: preview, error: msg });
        }
      }
    } catch (e) {
      console.log(`  ❌ [${i+1}/${statements.length}] ${preview}... → ${e.message}`);
      fallidos++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Exitosos:  ${exitosos}`);
  console.log(`❌ Fallidos:  ${fallidos}`);

  if (fallidos > 0) {
    console.log('\n⚠️  ACCIÓN REQUERIDA: La key publishable no tiene permisos para crear tablas.');
    console.log('👉 Ve al SQL Editor de tu proyecto Supabase y ejecuta:');
    console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    console.log('   → Pega el contenido de: backend/src/config/migration.sql');
    console.log('\n🔑 O bien, necesitas la service_role key (Settings → API → service_role)');
  } else {
    console.log('\n🎉 ¡Migraciones completadas! Emma está lista.');
  }
}

main();
