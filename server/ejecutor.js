import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { abrirNavegador, nuevoContexto } from './navegador.js';

const ahora = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');

export function nuevoId() {
  const d = new Date();
  return `EJ-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${crypto.randomBytes(2).toString('hex')}`;
}

/** Crea el registro de una ejecución con todos sus casos en estado PENDIENTE. */
export function crearCorrida({ id = nuevoId(), tipo, suite, alcance, email, casos, origen = 'catalogo' }) {
  const carpeta = path.join(config.carpetaEjecuciones, id);
  fs.mkdirSync(path.join(carpeta, 'evidencias'), { recursive: true });
  return {
    id, estado: 'pendiente', tipo, suite, alcance, email, origen,
    ambiente: config.urlSistema, creada: ahora(), inicio: null, fin: null, duracionMs: null,
    casos: casos.map((c) => ({
      id: c.id, nombre: c.nombre, tipo: c.tipo, suite: c.suite, objetivo: c.objetivo, precondiciones: c.precondiciones,
      datos: c.datos, esperado: c.esperado, fallaControlada: !!c.fallaControlada,
      estado: 'PENDIENTE', pasos: c.pasos.map((p, i) => ({ n: i + 1, descripcion: p.descripcion, esperado: p.esperado, estado: 'PENDIENTE' })),
      observacion: '', error: null, duracionMs: null,
    })),
    resumen: null, resultadoGlobal: null, errorInfra: null, archivos: {}, correo: null, resumenIA: null, registro: [],
  };
}

export function clasificarError(e) {
  const msg = String(e?.message || e);
  if (e?.name === 'FalloFuncional') return { tipo: 'funcional', mensaje: msg };
  if (e?.name === 'ErrorInfraestructura') return { tipo: 'infraestructura', mensaje: msg };
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed|net::ERR_|Target (page, context or browser )?has been closed|Browser has been closed/i.test(msg) || (e?.name === 'TimeoutError' && /page\.goto|navigat/i.test(msg))) {
    return { tipo: 'infraestructura', mensaje: 'No se pudo comunicar con el sistema bajo prueba: ' + msg.split('\n')[0] };
  }
  if (e?.name === 'TimeoutError') {
    return { tipo: 'funcional', mensaje: 'Esperado: el elemento de la interfaz debía aparecer o responder. Obtenido: tiempo agotado. ' + msg.split('\n')[0].replace(/^locator\.\w+: /, '') };
  }
  return { tipo: 'proceso', mensaje: msg.split('\n')[0] };
}
const ETIQUETA_FALLO = { funcional: 'Fallo funcional', infraestructura: 'Error de infraestructura', proceso: 'Error del proceso de ejecución' };

async function sistemaDisponible() {
  try {
    const r = await fetch(config.urlSistema, { signal: AbortSignal.timeout(5000) });
    return { ok: r.status < 500, detalle: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detalle: String(e.cause?.code || e.message) };
  }
}

export async function ejecutarCorrida(corrida, casosDef, { alActualizar = () => {}, generarSalidas } = {}) {
  const carpeta = path.join(config.carpetaEjecuciones, corrida.id);
  const log = (t) => { corrida.registro.push(`${new Date().toLocaleTimeString('es-BO')}  ${t}`); alActualizar(corrida); };
  const guardar = () => fs.writeFileSync(path.join(carpeta, 'resultado.json'), JSON.stringify(corrida, null, 2));

  corrida.estado = 'en_curso'; corrida.inicio = ahora(); log(`Ejecución ${corrida.id} iniciada (${corrida.suite}, ${corrida.casos.length} casos)`);
  const t0 = performance.now();
  let navegador = null;

  try {
    const sut = await sistemaDisponible();
    if (!sut.ok) {
      corrida.errorInfra = `El sistema bajo prueba (${config.urlSistema}) no responde (${sut.detalle}). Inicia body-solid y vuelve a ejecutar.`;
      log('Error de infraestructura: ' + corrida.errorInfra);
      corrida.casos.forEach((c) => {
        c.estado = 'NOT RUN'; c.observacion = 'Error de infraestructura: sistema bajo prueba no disponible';
        c.error = { tipo: 'infraestructura', etiqueta: ETIQUETA_FALLO.infraestructura, mensaje: corrida.errorInfra, paso: null };
        c.pasos.forEach((p) => { p.estado = 'NO EJECUTADO'; });
      });
    } else {
      const requiereNavegador = casosDef.some((c) => c.navegador && !c.omitir);
      let errorNavegador = null;
      if (requiereNavegador) {
        try { navegador = await abrirNavegador(); } catch (e) { errorNavegador = e.message; log('Error de infraestructura: ' + e.message); }
      }
      for (let i = 0; i < casosDef.length; i++) {
        await ejecutarCaso(corrida, corrida.casos[i], casosDef[i], navegador, errorNavegador, carpeta, log);
        guardar();
      }
    }

    corrida.fin = ahora(); corrida.duracionMs = Math.round(performance.now() - t0);
    corrida.resumen = resumir(corrida.casos);
    corrida.resultadoGlobal = corrida.errorInfra ? 'NO EJECUTADA (infraestructura)' : corrida.resumen.fail > 0 ? 'CON FALLOS' : corrida.resumen.pass === 0 ? 'SIN RESULTADOS' : 'APROBADA';
    log(`Pruebas terminadas: ${corrida.resumen.pass} PASS, ${corrida.resumen.fail} FAIL, ${corrida.resumen.skipped} SKIPPED, ${corrida.resumen.notRun} NOT RUN`);

    if (generarSalidas) await generarSalidas(corrida, navegador, carpeta, log);
    corrida.estado = corrida.errorInfra ? 'fallida' : 'finalizada';
  } catch (e) {
    corrida.estado = 'fallida'; corrida.fin ??= ahora(); corrida.duracionMs ??= Math.round(performance.now() - t0);
    corrida.errorInfra ??= 'Error inesperado del proceso de ejecución: ' + e.message;
    corrida.resumen ??= resumir(corrida.casos);
    log('Error inesperado: ' + e.message);
  } finally {
    if (navegador) await navegador.close().catch(() => {});
    guardar(); alActualizar(corrida);
  }
  return corrida;
}

async function ejecutarCaso(corrida, res, def, navegador, errorNavegador, carpeta, log) {
  res.inicio = ahora(); const t0 = performance.now();
  const cerrar = () => { res.fin = ahora(); res.duracionMs = Math.round(performance.now() - t0); };

  if (def.omitir) {
    res.estado = 'SKIPPED'; res.observacion = def.omitir; res.pasos.forEach((p) => (p.estado = 'NO EJECUTADO')); cerrar();
    log(`${res.id} SKIPPED · ${def.omitir}`); return;
  }
  if (def.navegador && !navegador) {
    res.estado = 'NOT RUN'; res.observacion = 'Error de infraestructura: ' + (errorNavegador || 'navegador no disponible');
    res.error = { tipo: 'infraestructura', etiqueta: ETIQUETA_FALLO.infraestructura, mensaje: errorNavegador || 'navegador no disponible', paso: null };
    res.pasos.forEach((p) => (p.estado = 'NO EJECUTADO')); cerrar(); log(`${res.id} NOT RUN · navegador no disponible`); return;
  }

  res.estado = 'EN CURSO'; log(`${res.id} en curso · ${res.nombre}`);
  let contexto = null; let page = null;
  if (def.navegador) {
    contexto = await nuevoContexto(navegador, def.viewport ? { viewport: def.viewport } : {});
    page = await contexto.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(15000);
  }
  const ctx = { page, contexto };

  try {
    for (let i = 0; i < def.pasos.length; i++) {
      const p = res.pasos[i]; const t1 = performance.now(); p.estado = 'EN CURSO';
      try {
        const obtenido = await def.pasos[i].accion(ctx);
        p.obtenido = obtenido ?? ''; p.estado = 'PASS'; p.duracionMs = Math.round(performance.now() - t1);
        await guardarEvidencia(page, p, res.id, carpeta, p.obtenido);
      } catch (e) {
        p.duracionMs = Math.round(performance.now() - t1);
        const c = clasificarError(e);
        p.estado = c.tipo === 'funcional' ? 'FAIL' : 'ERROR'; p.error = c.mensaje; p.obtenido = c.mensaje;
        await guardarEvidencia(page, p, res.id, carpeta, c.mensaje);
        res.error = { tipo: c.tipo, etiqueta: ETIQUETA_FALLO[c.tipo], mensaje: c.mensaje, paso: p.n, descripcionPaso: p.descripcion };
        for (let k = i + 1; k < res.pasos.length; k++) res.pasos[k].estado = 'NO EJECUTADO';
        break;
      }
    }
    if (!res.error) { res.estado = 'PASS'; res.observacion = 'Sin observaciones'; }
    else if (res.error.tipo === 'funcional') { res.estado = 'FAIL'; res.observacion = res.error.mensaje; }
    else { res.estado = 'NOT RUN'; res.observacion = `${res.error.etiqueta}: ${res.error.mensaje}`; }
  } catch (e) {
    res.estado = 'NOT RUN'; res.error = { tipo: 'proceso', etiqueta: ETIQUETA_FALLO.proceso, mensaje: e.message, paso: null }; res.observacion = e.message;
  } finally {
    if (contexto) await contexto.close().catch(() => {});
    cerrar();
  }
  log(`${res.id} ${res.estado} (${res.duracionMs} ms)${res.estado !== 'PASS' ? ' · ' + res.observacion.slice(0, 110) : ''}`);
}

async function guardarEvidencia(page, paso, idCaso, carpeta, texto) {
  if (page) {
    try {
      const archivo = `evidencias/${idCaso}-paso${paso.n}.jpg`;
      await page.screenshot({ path: path.join(carpeta, archivo), type: 'jpeg', quality: 62 });
      paso.evidencia = { tipo: 'captura', archivo };
      return;
    } catch { /* si no se puede capturar, se guarda el texto */ }
  }
  paso.evidencia = { tipo: 'texto', texto: texto || '' };
}

export function resumir(casos) {
  const c = (e) => casos.filter((x) => x.estado === e).length;
  const total = casos.length; const pass = c('PASS');
  return { total, pass, fail: c('FAIL'), skipped: c('SKIPPED'), notRun: c('NOT RUN') + c('PENDIENTE') + c('EN CURSO'), exito: total ? Math.round((pass / total) * 1000) / 10 : 0 };
}
