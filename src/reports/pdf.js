import fs from 'node:fs';
import path from 'node:path';
import { esc, fechaLarga, hora, duracion, TIPO, insignia, COLOR, etiquetaResumenIA } from './comun.js';

const imgBase64 = (carpeta, rel) => {
  try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(carpeta, rel)).toString('base64'); } catch { return null; }
};

function bloqueCaso(x, carpeta) {
  const col = COLOR[x.estado] || COLOR['NOT RUN'];
  const pasos = x.pasos.map((p) => {
    const ev = p.evidencia?.tipo === 'captura' ? imgBase64(carpeta, p.evidencia.archivo) : null;
    const estadoPaso = p.estado === 'PASS' ? 'PASS' : p.estado === 'FAIL' ? 'FAIL' : p.estado === 'ERROR' ? 'NOT RUN' : p.estado === 'NO EJECUTADO' ? 'NOT RUN' : 'NOT RUN';
    const textoEstado = p.estado === 'ERROR' ? 'ERROR' : p.estado === 'NO EJECUTADO' ? 'NO EJECUTADO' : p.estado;
    const c = COLOR[estadoPaso];
    return `<div class="paso"><table class="pt"><tr><td class="pn">${p.n}</td><td><b>${esc(p.descripcion)}</b>
      <div class="kv"><span>Esperado:</span> ${esc(p.esperado)}</div>
      <div class="kv"><span>Obtenido:</span> ${esc(p.obtenido || (p.estado === 'NO EJECUTADO' ? 'El paso no se ejecutó porque un paso anterior falló.' : '—'))}</div></td>
      <td class="pe"><span class="est" style="background:${c.fondo};color:${c.texto};border-color:${c.borde}">${esc(textoEstado)}</span><div class="ms">${p.duracionMs != null ? duracion(p.duracionMs) : ''}</div></td></tr></table>
      ${ev ? `<figure><img src="${ev}" alt="Evidencia del paso ${p.n}"><figcaption>Evidencia · ${esc(x.id)} · paso ${p.n}</figcaption></figure>` : p.evidencia?.texto ? `<pre class="ev">${esc(p.evidencia.texto)}</pre>` : ''}
    </div>`;
  }).join('');
  const falla = x.error ? `<div class="falla"><b>${esc(x.error.etiqueta)}</b>${x.error.paso ? ` en el paso ${x.error.paso}: ${esc(x.error.descripcionPaso || '')}` : ''}
    <div class="kv"><span>Mensaje de error:</span> ${esc(x.error.mensaje)}</div>
    <div class="kv"><span>Evidencia:</span> ${x.error.paso ? (x.pasos[x.error.paso - 1]?.evidencia?.tipo === 'captura' ? `captura del paso ${x.error.paso} incluida arriba` : `respuesta registrada en el paso ${x.error.paso} (arriba)`) : 'no disponible'}</div>
    <div class="kv"><span>Para reproducirlo:</span> ${x.error.tipo === 'funcional' ? `ejecutar ${esc(x.id)} con los datos indicados y observar el paso ${x.error.paso}.` : 'verificar que el sistema y el navegador estén disponibles y repetir la ejecución.'}</div></div>` : '';
  return `<section class="caso">
  <h4>${esc(x.id)} – ${esc(x.nombre)} ${x.fallaControlada ? '<span class="ctrl">fallo controlado</span>' : ''}</h4>
  <table class="ficha">
   <tr><th>Objetivo</th><td>${esc(x.objetivo)}</td></tr>
   <tr><th>Precondición / datos</th><td>${esc(x.precondiciones)} · ${esc(x.datos)}</td></tr>
   <tr><th>Resultado esperado</th><td>${esc(x.esperado)}</td></tr>
   <tr><th>Estado / observación</th><td>${insignia(x.estado)} <span class="ms">${esc(duracion(x.duracionMs))}</span> — ${esc(x.observacion || 'Sin observaciones')}</td></tr>
  </table>
  <div class="tit-pasos">Pasos ejecutados y evidencias</div>${pasos}${falla}</section>`;
}

export function construirHtmlInforme(c, carpeta) {
  const r = c.resumen;
  const porTipo = ['funcional', 'no_funcional'].map((t) => {
    const delTipo = c.casos.filter((x) => x.tipo === t); if (!delTipo.length) return '';
    const suites = [...new Set(delTipo.map((x) => x.suite))];
    return `<h2>${TIPO[t]}s</h2>` + suites.map((s) => `<h3>Categoría: ${esc(s)}</h3>` + delTipo.filter((x) => x.suite === s).map((x) => bloqueCaso(x, carpeta)).join('')).join('');
  }).join('');
  const ia = c.resumenIA;
  const datos = [
    ['Proyecto', 'Body Solid – sistema de gestión de gimnasio'], ['Ambiente', c.ambiente], ['Tipo de prueba', c.tipo === 'ia' ? 'Funcional (generada con IA)' : TIPO[c.tipo] || c.tipo],
    ['Suite / categoría', c.suite], ['Alcance', c.alcance], ['ID de ejecución', c.id], ['Fecha', fechaLarga(c.inicio)],
    ['Hora de inicio', hora(c.inicio)], ['Hora de finalización', hora(c.fin)], ['Duración', duracion(c.duracionMs)], ['Correo destinatario', c.email],
  ];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe detallado ${esc(c.id)}</title><style>
@page{size:A4;margin:16mm 14mm 18mm}
*{box-sizing:border-box}body{margin:0;color:#0E1F2B;font:10.2pt/1.45 "Segoe UI",Arial,sans-serif}
.portada{height:255mm;display:flex;flex-direction:column;justify-content:space-between;background:#0E1F2B;color:#fff;padding:22mm 16mm;margin:-16mm -14mm 8mm;page-break-after:always}
.portada small{color:#9FC7D6;font-size:11pt}.portada h1{font-size:30pt;line-height:1.1;margin:8mm 0 4mm;letter-spacing:-.01em}.portada p{color:#C9D8E0;font-size:12pt;margin:0}
.portada .id{font:11pt Consolas,monospace;color:#9FC7D6}
h2,h3{break-after:avoid}h2{font-size:16pt;margin:8mm 0 3mm;padding-bottom:2mm;border-bottom:2px solid #0A7EA4}h3{font-size:12.5pt;margin:6mm 0 2mm;color:#0A5F7E}h4{font-size:11pt;margin:0 0 2mm}
.datos{border-collapse:collapse;width:100%}.datos th{width:38%;text-align:left;background:#EEF3F6;padding:2mm 3mm;border:1px solid #D5DEE5;font-weight:600}.datos td{padding:2mm 3mm;border:1px solid #D5DEE5}
.res{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm;margin:4mm 0}.res div{border:1px solid #D5DEE5;border-left:4px solid #0A7EA4;padding:2mm 3mm}.res span{display:block;font-size:8pt;color:#5B6B78}.res strong{font-size:16pt}
.barra{display:flex;height:4mm;border-radius:2mm;overflow:hidden;background:#E3E9EE}.barra i{display:block}
.est{display:inline-block;font-weight:700;font-size:9pt;padding:.4mm 2.2mm;border:1.2px solid;border-radius:1.2mm;white-space:nowrap}
.ia{border:1px solid #D5DEE5;border-left:4px solid #0A7EA4;padding:3mm 4mm;margin:4mm 0}.ia small{color:#5B6B78}
.caso{margin:0 0 7mm;padding-top:1mm}.caso h4{page-break-after:avoid}
.ctrl{font-size:8pt;font-weight:600;background:#FFF3D6;color:#7A5800;padding:.4mm 2mm;border-radius:1mm;margin-left:2mm}
.ficha{border-collapse:collapse;width:100%;margin-bottom:3mm;page-break-inside:avoid}.ficha th{width:27%;text-align:left;background:#EEF3F6;padding:1.6mm 3mm;border:1px solid #D5DEE5;vertical-align:top}.ficha td{padding:1.6mm 3mm;border:1px solid #D5DEE5}
.tit-pasos{font-weight:700;font-size:9.5pt;margin:2mm 0 1.5mm;color:#0A5F7E}
.paso{margin-bottom:2.5mm;page-break-inside:avoid}.pt{border-collapse:collapse;width:100%}.pt td{vertical-align:top;padding:1.6mm 2mm;border:1px solid #E1E8ED}
.pn{width:7mm;text-align:center;font-weight:700;background:#EEF3F6}.pe{width:27mm;text-align:center}.ms{font-size:8pt;color:#5B6B78}
.kv{font-size:9pt;margin-top:.8mm}.kv span{color:#5B6B78;font-weight:600}
figure{margin:1.5mm 0 0;text-align:center}figure img{max-width:62%;border:1px solid #CBD5DC}figcaption{font-size:7.5pt;color:#5B6B78;margin-top:.8mm}
pre.ev{margin:1.5mm 0 0;background:#0E1F2B;color:#D7E6EE;padding:2mm 3mm;font:8.5pt/1.4 Consolas,monospace;white-space:pre-wrap;border-radius:1.2mm}
.falla{margin-top:2.5mm;border:1.2px solid #D6372B;background:#FBE7E5;padding:2.5mm 3.5mm;border-radius:1.2mm;page-break-inside:avoid}
</style></head><body>
<section class="portada"><div><small>Banco de pruebas · Sistema Body Solid</small><h1>Informe detallado de ejecución de pruebas automatizadas</h1><p>${esc(c.suite)} · ${esc(c.tipo === 'ia' ? 'Funcional (IA)' : TIPO[c.tipo] || c.tipo)}</p></div>
<div><p class="id">${esc(c.id)}</p><p>${esc(fechaLarga(c.inicio))} · ${esc(hora(c.inicio))} – ${esc(hora(c.fin))}</p><p>Resultado global: <b>${esc(c.resultadoGlobal)}</b> · ${r.exito}% de éxito</p></div></section>
<h2>Datos generales</h2><table class="datos">${datos.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
<h2>Resumen de resultados</h2>
<div class="res"><div><span>Total de casos</span><strong>${r.total}</strong></div><div style="border-left-color:#0E9F6E"><span>PASS</span><strong>${r.pass}</strong></div><div style="border-left-color:#D6372B"><span>FAIL</span><strong>${r.fail}</strong></div><div style="border-left-color:#8593A0"><span>SKIPPED</span><strong>${r.skipped}</strong></div><div style="border-left-color:#E0A100"><span>NOT RUN</span><strong>${r.notRun}</strong></div><div><span>Éxito</span><strong>${r.exito}%</strong></div></div>
<div class="barra"><i style="width:${(r.pass / r.total) * 100}%;background:#0E9F6E"></i><i style="width:${(r.fail / r.total) * 100}%;background:#D6372B"></i><i style="width:${(r.skipped / r.total) * 100}%;background:#8593A0"></i><i style="width:${(r.notRun / r.total) * 100}%;background:#E0A100"></i></div>
${c.errorInfra ? `<div class="ia" style="border-left-color:#E0A100"><b>Error de infraestructura.</b> ${esc(c.errorInfra)}</div>` : ''}
${ia ? `<div class="ia"><b>Resumen ejecutivo</b><p>${esc(ia.texto)}</p>${(ia.causas || []).length ? '<b>Posibles causas de los fallos</b><ul>' + ia.causas.map((x) => `<li><b>${esc(x.caso)}</b>: ${esc(x.causa)} <small>(Evidencia: ${esc(x.evidencia)})</small></li>`).join('') + '</ul>' : ''}<small>${esc(etiquetaResumenIA(ia))}</small></div>` : ''}
${porTipo || bloqueSinTipo(c, carpeta)}
</body></html>`;
}
const bloqueSinTipo = (c, carpeta) => `<h2>Casos ejecutados</h2>` + c.casos.map((x) => bloqueCaso(x, carpeta)).join('');

/** Convierte el informe a PDF usando el navegador ya abierto (o uno nuevo). */
export async function generarPdf(c, carpeta, navegador) {
  const html = construirHtmlInforme(c, carpeta);
  const ctx = await navegador.newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const destino = path.join(carpeta, `informe-detallado-${c.id}.pdf`);
    await page.pdf({
      path: destino, format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font:8px Arial;color:#5B6B78;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>Informe detallado · ${c.id}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
      margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
    });
    return destino;
  } finally { await ctx.close(); }
}
