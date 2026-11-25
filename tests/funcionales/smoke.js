import { paso, afirmar, afirmarVisible, api } from '../ayudas.js';
import { config } from '../../server/config.js';

export default [
  {
    id: 'TC-SMK-001', nombre: 'La página principal carga correctamente', tipo: 'funcional', suite: 'Smoke', navegador: true,
    objetivo: 'Comprobar que la página de inicio del gimnasio está disponible y muestra su marca y el acceso al portal.',
    precondiciones: 'El sistema Body Solid está en ejecución.',
    datos: 'No requiere datos.',
    esperado: 'Se muestra la marca BODY SOLID y el botón PORTAL MIEMBROS.',
    pasos: [
      paso('Abrir la página principal del sistema', 'La página responde y se dibuja el contenido', async ({ page }) => {
        const r = await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
        afirmar(r && r.ok(), 'respuesta HTTP exitosa', `HTTP ${r ? r.status() : 'sin respuesta'}`);
        return `Página abierta (HTTP ${r.status()})`;
      }),
      paso('Verificar que aparece la marca BODY SOLID', 'Texto BODY SOLID visible', async ({ page }) => {
        await afirmarVisible(page.getByText('BODY SOLID').first(), 'BODY SOLID');
        return 'Marca BODY SOLID visible';
      }),
      paso('Verificar que existe el acceso PORTAL MIEMBROS', 'Botón PORTAL MIEMBROS visible', async ({ page }) => {
        await afirmarVisible(page.getByText('PORTAL MIEMBROS'), 'PORTAL MIEMBROS');
        return 'Acceso al portal visible';
      }),
    ],
  },
  {
    id: 'TC-SMK-002', nombre: 'El servicio de socios responde', tipo: 'funcional', suite: 'Smoke', navegador: false,
    objetivo: 'Comprobar que la API del sistema responde y devuelve el listado de socios.',
    precondiciones: 'El sistema Body Solid está en ejecución.',
    datos: 'GET /api/members',
    esperado: 'HTTP 200 y una lista con al menos 7 socios.',
    pasos: [
      paso('Consultar GET /api/members', 'HTTP 200 con lista de socios', async () => {
        const r = await api('GET', '/api/members');
        afirmar(r.estado === 200, 'HTTP 200', `HTTP ${r.estado}`);
        afirmar(Array.isArray(r.json) && r.json.length >= 7, 'al menos 7 socios', `${Array.isArray(r.json) ? r.json.length : 'no es una lista'}`);
        return `HTTP ${r.estado} · ${r.json.length} socios · ${r.ms} ms`;
      }),
    ],
  },
  {
    id: 'TC-SMK-003', nombre: 'El portal de acceso muestra el formulario', tipo: 'funcional', suite: 'Smoke', navegador: true,
    objetivo: 'Comprobar que desde la página principal se llega al formulario de inicio de sesión.',
    precondiciones: 'El sistema Body Solid está en ejecución.',
    datos: 'No requiere datos.',
    esperado: 'Se muestran los campos de usuario y contraseña y el botón Iniciar Sesión.',
    pasos: [
      paso('Abrir la página principal', 'Página cargada', async ({ page }) => {
        await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
        return 'Página principal abierta';
      }),
      paso('Seleccionar PORTAL MIEMBROS', 'Se abre el formulario de acceso', async ({ page }) => {
        await page.getByText('PORTAL MIEMBROS').first().click();
        await afirmarVisible(page.getByPlaceholder('Ej. carlos_admin'), 'campo de usuario');
        return 'Formulario de acceso abierto';
      }),
      paso('Verificar campos y botón', 'Usuario, contraseña y botón Iniciar Sesión visibles', async ({ page }) => {
        await afirmarVisible(page.getByPlaceholder('••••••••'), 'campo de contraseña');
        await afirmarVisible(page.getByRole('button', { name: 'Iniciar Sesión' }), 'botón Iniciar Sesión');
        return 'Usuario, contraseña y botón visibles';
      }),
    ],
  },
];
