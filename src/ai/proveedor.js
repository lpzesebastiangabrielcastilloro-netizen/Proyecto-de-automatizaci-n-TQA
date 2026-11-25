import { config } from '../../server/config.js';

/** Elige el proveedor de IA según la configuración. "local" = reglas propias, sin servicio externo. */
export function infoProveedor() {
  const { proveedor, anthropicKey, geminiKey, anthropicModelo, geminiModelo } = config.ia;
  if (proveedor === 'local') return { proveedor: 'local', modelo: 'reglas locales' };
  if ((proveedor === 'anthropic' || proveedor === 'auto') && anthropicKey) return { proveedor: 'anthropic', modelo: anthropicModelo };
  if ((proveedor === 'gemini' || proveedor === 'auto') && geminiKey) return { proveedor: 'gemini', modelo: geminiModelo };
  return { proveedor: 'local', modelo: 'reglas locales' };
}

function extraerJson(texto) {
  const limpio = String(texto).replace(/```json|```/g, '').trim();
  const ini = limpio.indexOf('{'); const fin = limpio.lastIndexOf('}');
  if (ini < 0 || fin < 0) throw new Error('La IA no devolvió JSON');
  return JSON.parse(limpio.slice(ini, fin + 1));
}

/** Pide a la IA una respuesta en JSON. Lanza un error si el proveedor es local o falla. */
export async function pedirJson({ sistema, usuario, maxTokens = 2500 }) {
  const info = infoProveedor();
  if (info.proveedor === 'local') throw new Error('Sin proveedor de IA configurado');
  if (info.proveedor === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(45000),
      headers: { 'content-type': 'application/json', 'x-api-key': config.ia.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: info.modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: 'user', content: usuario }] }),
    });
    if (!r.ok) throw new Error(`Anthropic respondió HTTP ${r.status}`);
    const j = await r.json();
    return { datos: extraerJson(j.content.map((b) => b.text || '').join('')), ...info };
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${info.modelo}:generateContent?key=${config.ia.geminiKey}`, {
    method: 'POST', signal: AbortSignal.timeout(45000), headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: usuario }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens } }),
  });
  if (!r.ok) throw new Error(`Gemini respondió HTTP ${r.status}`);
  const j = await r.json();
  return { datos: extraerJson(j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''), ...info };
}
