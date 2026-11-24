import { inspeccionar, existeLocator, PANTALLAS } from './inspector.js';
import { pedirJson, infoProveedor } from './proveedor.js';
import { config } from '../../server/config.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const VAGAS = ['correctamente', 'adecuadamente', 'rapido', 'rapidamente', 'bien', 'normal', 'facilmente', 'apropiado', 'similar', 'etc'];
const VERBOS = /(ingres|escrib|digit|introduc|seleccion|presion|puls|clic|click|abr[ea]|naveg)/;

export const EJEMPLO = 'Verificar que un usuario registrado pueda iniciar sesión con credenciales válidas. Al ingresar usuario y contraseña correctos y seleccionar Iniciar sesión, debe visualizarse el panel principal.';

// ---------------------------------------------------------------- generador local (reglas)
function cuentaPorTexto(t, porDefecto) {
  const n = norm(t);
  if (/entrenador/.test(n)) return 'entrenador';
  if (/cliente|socio/.test(n)) return 'cliente';
  if (/administrador|admin/.test(n)) return 'admin';
  return porDefecto || 'admin';
}
function valorExplicito(n, palabras) {
  const m = n.match(new RegExp(`(?:${palabras})\\s+["“'\`]?([a-z0-9_.@!#-]{3,})["”'\`]?`));
  return m && (/[_@\d!#]/.test(m[1]) || /["“'`]/.test(n.charAt(n.indexOf(m[0]) + m[0].indexOf(m[1]) - 1))) ? m[1] : null;
}
const FRASES = [
  [/panel principal|panel|dashboard|pantalla principal/, { accion: 'verificar_texto', texto: 'Panel General' }, 'el panel principal'],
  [/mensaje de error|error|rechaz|no (?:se )?permit|denegad/, { accion: 'verificar_texto_alguno', textos: ['incorrecta', 'no encontrado', 'inactiva', 'requeridos', 'Fallo'] }, 'un mensaje de error'],
];

export function generarLocal(texto, insp) {
  const original = String(texto).replace(/\s+/g, ' ').trim();
  const n = norm(original);
  const advertencias = []; const ambiguedades = []; const datosFaltantes = []; const preguntas = [];

  // 1. dividir en oraciones y separar acciones de resultado esperado
  const oraciones = original.split(/(?<=[.;])\s+/);
  let partesAccion = []; let esperadoTxt = '';
  for (const o of oraciones) {
    const no = norm(o);
    const corte = no.search(/\b(debe|deberia|se espera|resultado esperado|entonces)\b/);
    if (VERBOS.test(no)) partesAccion.push(corte > 0 ? o.slice(0, corte) : o);
    if (corte >= 0) esperadoTxt += ' ' + o.slice(corte);
  }
  const accionTxt = partesAccion.join(' ');
  const nAccion = norm(accionTxt);

  // 2. ubicar elementos reales de la pantalla dentro del texto de acciones
  const cuenta = cuentaPorTexto(original, insp.cuenta || 'admin');
  const demo = config.cuentas[cuenta];
  const hallados = [];
  for (const e of insp.elementos) {
    const claves = [];
    if (e.tipo === 'password') claves.push('contrasena', 'clave', 'password');
    else if (e.elemento === 'input') { const et = norm(e.etiqueta); if (et.includes('usuario')) claves.push('usuario'); else if (et) claves.push(et); if (norm(e.placeholder).includes('buscar')) claves.push('buscar', 'busca'); }
    else if (e.texto) claves.push(norm(e.texto));
    for (const k of claves) { const i = nAccion.indexOf(k); if (i >= 0) { hallados.push({ e, i, k }); break; } }
  }
  hallados.sort((a, b) => a.i - b.i);

  // 3. valores de prueba
  const usuarioExpl = valorExplicito(n, 'usuario|usuaria');
  const claveExpl = valorExplicito(n, 'contrasena|clave|password');
  const invalidas = /(invalid|incorrect|erron|equivocad|inexistent)/.test(n);
  const valorUsuario = usuarioExpl || (invalidas && /usuario (invalid|inexistent|incorrect)/.test(n) ? 'usuario_inexistente' : demo.usuario);
  const valorClave = claveExpl || (invalidas && !/usuario (invalid|inexistent)/.test(n) ? 'clave-equivocada' : demo.clave);
  if (!usuarioExpl || !claveExpl) {
    datosFaltantes.push(`No se indicaron las credenciales concretas; se asumió la cuenta de demostración "${demo.usuario}" (${demo.rol}).`);
    preguntas.push('¿Qué usuario y contraseña de prueba se deben usar?');
  }

  // 4. pasos ejecutables
  const pasos = [{ accion: 'abrir', url: '/', descripcion: 'Abrir la aplicación', verificado: true }];
  const prep = [...insp.preparacion];
  if (insp.cuenta) {
    prep.push({ accion: 'clic_texto', texto: 'PORTAL MIEMBROS' },
      { accion: 'escribir', locator: { tipo: 'placeholder', valor: 'Ej. carlos_admin' }, valor: demo.usuario },
      { accion: 'escribir', locator: { tipo: 'placeholder', valor: '••••••••' }, valor: demo.clave, sensible: true },
      { accion: 'clic', locator: { tipo: 'rol', rol: 'button', nombre: 'Iniciar Sesión' } });
  }
  prep.forEach((p) => pasos.push({ ...p, verificado: true }));
  const hechos = new Set();
  for (const h of hallados) {
    const { e } = h; const clave = JSON.stringify(e.locator); if (hechos.has(clave)) continue; hechos.add(clave);
    if (['input', 'textarea'].includes(e.elemento)) {
      const esClave = e.tipo === 'password';
      pasos.push({ accion: 'escribir', locator: e.locator, valor: esClave ? valorClave : valorUsuario, sensible: esClave, verificado: true });
    } else pasos.push({ accion: 'clic', locator: e.locator, verificado: true });
  }
  if (!hallados.length) { advertencias.push(`No se reconocieron acciones sobre elementos de la pantalla inspeccionada (${insp.nombre}). Prueba eligiendo otra pantalla, por ejemplo el formulario de acceso.`); ambiguedades.push('No se describen acciones concretas que puedan asociarse a elementos reales de la pantalla.'); preguntas.push('¿Qué botones o campos se usan en cada paso?'); }

  // 5. resultado esperado
  let esperado = null; let esperadoNatural = '';
  const nEsp = norm(esperadoTxt);
  for (const [re, paso, natural] of FRASES) if (re.test(nEsp)) { esperado = { ...paso, verificado: null }; esperadoNatural = natural; break; }
  if (!esperado) {
    const q = esperadoTxt.match(/["“'`]([^"”'`]{3,60})["”'`]/);
    const f = esperadoTxt.match(/(?:visualiz\w*|mostr\w*|ver|aparec\w*|muestr\w*)\s+(?:se\s+)?(?:el|la|los|las|un|una)?\s*([^.,;]{3,50})/i);
    const frase = q ? q[1] : f ? f[1].trim() : '';
    if (frase) { esperado = { accion: 'verificar_texto', texto: frase, verificado: null }; esperadoNatural = frase; advertencias.push(`El resultado esperado "${frase}" se verificará como texto visible tal cual; confirma que coincide con lo que muestra la aplicación.`); }
  }
  if (esperado) pasos.push(esperado);
  else { ambiguedades.push('No se indica un resultado esperado verificable.'); preguntas.push('¿Qué debe mostrar o ocurrir al finalizar para considerar que la prueba pasó?'); }

  // 6. ambigüedades
  for (const v of VAGAS) if (new RegExp(`\\b${v}`).test(n)) ambiguedades.push(`La expresión "${v}" es poco precisa: conviene indicar un criterio medible.`);
  if (/credenciales (validas|correctas)|datos (validos|correctos)/.test(n) && !usuarioExpl) ambiguedades.push('"Credenciales válidas" no identifica qué cuenta usar.');
  if (!/precondicion/.test(n) && !/(registrado|existente|habilitad|activo|disponible)/.test(n)) { ambiguedades.push('No se indican precondiciones (estado previo del usuario o del sistema).'); preguntas.push('¿Qué estado previo deben tener el usuario y el sistema?'); }

  // 7. Gherkin
  const nombreFeature = /iniciar sesion|login|acceso/.test(n) ? 'Inicio de sesión' : original.replace(/^(verificar|comprobar|validar)( que)?\s*/i, '').split(/[.,]/)[0].split(' ').slice(0, 7).join(' ').replace(/^./, (c) => c.toUpperCase());
  const lineas = [`Feature: ${nombreFeature}`, `  Scenario: ${esperadoNatural ? `Resultado: ${esperadoNatural}` : nombreFeature + ' (escenario principal)'}`, `    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}`];
  let primero = true;
  for (const p of pasos.slice(1 + prep.length)) {
    const kw = primero ? 'When' : 'And';
    if (p.accion === 'escribir') { lineas.push(`    ${kw} ingresa ${p.sensible ? 'la contraseña "••••••••"' : `el usuario "${p.valor}"`}`); primero = false; }
    else if (p.accion === 'clic') { lineas.push(`    ${kw} selecciona ${p.locator.tipo === 'rol' && p.locator.rol === 'button' ? 'el botón' : 'la opción'} "${p.locator.nombre || p.locator.valor}"`); primero = false; }
  }
  if (esperado) lineas.push(`    Then el sistema muestra ${esperadoNatural}`);
  const gherkin = lineas.join('\n');

  // 8. escenarios adicionales (negativos y de borde) derivados del caso base
  const escenarios = [];
  const idxClave = pasos.findIndex((p) => p.accion === 'escribir' && p.sensible && !insp.cuenta);
  const idxUsuario = pasos.findIndex((p) => p.accion === 'escribir' && !p.sensible && !insp.cuenta);
  const mutar = (cambios, quitar = []) => pasos.filter((p, i) => !quitar.includes(i) && p !== esperado).map((p, i0) => p).map((p) => { const idx = pasos.indexOf(p); return cambios[idx] ? { ...p, ...cambios[idx] } : p; });
  const conError = { accion: 'verificar_texto_alguno', textos: ['incorrecta', 'no encontrado', 'inactiva', 'requeridos', 'Fallo'], verificado: null };
  if (idxClave > 0 && idxUsuario > 0) {
    escenarios.push(
      { tipo: 'negativo', titulo: 'Contraseña incorrecta', gherkin: `Feature: ${nombreFeature}\n  Scenario: Contraseña incorrecta\n    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}\n    When ingresa un usuario válido y una contraseña incorrecta\n    And selecciona el botón de acceso\n    Then el sistema muestra un mensaje de error y no permite el acceso`, pasos: [...mutar({ [idxClave]: { valor: 'clave-equivocada' } }), conError] },
      { tipo: 'negativo', titulo: 'Usuario inexistente', gherkin: `Feature: ${nombreFeature}\n  Scenario: Usuario inexistente\n    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}\n    When ingresa un usuario que no existe\n    And selecciona el botón de acceso\n    Then el sistema muestra un mensaje de error`, pasos: [...mutar({ [idxUsuario]: { valor: 'usuario_que_no_existe' } }), conError] },
      { tipo: 'borde', titulo: 'Usuario de 256 caracteres', gherkin: `Feature: ${nombreFeature}\n  Scenario: Usuario con longitud extrema\n    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}\n    When ingresa un usuario de 256 caracteres\n    And selecciona el botón de acceso\n    Then el sistema rechaza el acceso sin fallar`, pasos: [...mutar({ [idxUsuario]: { valor: 'a'.repeat(256) } }), conError] },
      { tipo: 'borde', titulo: 'Campos vacíos', gherkin: `Feature: ${nombreFeature}\n  Scenario: Envío con campos vacíos\n    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}\n    When selecciona el botón de acceso sin completar los campos\n    Then el sistema no inicia sesión`, pasos: [...pasos.filter((p, i) => i !== idxClave && i !== idxUsuario && p !== esperado), { accion: 'verificar_ausente', texto: 'Cerrar Sesión', verificado: null }] },
    );
  } else {
    escenarios.push(
      { tipo: 'negativo', titulo: 'Datos obligatorios vacíos', gherkin: `Feature: ${nombreFeature}\n  Scenario: Datos obligatorios vacíos\n    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}\n    When intenta completar la acción sin ingresar datos\n    Then el sistema muestra un mensaje de validación` },
      { tipo: 'borde', titulo: 'Texto de longitud extrema', gherkin: `Feature: ${nombreFeature}\n  Scenario: Entrada con longitud extrema\n    Given que el usuario se encuentra en ${insp.nombre.toLowerCase()}\n    When ingresa un texto de 256 caracteres\n    Then el sistema responde sin errores` },
    );
  }
  return { resumen: `Interpretación local: ${original.length > 140 ? original.slice(0, 140) + '…' : original}`, ambiguedades, datosFaltantes, preguntas, gherkin, escenarios, pasos, advertencias };
}

// ---------------------------------------------------------------- análisis principal
const SISTEMA_IA = `Eres un ingeniero de QA. Recibes un requerimiento o caso de prueba en español y la lista REAL de elementos de la pantalla de la aplicación.
Responde SOLO con JSON con esta forma:
{"resumen": string, "ambiguedades": [string], "datosFaltantes": [string], "preguntas": [string], "gherkin": "Feature/Scenario con Given, When, Then y And (en español)", "escenarios": [{"tipo":"negativo|borde|alternativo","titulo":string,"gherkin":string,"pasos":[paso]}], "pasos":[paso]}
Cada paso es {"accion": "abrir|clic_texto|clic|escribir|verificar_texto|verificar_texto_alguno|verificar_ausente|verificar_visible", "locator": {...}, "valor": string, "texto": string, "textos":[string], "url": "/", "sensible": boolean}.
REGLAS: (1) Los "locator" deben copiarse EXACTAMENTE de la lista de elementos recibida; NUNCA inventes selectores. (2) Si falta información, decláralo en "ambiguedades", "datosFaltantes" y "preguntas" en lugar de suponerla. (3) Empieza los pasos con {"accion":"abrir","url":"/"} y usa los pasos de "preparacion" cuando existan. (4) Usa solo los datos de prueba de "cuentasDemo". (5) Marca "sensible": true en contraseñas.`;

export async function analizarCaso({ texto, pantalla = 'login' }) {
  if (!String(texto || '').trim()) throw Object.assign(new Error('Escribe o carga un caso de prueba o requerimiento.'), { codigo: 400 });
  const insp = await inspeccionar(pantalla);
  const info = infoProveedor(); let r = null; let aviso = null; let proveedor = 'local'; let modelo = 'reglas locales';

  if (info.proveedor !== 'local') {
    try {
      const resp = await pedirJson({
        sistema: SISTEMA_IA,
        usuario: JSON.stringify({ requerimiento: texto, pantalla: { nombre: insp.nombre, titulos: insp.titulos, preparacion: insp.preparacion, elementos: insp.elementos.map(({ locator, etiqueta, placeholder, texto: t, elemento, tipo }) => ({ locator, etiqueta, placeholder, texto: t, elemento, tipo })) }, cuentasDemo: Object.fromEntries(Object.entries(config.cuentas).map(([k, v]) => [k, { usuario: v.usuario, clave: v.clave, rol: v.rol }])) }),
        maxTokens: 3500,
      });
      r = resp.datos; proveedor = resp.proveedor; modelo = resp.modelo;
    } catch (e) { aviso = `No se pudo usar la IA externa (${e.message}); se aplicaron las reglas locales.`; }
  }
  if (!r) r = generarLocal(texto, insp);

  const arr = (x) => (Array.isArray(x) ? x : []);
  const advertencias = [...arr(r.advertencias)]; if (aviso) advertencias.unshift(aviso);

  // Anti-invención: todo localizador debe existir en la aplicación real inspeccionada.
  const verificar = (lista) => arr(lista).map((p) => {
    if (p.locator && !p.verificado) { p.verificado = existeLocator(insp.elementos, p.locator); if (!p.verificado) advertencias.push(`El localizador "${p.locator.nombre || p.locator.valor}" propuesto no existe en la pantalla inspeccionada: ese paso no se ejecutará hasta corregirlo.`); }
    return p;
  });
  const pasos = verificar(r.pasos);
  const escenarios = arr(r.escenarios).map((e) => ({ ...e, pasos: e.pasos ? verificar(e.pasos) : undefined }));
  return {
    proveedor, modelo, pantalla: { id: pantalla, nombre: insp.nombre }, resumen: r.resumen || '', ambiguedades: arr(r.ambiguedades), datosFaltantes: arr(r.datosFaltantes), preguntas: arr(r.preguntas),
    gherkin: r.gherkin || '', escenarios, pasos, advertencias,
    locators: insp.elementos.map(({ locator, etiqueta, placeholder, texto: t, elemento, tipo }) => ({ locator, etiqueta, placeholder, texto: t, elemento, tipo })),
  };
}
export { PANTALLAS };
