import { paso, afirmarVisible, iniciarSesion, cuenta } from '../ayudas.js';

// Caso diseñado para FALLAR a propósito: sirve para demostrar cómo el informe
// muestra el error, el paso donde ocurrió y la evidencia. Es un fallo FUNCIONAL.
export default [
  {
    id: 'TC-FAL-001', nombre: 'Panel con módulo inexistente (fallo controlado)', tipo: 'funcional', suite: 'Fallo controlado', navegador: true, fallaControlada: true,
    objetivo: 'Demostrar el tratamiento de un fallo: se busca un módulo que NO existe en el sistema.',
    precondiciones: 'Sesión de administrador.', datos: `Usuario ${cuenta('admin').usuario}; texto buscado "Facturación Cuántica"`,
    esperado: 'Se mostraría un módulo llamado "Facturación Cuántica" (no existe, por eso el caso falla a propósito).',
    pasos: [
      paso('Iniciar sesión como administrador', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('admin'));
        await afirmarVisible(page.getByText('Cerrar Sesión'), 'Cerrar Sesión', 8000);
        return 'Panel del administrador visible';
      }),
      paso('Buscar el módulo "Facturación Cuántica" en el menú', 'Módulo visible en el menú', async ({ page }) => {
        await afirmarVisible(page.getByText('Facturación Cuántica'), 'módulo Facturación Cuántica', 2500);
        return 'Módulo encontrado';
      }),
    ],
  },
];
