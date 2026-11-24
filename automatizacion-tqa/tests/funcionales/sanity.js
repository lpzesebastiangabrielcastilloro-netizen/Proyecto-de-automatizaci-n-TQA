import { paso, afirmarVisible, iniciarSesion, cuenta } from '../ayudas.js';

const accesoPorRol = (n, clave, rol, saludo) => ({
  id: `TC-SAN-00${n}`, nombre: `Inicio de sesión como ${rol}`, tipo: 'funcional', suite: 'Sanity', navegador: true,
  objetivo: `Comprobar que un ${rol.toLowerCase()} válido puede iniciar sesión y llega a su panel.`,
  precondiciones: `Sistema disponible; cuenta de prueba de ${rol.toLowerCase()} habilitada.`,
  datos: `Usuario ${cuenta(clave).usuario} (cuenta de demostración)`,
  esperado: `Se muestra el panel del ${rol.toLowerCase()} con su saludo.`,
  pasos: [
    paso('Abrir la aplicación y entrar al portal de miembros', 'Formulario de acceso visible', async ({ page }) => {
      await iniciarSesionHasta(page);
      return 'Formulario de acceso visible';
    }),
    paso('Ingresar usuario y contraseña, y seleccionar Iniciar Sesión', 'Acceso concedido', async ({ page }) => {
      await page.getByPlaceholder('Ej. carlos_admin').fill(cuenta(clave).usuario);
      await page.getByPlaceholder('••••••••').fill(cuenta(clave).clave);
      await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
      return 'Credenciales enviadas';
    }),
    paso('Verificar el panel principal del rol', `Saludo "${saludo}" visible`, async ({ page }) => {
      await afirmarVisible(page.getByText(saludo).first(), saludo, 8000);
      await afirmarVisible(page.getByText('Cerrar Sesión'), 'opción Cerrar Sesión');
      return `Panel de ${rol.toLowerCase()} visible con su saludo`;
    }),
  ],
});

async function iniciarSesionHasta(page) {
  const { config } = await import('../../server/config.js');
  await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
  await page.getByText('PORTAL MIEMBROS').first().click();
  await afirmarVisible(page.getByPlaceholder('Ej. carlos_admin'), 'campo de usuario');
}

export default [
  accesoPorRol(1, 'admin', 'Administrador', 'Hola, Carlos Admin'),
  accesoPorRol(2, 'entrenador', 'Entrenador', 'Hola, Esteban Trainer'),
  accesoPorRol(3, 'cliente', 'Cliente', 'Hola, Marcos Cliente'),
];
