import { paso, afirmar, afirmarVisible, FalloFuncional } from '../../tests/ayudas.js';
import { config } from '../../server/config.js';

export const ACCIONES = ['abrir', 'clic_texto', 'clic', 'escribir', 'verificar_texto', 'verificar_texto_alguno', 'verificar_ausente', 'verificar_visible'];

function resolver(page, loc) {
  if (!loc) throw new FalloFuncional('El paso no tiene un localizador válido');
  if (loc.tipo === 'placeholder') return page.getByPlaceholder(loc.valor);
  if (loc.tipo === 'rol') return page.getByRole(loc.rol, { name: loc.nombre });
  if (loc.tipo === 'etiqueta') return page.getByLabel(loc.valor);
  return page.getByText(loc.valor, { exact: false });
}
const nombreLoc = (loc) => (loc ? loc.nombre || loc.valor || '' : '');

/** Describe un paso del DSL en lenguaje natural (enmascarando datos sensibles). */
export function describir(p) {
  switch (p.accion) {
    case 'abrir': return 'Abrir la aplicación';
    case 'clic_texto': return `Seleccionar "${p.texto}"`;
    case 'clic': return `Seleccionar "${nombreLoc(p.locator)}"`;
    case 'escribir': return `Escribir ${p.sensible ? '••••••••' : `"${p.valor}"`} en el campo "${nombreLoc(p.locator)}"`;
    case 'verificar_texto': return `Verificar que se muestra "${p.texto}"`;
    case 'verificar_texto_alguno': return `Verificar que se muestra un mensaje como: ${p.textos.map((t) => `"${t}"`).join(' o ')}`;
    case 'verificar_ausente': return `Verificar que NO se muestra "${p.texto}"`;
    case 'verificar_visible': return `Verificar que es visible "${nombreLoc(p.locator)}"`;
    default: return p.descripcion || p.accion;
  }
}

function accion(p) {
  return async ({ page }) => {
    switch (p.accion) {
      case 'abrir': await page.goto(config.urlSistema + (p.url || '/'), { waitUntil: 'domcontentloaded' }); return 'Aplicación abierta';
      case 'clic_texto': await page.getByText(p.texto).first().click(); return `Se seleccionó "${p.texto}"`;
      case 'clic': await resolver(page, p.locator).first().click(); return `Se seleccionó "${nombreLoc(p.locator)}"`;
      case 'escribir': await resolver(page, p.locator).first().fill(String(p.valor ?? '')); return `Se escribió en "${nombreLoc(p.locator)}"${p.sensible ? ' (dato sensible oculto)' : ''}`;
      case 'verificar_texto': await afirmarVisible(page.getByText(p.texto, { exact: false }), p.texto, 6000); return `Se muestra "${p.texto}"`;
      case 'verificar_texto_alguno': {
        for (const t of p.textos) { if (await page.getByText(t, { exact: false }).first().isVisible().catch(() => false)) return `Se muestra el mensaje "${t}"`; }
        await page.waitForTimeout(1200);
        for (const t of p.textos) { if (await page.getByText(t, { exact: false }).first().isVisible().catch(() => false)) return `Se muestra el mensaje "${t}"`; }
        throw new FalloFuncional(`Esperado: un mensaje con ${p.textos.map((t) => `"${t}"`).join(' o ')}. Obtenido: ninguno apareció`);
      }
      case 'verificar_ausente': { await page.waitForTimeout(800); const vis = await page.getByText(p.texto, { exact: false }).first().isVisible().catch(() => false); afirmar(!vis, `"${p.texto}" no visible`, 'el texto está visible'); return `No se muestra "${p.texto}"`; }
      case 'verificar_visible': await afirmarVisible(resolver(page, p.locator), nombreLoc(p.locator), 6000); return `"${nombreLoc(p.locator)}" visible`;
      default: throw new Error(`Acción desconocida: ${p.accion}`);
    }
  };
}

/** Convierte pasos del DSL (aprobados por la persona) en un caso ejecutable por el motor. */
export function casoDesdePasos({ id, titulo, objetivo, gherkin, pasos }) {
  for (const p of pasos) if (!ACCIONES.includes(p.accion)) throw new Error(`Acción no permitida: ${p.accion}`);
  return {
    id, nombre: titulo, tipo: 'funcional', suite: 'Generados con IA', navegador: true,
    objetivo: objetivo || 'Caso generado con asistencia de IA a partir de un requerimiento y aprobado por la persona antes de ejecutarse.',
    precondiciones: 'Sistema disponible; casos revisados y aprobados por la persona usuaria.',
    datos: 'Cuentas de demostración del sistema (contraseñas ocultas en el informe).',
    esperado: gherkin ? gherkin.split('\n').filter((l) => /^\s*Then/.test(l)).map((l) => l.trim().replace(/^Then\s+/, '')).join('; ') || 'Según el escenario Gherkin' : 'Según los pasos aprobados',
    pasos: pasos.map((p) => paso(describir(p), p.accion.startsWith('verificar') ? 'La verificación se cumple' : 'La acción se realiza sin errores', accion(p))),
  };
}
