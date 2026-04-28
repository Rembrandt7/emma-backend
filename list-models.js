// list-models.js — Lista todos los modelos Gemini disponibles
import dotenv from 'dotenv';
dotenv.config();

const KEY = process.env.GEMINI_API_KEY;

const resp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`
);
const data = await resp.json();

if (data.error) {
  console.error('Error:', data.error.message);
} else {
  const modelos = (data.models || [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .sort();

  console.log('\n✅ Modelos disponibles con tu API Key:\n');
  modelos.forEach(m => console.log('  •', m));
  console.log(`\nTotal: ${modelos.length} modelos\n`);
}
