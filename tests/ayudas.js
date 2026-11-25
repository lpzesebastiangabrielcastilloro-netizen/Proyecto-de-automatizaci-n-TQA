// Ayudas compartidas por los casos de prueba: aserciones, pasos y acceso a la API.
import { config } from '../server/config.js';

export class FalloFuncional extends Error {
  constructor(mensaje) { super(mensaje); this.name = 'FalloFuncional'; }
}
export class CasoOmitido extends Error {
  constructor(motivo) { super(motivo); this.name = 'CasoOmitido'; }
}

/** Define un paso: descripción, resultado esperado y la acción que lo ejecuta. */
export const paso = (descripcion, esperado, accion) => ({ descripcion, esperado, accion });

export function afirmar(condicion, esperado, obtenido) {
  if (!condicion) throw new FalloFuncional(`Esperado: ${esperado}. Obtenido: ${obtenido}`);
}
export function afirmarIgual(obtenido, esperado, etiqueta) {
  afirmar(obtenido === esperado, `${etiqueta} = ${JSON.stringify(esperado)}`, JSON.stringify(obtenido));
}
export function afirmarContiene(texto, fragmento, etiqueta) {
  afirmar(String(texto).includes(fragmento), `${etiqueta} contiene "${fragmento}"`, `"${String(texto).slice(0, 120)}"`);
}

/** Espera que un localizador sea visible; si no, es un fallo funcional (no de infraestructura). */
export async function afirmarVisible(localizador, etiqueta, ms = 6000) {
  try {
    await localizador.first().waitFor({ state: 'visible', timeout: ms });
  } catch {
    throw new FalloFuncional(`Esperado: "${etiqueta}" visible en pantalla. Obtenido: no apareció en ${ms} ms`);
  }
}
export async function afirmarTextoEnPagina(page, texto, ms = 6000) {
  await afirmarVisible(page.getByText(texto, { exact: false }), texto, ms);
}

/** Llamada HTTP a la API del sistema bajo prueba, midiendo el tiempo. */
export async function api(metodo, ruta, cuerpo) {
  const t0 = performance.now();
  const res = await fetch(config.urlSistema + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* no es JSON */ }
  return { estado: res.status, json, texto, ms: Math.round(performance.now() - t0) };
}

export function percentil(valores, p) {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
}

/** Flujo de acceso por interfaz usado por muchos casos. */
export async function iniciarSesion(page, cuenta) {
  await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
  await page.getByText('PORTAL MIEMBROS').first().click();
  await page.getByPlaceholder('Ej. carlos_admin').fill(cuenta.usuario);
  await page.getByPlaceholder('••••••••').fill(cuenta.clave);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
}
export const cuenta = (clave) => config.cuentas[clave];
