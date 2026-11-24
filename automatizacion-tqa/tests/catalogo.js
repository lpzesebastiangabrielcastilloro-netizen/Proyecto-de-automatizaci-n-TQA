import smoke from './funcionales/smoke.js';
import sanity from './funcionales/sanity.js';
import regression from './funcionales/regression.js';
import integracion from './funcionales/integracion.js';
import e2e from './funcionales/e2e.js';
import fallo from './funcionales/fallo-controlado.js';
import rendimiento from './no-funcionales/rendimiento.js';
import carga from './no-funcionales/carga.js';
import usabilidadSeguridad from './no-funcionales/usabilidad-seguridad.js';

export const todosLosCasos = [
  ...smoke, ...sanity, ...regression, ...integracion, ...e2e, ...fallo,
  ...rendimiento, ...carga, ...usabilidadSeguridad,
];

export const TIPOS = { funcional: 'Funcionales', no_funcional: 'No funcionales' };

/** Catálogo sin funciones, listo para enviarse a la interfaz. */
export function catalogoPublico() {
  const tipos = {};
  for (const c of todosLosCasos) {
    tipos[c.tipo] ??= { clave: c.tipo, nombre: TIPOS[c.tipo], suites: {} };
    tipos[c.tipo].suites[c.suite] ??= { nombre: c.suite, casos: [] };
    tipos[c.tipo].suites[c.suite].casos.push({
      id: c.id, nombre: c.nombre, objetivo: c.objetivo, navegador: !!c.navegador, omitido: !!c.omitir, fallaControlada: !!c.fallaControlada,
    });
  }
  return Object.values(tipos).map((t) => ({ ...t, suites: Object.values(t.suites) }));
}

export function seleccionar({ tipo, suite, casos }) {
  let lista = todosLosCasos.filter((c) => c.tipo === tipo && c.suite === suite);
  if (Array.isArray(casos) && casos.length) lista = lista.filter((c) => casos.includes(c.id));
  return lista;
}
