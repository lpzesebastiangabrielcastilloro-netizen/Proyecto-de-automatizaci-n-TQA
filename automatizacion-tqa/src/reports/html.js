import { esc, fechaLarga, hora, duracion, TIPO, insignia, etiquetaResumenIA } from './comun.js';

/** Reporte HTML independiente (sin recursos externos) con el estado de todos los casos. */
export function construirHtmlResumen(c) {
  const r = c.resumen;
  const filas = c.casos.map((x) => {
    const paso = x.error?.paso ? `<div class="sub">Paso ${x.error.paso}: ${esc(x.error.descripcionPaso || '')}</div>` : '';
    const tipoFallo = x.error ? `<div class="sub"><b>${esc(x.error.etiqueta)}</b></div>` : '';
    const ctrl = x.fallaControlada ? '<div class="sub">Fallo controlado para demostración</div>' : '';
    return `<tr data-e="${esc(x.estado)}">
      <td class="mono">${esc(x.id)}</td>
      <td><b>${esc(x.nombre)}</b>${ctrl}</td>
      <td>${esc(TIPO[x.tipo])}<div class="sub">${esc(x.suite)}</div></td>
      <td>${insignia(x.estado)}<div class="sub">${esc(duracion(x.duracionMs))}</div></td>
      <td>${esc(x.observacion || 'Sin observaciones')}${tipoFallo}${paso}</td></tr>`;
  }).join('');
  const ia = c.resumenIA;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte de automatización – ${esc(c.suite)} – ${esc(c.id)}</title>
<style>
:root{--tinta:#0E1F2B;--papel:#F2F5F7;--linea:#D5DEE5;--azul:#0A7EA4;--gris:#5B6B78}
*{box-sizing:border-box}body{margin:0;background:var(--papel);color:var(--tinta);font:15px/1.5 "Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif}
header{background:var(--tinta);color:#fff;padding:28px clamp(16px,4vw,48px)}
header small{color:#9FC7D6;font-size:13px}header h1{margin:6px 0 4px;font-size:clamp(22px,3vw,30px);letter-spacing:-.01em}
header p{margin:0;color:#C9D8E0}
main{max-width:1180px;margin:0 auto;padding:24px clamp(16px,4vw,48px) 56px}
.resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:22px}
.dato{background:#fff;border:1px solid var(--linea);border-left:5px solid var(--azul);padding:12px 14px}
.dato span{display:block;font-size:12.5px;color:var(--gris)}.dato strong{font-size:26px;line-height:1.2}
.dato.pass{border-left-color:#0E9F6E}.dato.fail{border-left-color:#D6372B}.dato.skip{border-left-color:#8593A0}.dato.nr{border-left-color:#E0A100}
.barra{display:flex;height:14px;margin:0 0 22px;background:#E3E9EE;border-radius:7px;overflow:hidden}
.barra i{display:block;height:100%}
.ia{background:#fff;border:1px solid var(--linea);padding:16px 18px;margin-bottom:22px}
.ia h2{margin:0 0 6px;font-size:17px}.ia p{margin:6px 0}.ia small{color:var(--gris)}
.filtros{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.filtros button{font:inherit;border:1px solid var(--linea);background:#fff;padding:6px 12px;border-radius:999px;cursor:pointer}
.filtros button[aria-pressed=true]{background:var(--tinta);color:#fff;border-color:var(--tinta)}
.tabla{overflow-x:auto;background:#fff;border:1px solid var(--linea)}
table{border-collapse:collapse;width:100%;min-width:760px}
th{background:#E8EEF2;text-align:left;font-size:13px;padding:10px 12px;border-bottom:1px solid var(--linea)}
td{padding:11px 12px;border-bottom:1px solid #E7EDF1;vertical-align:top}
tr:last-child td{border-bottom:0}.mono{font-family:Consolas,"Courier New",monospace;font-size:13px;white-space:nowrap}
.sub{font-size:12.5px;color:var(--gris);margin-top:2px}
.est{display:inline-block;font-weight:700;font-size:13.5px;padding:3px 10px;border:1.5px solid;border-radius:5px;white-space:nowrap}
footer{margin-top:20px;font-size:12.5px;color:var(--gris)}
</style></head><body>
<header><small>Banco de pruebas · Sistema Body Solid</small>
<h1>Reporte de automatización – ${esc(c.suite)}</h1>
<p>Ejecución ${esc(c.id)} · ${esc(fechaLarga(c.inicio))} · ${esc(hora(c.inicio))} a ${esc(hora(c.fin))} · ${esc(duracion(c.duracionMs))}</p></header>
<main>
<section class="resumen" aria-label="Resumen">
<div class="dato"><span>Total de casos</span><strong>${r.total}</strong></div>
<div class="dato pass"><span>PASS</span><strong>${r.pass}</strong></div>
<div class="dato fail"><span>FAIL</span><strong>${r.fail}</strong></div>
<div class="dato skip"><span>SKIPPED</span><strong>${r.skipped}</strong></div>
<div class="dato nr"><span>NOT RUN</span><strong>${r.notRun}</strong></div>
<div class="dato"><span>Porcentaje de éxito</span><strong>${r.exito}%</strong></div>
<div class="dato"><span>Resultado global</span><strong style="font-size:17px">${esc(c.resultadoGlobal)}</strong></div>
</section>
<div class="barra" role="img" aria-label="Distribución de resultados">
<i style="width:${(r.pass / r.total) * 100}%;background:#0E9F6E"></i><i style="width:${(r.fail / r.total) * 100}%;background:#D6372B"></i><i style="width:${(r.skipped / r.total) * 100}%;background:#8593A0"></i><i style="width:${(r.notRun / r.total) * 100}%;background:#E0A100"></i></div>
${c.errorInfra ? `<div class="ia" style="border-left:5px solid #E0A100"><h2>Error de infraestructura</h2><p>${esc(c.errorInfra)}</p></div>` : ''}
${ia ? `<section class="ia"><h2>Resumen ejecutivo</h2><p>${esc(ia.texto)}</p>${(ia.causas || []).length ? '<p><b>Posibles causas de los fallos</b></p><ul>' + ia.causas.map((x) => `<li><b>${esc(x.caso)}</b>: ${esc(x.causa)} <small>(Evidencia: ${esc(x.evidencia)})</small></li>`).join('') + '</ul>' : ''}<small>${esc(etiquetaResumenIA(ia))}</small></section>` : ''}
<div class="filtros" role="group" aria-label="Filtrar por estado">
<button aria-pressed="true" data-f="">Todos</button><button aria-pressed="false" data-f="PASS">PASS</button><button aria-pressed="false" data-f="FAIL">FAIL</button><button aria-pressed="false" data-f="SKIPPED">SKIPPED</button><button aria-pressed="false" data-f="NOT RUN">NOT RUN</button></div>
<div class="tabla"><table><thead><tr><th>ID</th><th>Nombre</th><th>Tipo / suite</th><th>Estado</th><th>Observación</th></tr></thead><tbody id="filas">${filas}</tbody></table></div>
<footer>Destinatario: ${esc(c.email)} · Ambiente: ${esc(c.ambiente)} · Este reporte se generó automáticamente; los estados provienen de la ejecución real de las pruebas.</footer>
</main>
<script>
document.querySelectorAll('.filtros button').forEach(function(b){b.addEventListener('click',function(){
document.querySelectorAll('.filtros button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});
var f=b.getAttribute('data-f');document.querySelectorAll('#filas tr').forEach(function(tr){tr.style.display=(!f||tr.getAttribute('data-e')===f)?'':'none'})})});
</script></body></html>`;
}
