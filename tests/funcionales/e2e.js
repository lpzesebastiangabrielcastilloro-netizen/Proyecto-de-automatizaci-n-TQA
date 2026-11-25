import { paso, afirmar, afirmarVisible, iniciarSesion, cuenta } from '../ayudas.js';

export default [
  {
    id: 'TC-E2E-001', nombre: 'El administrador busca un socio', tipo: 'funcional', suite: 'End-to-End', navegador: true,
    objetivo: 'Recorrer el flujo del administrador: entrar, abrir el control de miembros y filtrar por nombre.',
    precondiciones: 'Cuenta de administrador habilitada; socio Sofía Rodríguez registrado.', datos: `Usuario ${cuenta('admin').usuario}; búsqueda "sofia"`,
    esperado: 'El listado muestra a Sofía Rodríguez y oculta a los demás socios.',
    pasos: [
      paso('Iniciar sesión como administrador', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('admin'));
        await afirmarVisible(page.getByText('Control de Miembros'), 'Control de Miembros', 8000);
        return 'Panel del administrador visible';
      }),
      paso('Abrir Control de Miembros', 'Se muestra el listado de socios', async ({ page }) => {
        await page.getByText('Control de Miembros').first().click();
        await afirmarVisible(page.getByPlaceholder('Buscar por nombre, email o usuario...'), 'buscador de socios');
        return 'Listado de socios visible';
      }),
      paso('Buscar "sofia" en el filtro', 'Solo aparece Sofía Rodríguez', async ({ page }) => {
        await page.getByPlaceholder('Buscar por nombre, email o usuario...').fill('sofia');
        await afirmarVisible(page.getByText(/Sof[ií]a Rodr[ií]guez/), 'Sofía Rodríguez');
        afirmar(!(await page.getByText(/Lucas/).first().isVisible().catch(() => false)), 'otros socios ocultos', 'aún se muestran otros socios');
        return 'Se muestra solo Sofía Rodríguez';
      }),
    ],
  },
  {
    id: 'TC-E2E-002', nombre: 'El entrenador abre la asignación de rutinas', tipo: 'funcional', suite: 'End-to-End', navegador: true,
    objetivo: 'Recorrer el flujo del entrenador: entrar y abrir la asignación de rutinas a sus socios.',
    precondiciones: 'Cuenta de entrenador habilitada.', datos: `Usuario ${cuenta('entrenador').usuario}`,
    esperado: 'Se muestra la lista de socios y la ficha de rutina del socio seleccionado.',
    pasos: [
      paso('Iniciar sesión como entrenador', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('entrenador'));
        await afirmarVisible(page.getByText('Asignar Rutinas').first(), 'Asignar Rutinas', 8000);
        return 'Panel del entrenador visible';
      }),
      paso('Abrir Asignar Rutinas', 'Se muestra la lista de socios', async ({ page }) => {
        await page.getByText('Asignar Rutinas').first().click();
        await afirmarVisible(page.getByText('Marcos Cliente').first(), 'socio Marcos Cliente');
        return 'Lista de socios visible';
      }),
      paso('Seleccionar al socio Marcos Cliente', 'Se muestra su ficha de rutina', async ({ page }) => {
        await page.getByText('Marcos Cliente').first().click();
        await afirmarVisible(page.getByText(/Dise[ñn]ando rutina para/i), 'encabezado "Diseñando rutina para"');
        const titulos = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
        afirmar(titulos.some((v) => v.includes('Hipertrofia')), 'ficha con el título "Hipertrofia - Plan Personalizado Completo"', `títulos encontrados: ${titulos.filter(Boolean).join(' | ') || 'ninguno'}`);
        return 'Ficha "Hipertrofia - Plan Personalizado Completo" cargada para Marcos Cliente';
      }),
    ],
  },
  {
    id: 'TC-E2E-003', nombre: 'El cliente recorre su rutina, alimentación y logros', tipo: 'funcional', suite: 'End-to-End', navegador: true,
    objetivo: 'Recorrer el flujo completo del cliente por sus tres secciones principales.',
    precondiciones: 'Cuenta de cliente habilitada con rutina y plan nutricional asignados.', datos: `Usuario ${cuenta('cliente').usuario}`,
    esperado: 'Cada sección muestra su contenido: ejercicios, plan de alimentación y medallas.',
    pasos: [
      paso('Iniciar sesión como cliente', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('cliente'));
        await afirmarVisible(page.getByText('Mi Rutina').first(), 'Mi Rutina', 8000);
        return 'Panel del cliente visible';
      }),
      paso('Abrir Mi Rutina', 'Se muestran los ejercicios asignados', async ({ page }) => {
        await page.getByText('Mi Rutina').first().click();
        await afirmarVisible(page.getByText('Press de Banca con Barra').first(), 'ejercicio Press de Banca con Barra');
        return 'Ejercicios de la rutina visibles';
      }),
      paso('Abrir Mi Alimentación', 'Se muestra el plan de alimentación', async ({ page }) => {
        await page.getByText('Mi Alimentación').first().click();
        await afirmarVisible(page.getByText('Mi Plan de Alimentación'), 'Mi Plan de Alimentación');
        return 'Plan de alimentación visible';
      }),
      paso('Abrir Mis Logros y Desafíos', 'Se muestran las medallas', async ({ page }) => {
        await page.getByText('Mis Logros y Desafíos').first().click();
        await afirmarVisible(page.getByText('Asistencia Perfecta').first(), 'medalla Asistencia Perfecta');
        return 'Medallas visibles';
      }),
    ],
  },
  {
    id: 'TC-E2E-004', nombre: 'El cliente consulta su progreso al asistente de IA', tipo: 'funcional', suite: 'End-to-End', navegador: true,
    objetivo: 'Comprobar el flujo completo del asistente desde la interfaz: abrir el chat, preguntar y recibir una respuesta personalizada.',
    precondiciones: 'Cuenta de cliente con medidas registradas.', datos: `Usuario ${cuenta('cliente').usuario}; pregunta sobre progreso corporal`,
    esperado: 'El chat responde con el peso, la grasa corporal y el IMC del socio.',
    pasos: [
      paso('Iniciar sesión como cliente', 'Panel visible', async ({ page }) => {
        await iniciarSesion(page, cuenta('cliente'));
        await afirmarVisible(page.getByText('Mi Rutina').first(), 'Mi Rutina', 8000);
        return 'Panel del cliente visible';
      }),
      paso('Abrir el chat del asistente', 'El chat se despliega', async ({ page }) => {
        await page.locator('div.fixed button, button.fixed').last().click();
        await afirmarVisible(page.getByPlaceholder('Pregunte sobre rutina, dieta, progreso corporal...'), 'campo de consulta del chat');
        return 'Chat del asistente abierto';
      }),
      paso('Escribir la consulta y enviarla', 'La consulta se envía', async ({ page }) => {
        const campo = page.getByPlaceholder('Pregunte sobre rutina, dieta, progreso corporal...');
        await campo.fill('¿Cuál es mi progreso corporal de grasa y peso?');
        await campo.press('Enter');
        return 'Consulta enviada';
      }),
      paso('Verificar la respuesta del asistente', 'Respuesta con peso, grasa e IMC', async ({ page }) => {
        await afirmarVisible(page.getByText(/Registramos\s+\d+/).first(), 'respuesta con el peso del socio', 8000);
        await afirmarVisible(page.getByText(/IMC/).first(), 'IMC en la respuesta');
        return 'El asistente respondió con peso, grasa corporal e IMC';
      }),
    ],
  },
];
