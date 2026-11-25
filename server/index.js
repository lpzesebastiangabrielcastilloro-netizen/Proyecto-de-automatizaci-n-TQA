import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { catalogoPublico, seleccionar, todosLosCasos } from '../tests/catalogo.js';
import { crearCorrida, ejecutarCorrida } from './ejecutor.js';
import { generarSalidas } from './salidas.js';
import { correoValido, smtpConfigurado } from '../src/mailer.js';
import { infoProveedor } from '../src/ai/proveedor.js';
import { analizarCaso, PANTALLAS, EJEMPLO } from '../src/ai/generador.js';
import { casoDesdePasos } from '../src/ai/dsl.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(config.raiz, 'public')));
app.use('/archivos', express.static(config.carpetaEjecuciones, { fallthrough: true, index: false }));

const corridas = new Map();
let ocupada = null;

// Recuperar el historial guardado en disco
fs.mkdirSync(config.carpetaEjecuciones, { recursive: true });
for (const d of fs.readdirSync(config.carpetaEjecuciones)) {
  const f = path.join(config.carpetaEjecuciones, d, 'resultado.json');
  if (fs.existsSync(f)) { try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); corridas.set(c.id, c); } catch { /* archivo dañado */ } }
}

const publico = (c) => ({ ...c });
const resumenLista = (c) => ({ id: c.id, suite: c.suite, tipo: c.tipo, estado: c.estado, inicio: c.inicio || c.creada, duracionMs: c.duracionMs, resumen: c.resumen, resultadoGlobal: c.resultadoGlobal, archivos: c.archivos, correo: c.correo?.estado || null, email: c.email });

function lanzar(corrida, casosDef) {
  corridas.set(corrida.id, corrida); ocupada = corrida.id;
  ejecutarCorrida(corrida, casosDef, { generarSalidas }).catch(() => {}).finally(() => { ocupada = null; });
}

app.get('/api/sistema', async (req, res) => {
  try { const r = await fetch(config.urlSistema, { signal: AbortSignal.timeout(3000) }); res.json({ disponible: r.status < 500, url: config.urlSistema }); }
  catch { res.json({ disponible: false, url: config.urlSistema }); }
});
app.get('/api/configuracion', (req, res) => res.json({ smtp: smtpConfigurado(), ia: infoProveedor(), fechaFija: config.fechaFija || null, ocupada }));
app.get('/api/catalogo', (req, res) => res.json(catalogoPublico()));

app.post('/api/ejecuciones', (req, res) => {
  const { tipo, suite, casos, email } = req.body || {};
  if (ocupada) return res.status(409).json({ error: 'Ya hay una ejecución en curso. Espera a que termine.' });
  if (!correoValido(email)) return res.status(400).json({ error: 'Ingresa un correo válido, por ejemplo nombre@dominio.com.' });
  if (!['funcional', 'no_funcional'].includes(tipo)) return res.status(400).json({ error: 'Selecciona el tipo de pruebas.' });
  const lista = seleccionar({ tipo, suite, casos });
  if (!lista.length) return res.status(400).json({ error: 'La suite o los casos seleccionados no existen.' });
  const alcance = Array.isArray(casos) && casos.length && casos.length < todosLosCasos.filter((c) => c.tipo === tipo && c.suite === suite).length ? `${lista.length} casos seleccionados` : 'Categoría completa';
  const corrida = crearCorrida({ tipo, suite, alcance, email: email.trim(), casos: lista });
  lanzar(corrida, lista);
  res.status(202).json({ id: corrida.id });
});
app.get('/api/ejecuciones', (req, res) => res.json([...corridas.values()].sort((a, b) => String(b.inicio || b.creada).localeCompare(String(a.inicio || a.creada))).map(resumenLista)));
app.get('/api/ejecuciones/:id', (req, res) => { const c = corridas.get(req.params.id); return c ? res.json(publico(c)) : res.status(404).json({ error: 'Ejecución no encontrada.' }); });

// ---------------- IA
app.get('/api/ia/estado', (req, res) => res.json({ ...infoProveedor(), ejemplo: EJEMPLO, pantallas: Object.entries(PANTALLAS).map(([id, p]) => ({ id, nombre: p.nombre })) }));
app.post('/api/ia/analizar', async (req, res) => {
  try { res.json(await analizarCaso(req.body || {})); }
  catch (e) { res.status(e.codigo || 500).json({ error: e.codigo ? e.message : 'No se pudo analizar el caso: ' + e.message }); }
});
app.post('/api/ia/ejecutar', (req, res) => {
  const { titulo, gherkin, pasos, escenarios, email } = req.body || {};
  if (ocupada) return res.status(409).json({ error: 'Ya hay una ejecución en curso. Espera a que termine.' });
  if (!correoValido(email)) return res.status(400).json({ error: 'Ingresa un correo válido para recibir los reportes.' });
  if (!Array.isArray(pasos) || !pasos.length) return res.status(400).json({ error: 'No hay pasos aprobados para ejecutar.' });
  try {
    const ejecutables = (l) => l.filter((p) => p.verificado !== false);
    const defs = [casoDesdePasos({ id: 'TC-IA-001', titulo: titulo || 'Escenario principal', gherkin, pasos: ejecutables(pasos) })];
    (escenarios || []).forEach((e, i) => { if (e.pasos?.length) defs.push(casoDesdePasos({ id: `TC-IA-${String(i + 2).padStart(3, '0')}`, titulo: `${e.tipo === 'borde' ? 'Borde' : 'Negativo'}: ${e.titulo}`, gherkin: e.gherkin, pasos: ejecutables(e.pasos) })); });
    const corrida = crearCorrida({ tipo: 'ia', suite: 'Generados con IA', alcance: `${defs.length} escenarios aprobados`, email: email.trim(), casos: defs, origen: 'ia' });
    lanzar(corrida, defs);
    res.status(202).json({ id: corrida.id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.listen(config.puerto, () => {
  console.log(`\n  Banco de pruebas Body Solid listo en http://localhost:${config.puerto}`);
  console.log(`  Sistema bajo prueba: ${config.urlSistema}`);
  console.log(`  Correo: ${smtpConfigurado() ? 'SMTP configurado' : 'modo simulado (sin SMTP)'} · IA: ${infoProveedor().proveedor}\n`);
});
