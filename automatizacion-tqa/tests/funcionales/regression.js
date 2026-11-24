import { paso, afirmar, afirmarVisible, iniciarSesion, cuenta } from '../ayudas.js';
import { config } from '../../server/config.js';

const falloDeAcceso = (n, nombre, usuario, clave, mensaje, objetivo) => ({
  id: `TC-REG-00${n}`, nombre, tipo: 'funcional', suite: 'Regression', navegador: true,
  objetivo, precondiciones: 'Sistema disponible.', datos: `Usuario ${usuario}; contraseña de prueba inválida o cuenta restringida`,
  esperado: `Se muestra el mensaje "${mensaje}" y no se accede al panel.`,
  pasos: [
    paso('Abrir el formulario de acceso', 'Formulario visible', async ({ page }) => {
      await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
      await page.getByText('PORTAL MIEMBROS').first().click();
      await afirmarVisible(page.getByPlaceholder('Ej. carlos_admin'), 'campo de usuario');
      return 'Formulario visible';
    }),
    paso('Enviar las credenciales', 'El sistema rechaza el acceso', async ({ page }) => {
      await page.getByPlaceholder('Ej. carlos_admin').fill(usuario);
      await page.getByPlaceholder('••••••••').fill(clave);
      await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
      return 'Credenciales enviadas';
    }),
    paso('Verificar el mensaje de error', `Mensaje "${mensaje}" visible`, async ({ page }) => {
      await afirmarVisible(page.getByText(mensaje), mensaje);
      afirmar(!(await page.getByText('Cerrar Sesión').isVisible().catch(() => false)), 'sin acceso al panel', 'se mostró el panel');
      return `Mensaje "${mensaje}" visible y sin acceso al panel`;
    }),
  ],
});

export default [
  falloDeAcceso(1, 'Contraseña incorrecta es rechazada', cuenta('admin').usuario, 'clave-equivocada', 'Contraseña incorrecta.', 'Comprobar que una contraseña errónea no permite el acceso.'),
  falloDeAcceso(2, 'Usuario inexistente es rechazado', 'usuario_que_no_existe', 'cualquier-clave', 'Usuario no encontrado.', 'Comprobar que un usuario no registrado no puede entrar.'),
  falloDeAcceso(3, 'Cuenta inactiva no puede iniciar sesión', cuenta('inactivo').usuario, cuenta('inactivo').clave, 'cuenta está inactiva', 'Comprobar que una cuenta inactiva queda bloqueada.'),
  {
    id: 'TC-REG-004', nombre: 'El formulario exige usuario y contraseña', tipo: 'funcional', suite: 'Regression', navegador: true,
    objetivo: 'Comprobar que no se puede enviar el formulario de acceso con los campos vacíos.',
    precondiciones: 'Sistema disponible.', datos: 'Campos vacíos',
    esperado: 'El navegador marca el usuario como obligatorio y no se inicia sesión.',
    pasos: [
      paso('Abrir el formulario de acceso', 'Formulario visible', async ({ page }) => {
        await page.goto(config.urlSistema, { waitUntil: 'domcontentloaded' });
        await page.getByText('PORTAL MIEMBROS').first().click();
        await afirmarVisible(page.getByPlaceholder('Ej. carlos_admin'), 'campo de usuario');
        return 'Formulario visible';
      }),
      paso('Seleccionar Iniciar Sesión sin escribir nada', 'No se envía el formulario', async ({ page }) => {
        await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
        return 'Botón seleccionado con campos vacíos';
      }),
      paso('Verificar la validación del campo usuario', 'Campo usuario marcado como obligatorio', async ({ page }) => {
        const falta = await page.getByPlaceholder('Ej. carlos_admin').evaluate((el) => el.validity.valueMissing);
        afirmar(falta === true, 'campo usuario marcado como obligatorio', 'el campo no fue validado');
        return 'El campo usuario se marcó como obligatorio';
      }),
    ],
  },
  {
    id: 'TC-REG-005', nombre: 'Cerrar sesión devuelve al inicio', tipo: 'funcional', suite: 'Regression', navegador: true,
    objetivo: 'Comprobar que al cerrar sesión se abandona el panel y se vuelve a la pantalla pública.',
    precondiciones: 'Sesión iniciada como administrador.', datos: `Usuario ${cuenta('admin').usuario}`,
    esperado: 'Se muestra de nuevo el acceso al portal y desaparece el panel.',
    pasos: [
      paso('Iniciar sesión como administrador', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('admin'));
        await afirmarVisible(page.getByText('Cerrar Sesión'), 'Cerrar Sesión', 8000);
        return 'Panel del administrador visible';
      }),
      paso('Seleccionar Cerrar Sesión', 'La sesión se cierra', async ({ page }) => {
        await page.getByText('Cerrar Sesión').first().click();
        return 'Sesión cerrada';
      }),
      paso('Verificar que se vuelve a la pantalla pública', 'Acceso o formulario de ingreso visible', async ({ page }) => {
        await afirmarVisible(page.getByPlaceholder('Ej. carlos_admin').or(page.getByText('PORTAL MIEMBROS')), 'pantalla de acceso', 8000);
        afirmar(!(await page.getByText('Cerrar Sesión').isVisible().catch(() => false)), 'panel oculto', 'el panel sigue visible');
        return 'Se volvió a la pantalla de acceso';
      }),
    ],
  },
  {
    id: 'TC-REG-006', nombre: 'Alternar entre modo claro y modo oscuro', tipo: 'funcional', suite: 'Regression', navegador: true,
    objetivo: 'Comprobar que el botón de tema cambia entre modo claro y oscuro.',
    precondiciones: 'Sesión iniciada como administrador.', datos: `Usuario ${cuenta('admin').usuario}`,
    esperado: 'Al seleccionar Modo Claro el botón pasa a mostrar Modo Oscuro.',
    pasos: [
      paso('Iniciar sesión como administrador', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('admin'));
        await afirmarVisible(page.getByText('Modo Claro'), 'botón Modo Claro', 8000);
        return 'Panel visible con botón Modo Claro';
      }),
      paso('Seleccionar Modo Claro', 'El botón cambia a Modo Oscuro', async ({ page }) => {
        await page.getByText('Modo Claro').first().click();
        await afirmarVisible(page.getByText('Modo Oscuro'), 'botón Modo Oscuro');
        return 'El tema cambió y el botón muestra Modo Oscuro';
      }),
    ],
  },
  {
    id: 'TC-REG-007', nombre: 'Pago con tarjeta real en la pasarela', tipo: 'funcional', suite: 'Regression', navegador: false,
    omitir: 'Requiere una pasarela de pagos externa que no existe en el ambiente de pruebas.',
    objetivo: 'Verificar el cobro real con tarjeta de crédito.',
    precondiciones: 'Pasarela de pagos conectada.', datos: 'Tarjeta de prueba de la pasarela',
    esperado: 'El cobro se aprueba y se emite la factura.',
    pasos: [paso('Realizar un pago con tarjeta', 'Cobro aprobado', async () => 'No ejecutado')],
  },
];
