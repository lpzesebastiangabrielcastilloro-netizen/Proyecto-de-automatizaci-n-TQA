const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONO = { PASS: '✓', FAIL: '✕', SKIPPED: '–', 'NOT RUN': '○' };
const ETIQ_ESTADO = { pendiente: 'Pendiente', en_curso: 'En curso', finalizada: 'Finalizada', fallida: 'Fallida' };
const correoValido = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(t).trim());
const dur = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);
const api = async (url, opciones) => {
  const r = await fetch(url, opciones && opciones.body ? { ...opciones, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opciones.body) } : opciones);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Error ${r.status}`), { estado: r.status });
  return j;
};
const guardarCorreo = (v) => { try { localStorage.setItem('qa-correo', v); } catch { /* sin almacenamiento */ } };
const leerCorreo = () => { try { return localStorage.getItem('qa-correo') || ''; } catch { return ''; } };

const estado = { catalogo: [], tipo: 'funcional', suite: null, corrida: null, sondeo: null, abiertos: new Set(), sistemaOk: false, ocupada: false, analisis: null };

// ---------------------------------------------------------------- pestañas
const tabs = { ejecutar: 'vista-ejecutar', ia: 'vista-ia', historial: 'vista-historial' };
function irA(nombre) {
  for (const [k, id] of Object.entries(tabs)) { $('#tab-' + k).setAttribute('aria-selected', k === nombre); $('#' + id).hidden = k !== nombre; }
  if (nombre === 'historial') cargarHistorial();
}
for (const k of Object.keys(tabs)) $('#tab-' + k).addEventListener('click', () => irA(k));

// ---------------------------------------------------------------- sistema bajo prueba
async function comprobarSistema() {
  try {
    const s = await api('/api/sistema'); estado.sistemaOk = s.disponible;
    $('#estado-sistema').className = 'estado-sistema ' + (s.disponible ? 'ok' : 'mal');
    $('#estado-sistema-texto').textContent = s.disponible ? `Body Solid disponible en ${s.url}` : `Body Solid no responde en ${s.url}`;
  } catch { estado.sistemaOk = false; $('#estado-sistema').className = 'estado-sistema mal'; $('#estado-sistema-texto').textContent = 'No se pudo comprobar el sistema'; }
  validar();
}

// ---------------------------------------------------------------- configuración
function pintarTipos() {
  const cont = $('#tipos'); cont.innerHTML = '';
  for (const t of estado.catalogo) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', t.clave === estado.tipo);
    b.textContent = t.nombre; b.addEventListener('click', () => { estado.tipo = t.clave; estado.suite = null; pintarTipos(); pintarSuites(); });
    cont.append(b);
  }
}
const tipoActual = () => estado.catalogo.find((t) => t.clave === estado.tipo);
function pintarSuites() {
  const cont = $('#suites'); cont.innerHTML = ''; const t = tipoActual(); if (!t) return;
  if (!estado.suite || !t.suites.some((s) => s.nombre === estado.suite)) estado.suite = t.suites[0].nombre;
  for (const s of t.suites) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'suite'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', s.nombre === estado.suite);
    b.innerHTML = `<strong>${esc(s.nombre)}</strong><span>${s.casos.length} ${s.casos.length === 1 ? 'caso' : 'casos'}</span>`;
    b.addEventListener('click', () => { estado.suite = s.nombre; pintarSuites(); });
    cont.append(b);
  }
  pintarCasos(); validar();
}
function pintarCasos() {
  const s = tipoActual()?.suites.find((x) => x.nombre === estado.suite); const cont = $('#casos'); cont.innerHTML = '';
  if (!s) return;
  for (const c of s.casos) {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox" value="${esc(c.id)}" checked><span><code>${esc(c.id)}</code>${esc(c.nombre)}</span>`;
    l.querySelector('input').addEventListener('change', validar); cont.append(l);
  }
}
document.querySelectorAll('input[name=alcance]').forEach((r) => r.addEventListener('change', () => { $('#casos').hidden = document.querySelector('input[name=alcance]:checked').value !== 'algunos'; validar(); }));

function validar() {
  const correo = $('#correo').value; const algunos = document.querySelector('input[name=alcance]:checked').value === 'algunos';
  const sel = [...document.querySelectorAll('#casos input:checked')].length;
  const ok = correoValido(correo) && estado.suite && (!algunos || sel > 0) && estado.sistemaOk && !estado.ocupada;
  $('#ejecutar').disabled = !ok;
  $('#aviso-config').textContent = !estado.sistemaOk ? 'No se puede ejecutar: Body Solid no responde. Inicia tu sistema y espera unos segundos.' : estado.ocupada ? 'Hay una ejecución en curso.' : algunos && sel === 0 ? 'Selecciona al menos un caso.' : '';
}
$('#correo').addEventListener('input', () => { $('#correo-error').hidden = true; $('#correo').removeAttribute('aria-invalid'); validar(); });
$('#correo').addEventListener('blur', () => {
  const v = $('#correo').value; const mal = v && !correoValido(v);
  $('#correo-error').hidden = !mal; $('#correo-error').textContent = mal ? 'El correo no tiene un formato válido. Ejemplo: nombre@dominio.com' : '';
  if (mal) $('#correo').setAttribute('aria-invalid', 'true');
});

$('#ejecutar').addEventListener('click', async () => {
  const algunos = document.querySelector('input[name=alcance]:checked').value === 'algunos';
  const casos = algunos ? [...document.querySelectorAll('#casos input:checked')].map((i) => i.value) : [];
  guardarCorreo($('#correo').value.trim());
  try {
    const { id } = await api('/api/ejecuciones', { method: 'POST', body: { tipo: estado.tipo, suite: estado.suite, casos, email: $('#correo').value.trim() } });
    seguir(id);
  } catch (e) { $('#aviso-config').textContent = e.message; }
});

// ---------------------------------------------------------------- mesa de ejecución
function seguir(id) {
  clearInterval(estado.sondeo); estado.abiertos.clear();
  const tick = async () => {
    try {
      const c = await api('/api/ejecuciones/' + id); estado.corrida = c; pintarMesa(c);
      estado.ocupada = c.estado === 'pendiente' || c.estado === 'en_curso'; validar();
      if (!estado.ocupada) clearInterval(estado.sondeo);
    } catch { clearInterval(estado.sondeo); }
  };
  irA('ejecutar'); tick(); estado.sondeo = setInterval(tick, 700);
}
function pintarMesa(c) {
  $('#vacio').hidden = true; $('#panel-ej').hidden = false;
  const fin = c.estado === 'finalizada' || c.estado === 'fallida';
  const badge = $('#estado-ej'); badge.hidden = false;
  const conFallos = c.estado === 'finalizada' && c.resumen && c.resumen.fail > 0;
  badge.className = 'estado-ej ' + c.estado + (conFallos ? ' conFallos' : '');
  badge.textContent = ETIQ_ESTADO[c.estado] + (c.estado === 'finalizada' ? (conFallos ? ' · con fallos' : ' · sin fallos') : '');
  $('#mesa-sub').innerHTML = `${esc(c.suite)} · ${esc(c.alcance)} · <span style="font-family:var(--mono);font-size:12.5px">${esc(c.id)}</span>` + (fin ? ` · ${dur(c.duracionMs)}` : '');

  const n = (e) => c.casos.filter((x) => x.estado === e).length;
  const pend = c.casos.length - n('PASS') - n('FAIL') - n('SKIPPED') - n('NOT RUN');
  const exito = c.casos.length ? Math.round((n('PASS') / c.casos.length) * 1000) / 10 : 0;
  $('#cifras').innerHTML = `<div class="cifra"><span>Casos</span><strong>${c.casos.length}</strong></div><div class="cifra pass"><span>PASS</span><strong>${n('PASS')}</strong></div><div class="cifra fail"><span>FAIL</span><strong>${n('FAIL')}</strong></div><div class="cifra skip"><span>SKIPPED</span><strong>${n('SKIPPED')}</strong></div><div class="cifra nr"><span>${fin ? 'NOT RUN' : 'Pendientes'}</span><strong>${fin ? n('NOT RUN') + pend : pend + n('NOT RUN')}</strong></div>`;

  $('#placa').innerHTML = c.casos.map((x) => {
    const cl = x.estado === 'PASS' ? 'pass' : x.estado === 'FAIL' ? 'fail' : x.estado === 'SKIPPED' ? 'skip' : x.estado === 'NOT RUN' ? 'nr' : x.estado === 'EN CURSO' ? 'curso' : '';
    const txt = ICONO[x.estado] || x.id.split('-').pop();
    return `<button type="button" role="listitem" class="poc ${cl}" data-id="${esc(x.id)}" title="${esc(x.id)} · ${esc(x.nombre)} · ${esc(x.estado)}" aria-label="${esc(x.id)} ${esc(x.nombre)}: ${esc(x.estado)}">${txt}</button>`;
  }).join('');
  $('#placa').querySelectorAll('.poc').forEach((b) => b.addEventListener('click', () => { estado.abiertos.add(b.dataset.id); pintarFilas(c); document.getElementById('fila-' + b.dataset.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));

  pintarFilas(c); pintarEntregables(c);
}
function pintarFilas(c) {
  $('#filas').innerHTML = c.casos.map((x) => {
    const abierto = estado.abiertos.has(x.id);
    const obs = x.estado === 'PENDIENTE' ? '' : x.estado === 'EN CURSO' ? 'Ejecutando…' : x.observacion || '';
    let fila = `<tr class="caso" id="fila-${esc(x.id)}" data-id="${esc(x.id)}" tabindex="0" aria-expanded="${abierto}"><td class="id">${esc(x.id)}</td><td><b>${esc(x.nombre)}</b><div class="sub">${esc(x.suite)}${x.fallaControlada ? ' · fallo controlado' : ''}</div></td><td><span class="est ${esc(x.estado)}">${ICONO[x.estado] ? ICONO[x.estado] + ' ' : ''}${esc(x.estado)}</span></td><td>${dur(x.duracionMs)}</td><td>${esc(obs)}${x.error ? `<div class="sub"><b>${esc(x.error.etiqueta)}</b></div>` : ''}</td></tr>`;
    if (abierto) fila += `<tr class="detalle"><td colspan="5"><ol class="pasos">${x.pasos.map((p) => `<li><span class="n ${esc(p.estado)}">${p.n}</span><div><b>${esc(p.descripcion)}</b><div class="sub">Esperado: ${esc(p.esperado)}</div><div class="sub">Obtenido: ${esc(p.obtenido || (p.estado === 'NO EJECUTADO' ? 'No se ejecutó' : '—'))}</div>${p.evidencia?.tipo === 'captura' ? `<a href="/archivos/${esc(c.id)}/${esc(p.evidencia.archivo)}" target="_blank" rel="noopener"><img loading="lazy" src="/archivos/${esc(c.id)}/${esc(p.evidencia.archivo)}" alt="Evidencia del paso ${p.n}"></a>` : ''}</div></li>`).join('')}</ol></td></tr>`;
    return fila;
  }).join('');
  document.querySelectorAll('#filas tr.caso').forEach((tr) => {
    const alt = () => { const id = tr.dataset.id; estado.abiertos.has(id) ? estado.abiertos.delete(id) : estado.abiertos.add(id); pintarFilas(c); };
    tr.addEventListener('click', alt); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alt(); } });
  });
}
function pintarEntregables(c) {
  const fin = c.estado === 'finalizada' || c.estado === 'fallida'; const cont = $('#entregables'); const ia = $('#resumen-ia');
  if (!fin) { cont.hidden = true; ia.hidden = true; return; }
  const base = `/archivos/${c.id}/`; const a = c.archivos || {}; const mail = c.correo;
  const tarjetas = [];
  tarjetas.push(a.pdf ? `<div class="entrega ok"><h4>Informe detallado (PDF)</h4><p>Pasos, resultados y evidencias por caso.</p><a href="${base}${esc(a.pdf)}" target="_blank" rel="noopener">Abrir informe</a></div>` : `<div class="entrega mal"><h4>Informe detallado (PDF)</h4><p>${esc(a.errorPdf || 'No se pudo generar.')}</p></div>`);
  tarjetas.push(a.html ? `<div class="entrega ok"><h4>Reporte resumen (HTML)</h4><p>Tabla con el estado de todos los casos.</p><a href="${base}${esc(a.html)}" target="_blank" rel="noopener">Abrir reporte</a></div>` : '');
  if (mail) {
    const cls = mail.estado === 'enviado' ? 'ok' : mail.estado === 'simulado' ? 'sim' : 'mal';
    const tit = mail.estado === 'enviado' ? `Correo enviado a ${esc(mail.destinatario)}` : mail.estado === 'simulado' ? 'Correo en modo simulado' : 'El correo no se pudo enviar';
    tarjetas.push(`<div class="entrega ${cls}"><h4>${tit}</h4><p>${esc(mail.detalle)}</p>${mail.asunto ? `<p><b>Asunto:</b> ${esc(mail.asunto)}</p>` : ''}${a.eml ? `<a href="${base}${esc(a.eml)}" download>Descargar el correo simulado</a>` : ''}</div>`);
  }
  cont.innerHTML = tarjetas.join(''); cont.hidden = false;
  if (c.resumenIA) {
    const r = c.resumenIA; const origen = r.proveedor === 'local' ? 'reglas locales (sin IA externa)' : `IA · ${esc(r.proveedor)} ${esc(r.modelo || '')}`;
    ia.innerHTML = `<h4>Resumen ejecutivo</h4><p>${esc(r.texto)}</p>${(r.causas || []).length ? `<p><b>Posibles causas de los fallos</b></p><ul>${r.causas.map((x) => `<li><b>${esc(x.caso)}:</b> ${esc(x.causa)} <span class="sub">(Evidencia: ${esc(x.evidencia)})</span></li>`).join('')}</ul>` : ''}<small>Generado por ${origen}. Los estados de cada caso provienen de la ejecución real.</small>`;
    ia.hidden = false;
  } else ia.hidden = true;
}

// ---------------------------------------------------------------- historial
async function cargarHistorial() {
  const lista = await api('/api/ejecuciones').catch(() => []);
  $('#hist-vacio').hidden = lista.length > 0;
  $('#filas-hist').innerHTML = lista.map((c) => {
    const r = c.resumen; const base = `/archivos/${c.id}/`;
    return `<tr><td class="id"><a class="enlace" href="#" data-id="${esc(c.id)}">${esc(c.id)}</a><div class="sub">${new Date(c.inicio).toLocaleString('es-BO')}</div></td><td>${esc(c.suite)}</td><td><span class="est ${r && r.fail ? 'FAIL' : c.estado === 'fallida' ? 'NOT RUN' : 'PASS'}">${esc(c.resultadoGlobal || ETIQ_ESTADO[c.estado])}</span></td><td>${r ? `${r.pass} / ${r.fail}` : '—'}</td><td>${c.archivos?.pdf ? `<a class="enlace" href="${base}${esc(c.archivos.pdf)}" target="_blank" rel="noopener">PDF</a> · ` : ''}${c.archivos?.html ? `<a class="enlace" href="${base}${esc(c.archivos.html)}" target="_blank" rel="noopener">HTML</a>` : '—'}</td><td>${esc(c.correo || '—')}<div class="sub">${esc(c.email || '')}</div></td></tr>`;
  }).join('');
  document.querySelectorAll('#filas-hist a[data-id]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); seguir(a.dataset.id); }));
}

// ---------------------------------------------------------------- asistente de IA
async function iniciarIA() {
  const info = await api('/api/ia/estado').catch(() => null); if (!info) return;
  $('#proveedor-ia').innerHTML = info.proveedor === 'local' ? '<b>Modo local:</b> sin clave de IA, se usan reglas propias. Define ANTHROPIC_API_KEY o GEMINI_API_KEY para usar un modelo.' : `<b>IA activa:</b> ${esc(info.proveedor)} · ${esc(info.modelo)}`;
  $('#pantalla-ia').innerHTML = info.pantallas.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('');
  $('#pantalla-ia').value = 'login';
  $('#cargar-ejemplo').addEventListener('click', () => { $('#texto-ia').value = info.ejemplo; $('#texto-ia').focus(); });
}
$('#analizar').addEventListener('click', async () => {
  const texto = $('#texto-ia').value.trim(); const err = $('#ia-error'); err.hidden = true;
  if (!texto) { err.textContent = 'Escribe o carga un caso de prueba antes de analizar.'; err.hidden = false; return; }
  $('#ia-vacio').hidden = true; $('#ia-resultado').hidden = true; $('#ia-cargando').hidden = false; $('#analizar').disabled = true;
  try { estado.analisis = await api('/api/ia/analizar', { method: 'POST', body: { texto, pantalla: $('#pantalla-ia').value } }); pintarAnalisis(estado.analisis); }
  catch (e) { err.textContent = e.message; err.hidden = false; $('#ia-vacio').hidden = false; }
  finally { $('#ia-cargando').hidden = true; $('#analizar').disabled = false; }
});
function describirPaso(p) {
  const nom = p.locator ? p.locator.nombre || p.locator.valor : '';
  return ({ abrir: 'Abrir la aplicación', clic_texto: `Seleccionar "${p.texto}"`, clic: `Seleccionar "${nom}"`, escribir: `Escribir ${p.sensible ? '••••••••' : `"${p.valor}"`} en "${nom}"`, verificar_texto: `Verificar que se muestra "${p.texto}"`, verificar_texto_alguno: `Verificar un mensaje como ${(p.textos || []).map((t) => `"${t}"`).join(' o ')}`, verificar_ausente: `Verificar que NO se muestra "${p.texto}"`, verificar_visible: `Verificar que es visible "${nom}"` })[p.accion] || p.accion;
}
function pintarAnalisis(a) {
  const lista = (t, arr) => (arr.length ? `<div class="bloque alerta"><h3>${t}</h3><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
  const origen = a.proveedor === 'local' ? 'Reglas locales (sin IA externa)' : `IA · ${a.proveedor} · ${a.modelo}`;
  const pasosHtml = (p) => `<ul class="lista-pasos">${p.map((x, i) => `<li class="${x.verificado === false ? 'no' : ''}"><code>${x.verificado === false ? 'No existe' : x.verificado ? 'Verificado' : 'Al ejecutar'}</code><span>${i + 1}. ${esc(describirPaso(x))}</span></li>`).join('')}</ul>`;
  $('#ia-resultado').innerHTML = `
    <div class="bloque aviso"><h3>Interpretación</h3><p>${esc(a.resumen)}</p><p class="ayuda" style="margin-top:6px">Generado por: ${esc(origen)} · Pantalla inspeccionada: ${esc(a.pantalla.nombre)}</p></div>
    ${a.advertencias.length ? `<div class="bloque alerta"><h3>Advertencias</h3><ul>${a.advertencias.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${lista('Ambigüedades detectadas', a.ambiguedades)}${lista('Datos faltantes', a.datosFaltantes)}${a.preguntas.length ? `<div class="bloque"><h3>Preguntas para aclarar</h3><ul>${a.preguntas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="bloque"><h3>Escenario en Gherkin</h3><pre class="gherkin">${esc(a.gherkin)}</pre></div>
    ${a.escenarios.length ? `<div class="bloque"><h3>Escenarios negativos y de borde</h3><div class="escenarios">${a.escenarios.map((e, i) => `<div class="esc"><header><span class="tipo ${esc(e.tipo)}">${esc(e.tipo)}</span>${e.pasos ? `<label class="chk"><input type="checkbox" data-esc="${i}" checked> Ejecutar</label>` : '<span class="sub">Solo diseño</span>'}</header><b>${esc(e.titulo)}</b><pre>${esc(e.gherkin)}</pre></div>`).join('')}</div></div>` : ''}
    <div class="bloque"><h3>Pasos automatizables</h3><p class="ayuda" style="margin-bottom:8px">Solo se usan elementos que existen en la aplicación. Revisa cada paso antes de aprobar.</p>${pasosHtml(a.pasos)}</div>
    <details class="bloque"><summary>Elementos reales encontrados en la pantalla (${a.locators.length})</summary><div class="tabla-casos"><table class="etiquetas-loc"><thead><tr><th>Elemento</th><th>Localizador</th></tr></thead><tbody>${a.locators.map((l) => `<tr><td>${esc(l.elemento)} ${esc(l.etiqueta || l.texto || l.placeholder)}</td><td><code>${esc(JSON.stringify(l.locator))}</code></td></tr>`).join('')}</tbody></table></div></details>
    <div class="bloque aprobar"><h3>Revisión y ejecución</h3>
      <label class="chk"><input type="checkbox" id="aprobar-pasos"> Revisé los pasos y apruebo su ejecución</label>
      <label for="correo-ia" class="etiqueta" style="color:var(--texto)">Correo destinatario</label><input id="correo-ia" type="email" placeholder="nombre@dominio.com" value="${esc($('#correo').value || leerCorreo())}">
      <p id="aprobar-error" class="error" role="alert" hidden></p>
      <button id="ejecutar-ia" class="primario" type="button" disabled>Ejecutar escenarios aprobados</button>
      <p class="ayuda">El resultado PASS/FAIL sale de la ejecución real, no de la IA.</p></div>`;
  $('#ia-resultado').hidden = false;
  const btn = $('#ejecutar-ia'); const chk = $('#aprobar-pasos');
  const revisar = () => { btn.disabled = !(chk.checked && correoValido($('#correo-ia').value) && estado.sistemaOk && !estado.ocupada); };
  chk.addEventListener('change', revisar); $('#correo-ia').addEventListener('input', revisar); revisar();
  btn.addEventListener('click', async () => {
    const elegidos = [...document.querySelectorAll('[data-esc]:checked')].map((i) => a.escenarios[+i.dataset.esc]);
    guardarCorreo($('#correo-ia').value.trim());
    try { const { id } = await api('/api/ia/ejecutar', { method: 'POST', body: { titulo: 'Escenario principal', gherkin: a.gherkin, pasos: a.pasos, escenarios: elegidos, email: $('#correo-ia').value.trim() } }); seguir(id); }
    catch (e) { const er = $('#aprobar-error'); er.textContent = e.message; er.hidden = false; }
  });
}

// ---------------------------------------------------------------- arranque
(async function iniciar() {
  $('#correo').value = leerCorreo();
  estado.catalogo = await api('/api/catalogo'); pintarTipos(); pintarSuites();
  await comprobarSistema(); setInterval(comprobarSistema, 8000);
  iniciarIA();
  const cfg = await api('/api/configuracion').catch(() => null);
  if (cfg && !cfg.smtp) $('#ayuda-correo').textContent =
  validar();
})();
