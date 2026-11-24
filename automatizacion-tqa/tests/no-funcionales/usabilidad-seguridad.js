import { paso, afirmar, afirmarVisible, api } from '../ayudas.js';
import { config } from '../../server/config.js';

const sinScrollHorizontal = (id, nombre, ancho, alto, esLogin) => ({
  id, nombre, tipo: 'no_funcional', suite: 'Usabilidad', navegador: true, viewport: { width: ancho, height: alto },
  objetivo: `Comprobar que la pantalla se adapta a ${ancho} px de ancho sin desbordarse.`, precondiciones: 'Sistema disponible.', datos: `Ventana de ${ancho} x ${alto} px`,
  esperado: 'La página no tiene desplazamiento horizontal.',
  pasos: [
    paso(`Abrir ${esLogin ? 'el formulario de acceso' : 'la página principal'} en una ventana de ${ancho} px`, 'Pantalla visible', async ({ page }) => {
      await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
      if (esLogin) {
        await page.getByText('PORTAL MIEMBROS').first().click();
        await afirmarVisible(page.getByPlaceholder('Ej. carlos_admin'), 'campo de usuario');
      } else {
        await afirmarVisible(page.getByText('BODY SOLID').first(), 'BODY SOLID');
      }
      return 'Pantalla visible';
    }),
    paso('Medir el ancho del contenido frente al ancho de la ventana', 'Sin desplazamiento horizontal', async ({ page }) => {
      const m = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, ventana: document.documentElement.clientWidth }));
      afirmar(m.contenido <= m.ventana + 1, `contenido ≤ ${m.ventana} px`, `${m.contenido} px (desborda ${m.contenido - m.ventana} px)`);
      return `Contenido ${m.contenido} px dentro de una ventana de ${m.ventana} px`;
    }),
  ],
});

export default [
  sinScrollHorizontal('TC-USA-001', 'El formulario de acceso se adapta a un móvil (375 px)', 375, 667, true),
  sinScrollHorizontal('TC-USA-002', 'La página principal se adapta a una tableta (768 px)', 768, 1024, false),
  {
    id: 'TC-SEC-001', nombre: 'El listado de socios no expone contraseñas', tipo: 'no_funcional', suite: 'Seguridad', navegador: false,
    objetivo: 'Comprobar que la API no devuelve datos sensibles, como contraseñas, en sus respuestas.',
    precondiciones: 'Sistema disponible.', datos: 'GET /api/members sin autenticación',
    esperado: 'Ningún socio incluye el campo "password" en la respuesta.',
    pasos: [
      paso('Consultar GET /api/members y revisar los campos devueltos', 'Sin campo password en ningún socio', async () => {
        const r = await api('GET', '/api/members');
        afirmar(r.estado === 200, 'HTTP 200', `HTTP ${r.estado}`);
        const expuestos = r.json.filter((m) => 'password' in m).length;
        afirmar(expuestos === 0, 'ningún socio con el campo password', `${expuestos} de ${r.json.length} socios exponen su contraseña en texto plano`);
        return 'Ningún socio expone contraseñas';
      }),
    ],
  },
];
