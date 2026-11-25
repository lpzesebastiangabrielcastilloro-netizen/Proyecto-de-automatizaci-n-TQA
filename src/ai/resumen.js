import { pedirJson, infoProveedor } from './proveedor.js';
import { duracion } from '../reports/comun.js';

/** Resumen ejecutivo + posibles causas de los fallos. Usa IA si hay clave; si no, reglas locales. */
export async function resumenEjecutivo(c) {
  const fallidos = c.casos.filter((x) => x.estado === 'FAIL' || (x.estado === 'NOT RUN' && x.error));
  if (infoProveedor().proveedor !== 'local') {
    try {
      const datos = {
        suite: c.suite, resumen: c.resumen, duracion: duracion(c.duracionMs), errorInfra: c.errorInfra,
        casosConProblemas: fallidos.map((x) => ({ id: x.id, nombre: x.nombre, estado: x.estado, tipoFallo: x.error?.etiqueta, paso: x.error?.paso, descripcionPaso: x.error?.descripcionPaso, mensaje: x.error?.mensaje, evidencia: evid(x) })),
        casosLentos: [...c.casos].sort((a, b) => (b.duracionMs || 0) - (a.duracionMs || 0)).slice(0, 3).map((x) => ({ id: x.id, ms: x.duracionMs })),
      };
      const r = await pedirJson({
        sistema: 'Eres un analista de QA. Responde SOLO con JSON: {"texto": string (resumen ejecutivo de 3 a 5 frases en español), "causas": [{"caso": string, "causa": string, "evidencia": string}]}. Basa cada causa únicamente en los datos recibidos (mensaje de error, paso, evidencia). No inventes información ni cambies los estados.',
        usuario: JSON.stringify(datos),
      });
      return { texto: String(r.datos.texto || ''), causas: Array.isArray(r.datos.causas) ? r.datos.causas.slice(0, 8) : [], proveedor: r.proveedor, modelo: r.modelo };
    } catch { /* continúa con el resumen local */ }
  }
  return resumenLocal(c, fallidos);
}

function evid(x) {
  const n = x.error?.paso; if (!n) return 'sin evidencia asociada';
  const p = x.pasos?.[n - 1];
  return p?.evidencia?.tipo === 'captura' ? `captura del paso ${n}` : `respuesta registrada en el paso ${n}`;
}

function causaProbable(x) {
  const m = (x.error?.mensaje || '').toLowerCase();
  if (x.error?.tipo === 'infraestructura') return 'Problema del entorno (sistema o navegador no disponible), no del comportamiento funcional.';
  if (x.error?.tipo === 'proceso') return 'Error en el propio proceso de ejecución de la prueba; conviene revisar el script.';
  if (m.includes('password') || m.includes('contraseña')) return 'La API devuelve datos sensibles (contraseñas) sin protegerlos: posible defecto de seguridad.';
  if (m.includes('tiempo agotado') || m.includes('no apareció')) return 'El elemento esperado no se mostró en pantalla: puede faltar la funcionalidad o haber cambiado la interfaz.';
  if (m.includes('ms') && m.includes('esperado')) return 'El tiempo medido superó el umbral definido para la prueba.';
  if (m.includes('http')) return 'La respuesta del servicio no coincide con el código HTTP esperado.';
  return 'El resultado obtenido no coincide con el esperado en el paso indicado.';
}

function resumenLocal(c, fallidos) {
  const r = c.resumen;
  let t = `Se ejecutaron ${r.total} casos de la suite ${c.suite} en ${duracion(c.duracionMs)}: ${r.pass} PASS (${r.exito}% de éxito), ${r.fail} FAIL, ${r.skipped} SKIPPED y ${r.notRun} NOT RUN.`;
  if (c.errorInfra) t += ` La ejecución no pudo completarse por un error de infraestructura: ${c.errorInfra}`;
  else if (r.fail === 0 && r.notRun === 0) t += ' No se detectaron fallos funcionales en esta ejecución.';
  else if (fallidos.length) t += ` Requieren atención: ${fallidos.map((x) => x.id).join(', ')}.`;
  const lento = [...c.casos].filter((x) => x.estado === 'PASS').sort((a, b) => b.duracionMs - a.duracionMs)[0];
  if (lento) t += ` El caso aprobado más lento fue ${lento.id} (${duracion(lento.duracionMs)}).`;
  return {
    texto: t, proveedor: 'local', modelo: 'reglas locales',
    causas: fallidos.map((x) => ({ caso: `${x.id} – ${x.nombre}`, causa: causaProbable(x), evidencia: (evid(x) + (x.error?.mensaje ? ` · mensaje: ${x.error.mensaje}` : '')).slice(0, 230) })),
  };
}
