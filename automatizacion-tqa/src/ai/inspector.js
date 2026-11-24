import { abrirNavegador, nuevoContexto } from '../../server/navegador.js';
import { config } from '../../server/config.js';

export const PANTALLAS = {
  inicio: { nombre: 'Página principal', clics: [], cuenta: null },
  login: { nombre: 'Formulario de acceso (login)', clics: ['PORTAL MIEMBROS'], cuenta: null },
  panel_admin: { nombre: 'Panel del administrador', clics: [], cuenta: 'admin' },
  panel_entrenador: { nombre: 'Panel del entrenador', clics: [], cuenta: 'entrenador' },
  panel_cliente: { nombre: 'Panel del cliente', clics: [], cuenta: 'cliente' },
};

/** Abre la aplicación real y lista los elementos con los que se puede interactuar. */
export async function inspeccionar(idPantalla = 'login') {
  const def = PANTALLAS[idPantalla] || PANTALLAS.login;
  const nav = await abrirNavegador();
  try {
    const ctx = await nuevoContexto(nav); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
    for (const t of def.clics) { await page.getByText(t).first().click(); await page.waitForTimeout(500); }
    if (def.cuenta) {
      const cu = config.cuentas[def.cuenta];
      await page.getByText('PORTAL MIEMBROS').first().click();
      await page.getByPlaceholder('Ej. carlos_admin').fill(cu.usuario);
      await page.getByPlaceholder('••••••••').fill(cu.clave);
      await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
      await page.getByText('Cerrar Sesión').first().waitFor({ timeout: 8000 });
    }
    await page.waitForTimeout(400);
    const elementos = await page.evaluate(() => {
      const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
      const limpiar = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const etiquetaDe = (el) => { let p = el.parentElement; for (let i = 0; i < 4 && p; i++, p = p.parentElement) { const l = p.querySelector('label'); if (l) return limpiar(l.innerText); } return ''; };
      const lista = [];
      document.querySelectorAll('input, textarea, select, button, a[href], [role="button"]').forEach((el) => {
        if (!visible(el)) return;
        const tag = el.tagName.toLowerCase();
        lista.push({ elemento: tag, tipo: el.getAttribute('type') || '', placeholder: el.getAttribute('placeholder') || '', etiqueta: ['input', 'textarea', 'select'].includes(tag) ? etiquetaDe(el) : '', texto: ['input', 'textarea', 'select'].includes(tag) ? '' : limpiar(el.innerText), aria: el.getAttribute('aria-label') || '' });
      });
      return { elementos: lista, titulos: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((h) => limpiar(h.innerText)).slice(0, 8), url: location.pathname };
    });
    const vistos = new Set(); const salida = [];
    for (const e of elementos.elementos) {
      let locator = null;
      if (e.placeholder) locator = { tipo: 'placeholder', valor: e.placeholder };
      else if (e.elemento === 'button' && e.texto) locator = { tipo: 'rol', rol: 'button', nombre: e.texto };
      else if (e.elemento === 'a' && e.texto) locator = { tipo: 'rol', rol: 'link', nombre: e.texto };
      else if (e.aria) locator = { tipo: 'etiqueta', valor: e.aria };
      else if (e.texto) locator = { tipo: 'texto', valor: e.texto };
      if (!locator) continue;
      const clave = JSON.stringify(locator); if (vistos.has(clave)) continue; vistos.add(clave);
      salida.push({ ...e, locator, sensible: e.tipo === 'password' });
    }
    return { pantalla: idPantalla, nombre: def.nombre, preparacion: def.clics.map((t) => ({ accion: 'clic_texto', texto: t })), cuenta: def.cuenta, titulos: elementos.titulos, elementos: salida.slice(0, 40) };
  } finally { await nav.close().catch(() => {}); }
}

/** Comprueba que un localizador realmente existe en la inspección (evita selectores inventados). */
export const existeLocator = (elementos, loc) => !!loc && elementos.some((e) => JSON.stringify(e.locator) === JSON.stringify(loc));
