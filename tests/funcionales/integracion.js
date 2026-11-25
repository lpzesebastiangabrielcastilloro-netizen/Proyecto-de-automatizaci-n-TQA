import { paso, afirmar, afirmarIgual, afirmarContiene, api, cuenta } from '../ayudas.js';

export default [
  {
    id: 'TC-INT-001', nombre: 'La API de acceso devuelve token y rol', tipo: 'funcional', suite: 'Integration', navegador: false,
    objetivo: 'Comprobar que el servicio de inicio de sesión valida credenciales y devuelve los datos de la sesión.',
    precondiciones: 'Sistema disponible; cuenta de administrador habilitada.', datos: `POST /api/auth/login con ${cuenta('admin').usuario}`,
    esperado: 'HTTP 200 con token, rol "admin" y sin la contraseña en la respuesta.',
    pasos: [
      paso('Enviar credenciales válidas a POST /api/auth/login', 'HTTP 200', async () => {
        const r = await api('POST', '/api/auth/login', { username: cuenta('admin').usuario, password: cuenta('admin').clave });
        afirmarIgual(r.estado, 200, 'código HTTP');
        return `HTTP ${r.estado} · ${r.ms} ms`;
      }),
      paso('Verificar el contenido de la respuesta', 'Incluye token y rol admin; no incluye contraseña', async () => {
        const r = await api('POST', '/api/auth/login', { username: cuenta('admin').usuario, password: cuenta('admin').clave });
        afirmar(typeof r.json?.token === 'string' && r.json.token.length > 5, 'token presente', 'sin token');
        afirmarIgual(r.json.rol, 'admin', 'rol');
        afirmar(!('password' in r.json), 'respuesta sin contraseña', 'la respuesta incluye la contraseña');
        return `Token recibido · rol ${r.json.rol} · sin contraseña`;
      }),
    ],
  },
  {
    id: 'TC-INT-002', nombre: 'Alta y baja de un socio por la API', tipo: 'funcional', suite: 'Integration', navegador: false,
    objetivo: 'Comprobar el ciclo crear, consultar y eliminar un socio, dejando el sistema como estaba.',
    precondiciones: 'Sistema disponible.', datos: 'Socio temporal "qa_socio_temporal" (se elimina al final)',
    esperado: 'El socio se crea (201), aparece en el listado y se elimina sin dejar rastro.',
    pasos: (() => {
      let idCreado = null;
      return [
        paso('Crear el socio con POST /api/members', 'HTTP 201', async () => {
          const r = await api('POST', '/api/members', { username: 'qa_socio_temporal', nombre: 'Socio Temporal QA', email: 'qa.temporal@prueba.local', rol: 'client' });
          afirmarIgual(r.estado, 201, 'código HTTP');
          idCreado = r.json.id;
          return `HTTP 201 · socio creado con id ${idCreado}`;
        }),
        paso('Consultar el listado y buscar al socio', 'El socio aparece en GET /api/members', async () => {
          const r = await api('GET', '/api/members');
          afirmar(r.json.some((m) => m.id === idCreado), 'socio presente en el listado', 'no se encontró el socio creado');
          return 'Socio encontrado en el listado';
        }),
        paso('Eliminar al socio con DELETE /api/members/:id', 'HTTP 200 y el socio desaparece', async () => {
          const d = await api('DELETE', `/api/members/${idCreado}`);
          afirmar(d.estado === 200 || d.estado === 204, 'HTTP 200/204', `HTTP ${d.estado}`);
          const r = await api('GET', '/api/members');
          afirmar(!r.json.some((m) => m.id === idCreado), 'socio eliminado', 'el socio sigue en el listado');
          return `HTTP ${d.estado} · socio eliminado`;
        }),
      ];
    })(),
  },
  {
    id: 'TC-INT-003', nombre: 'El asistente de IA personaliza la respuesta con los datos del socio', tipo: 'funcional', suite: 'Integration', navegador: false,
    objetivo: 'Comprobar que el asistente integra las medidas corporales del socio en su respuesta.',
    precondiciones: 'Sistema disponible; el socio de prueba tiene medidas registradas.', datos: `Cliente ${cuenta('cliente').usuario}`,
    esperado: 'La respuesta menciona el peso, la grasa corporal y el IMC del socio.',
    pasos: [
      paso('Enviar la consulta a POST /api/ai/chat', 'HTTP 200 con una respuesta', async () => {
        const r = await api('POST', '/api/ai/chat', { message: '¿Cuál es mi progreso corporal de grasa y peso?', clientId: cuenta('cliente').id, role: 'client' });
        afirmarIgual(r.estado, 200, 'código HTTP');
        afirmar(typeof r.json?.response === 'string', 'campo response de tipo texto', 'sin campo response');
        return `HTTP 200 · ${r.ms} ms`;
      }),
      paso('Verificar que la respuesta usa los datos del socio', 'Menciona peso, grasa e IMC', async () => {
        const r = await api('POST', '/api/ai/chat', { message: '¿Cuál es mi progreso corporal de grasa y peso?', clientId: cuenta('cliente').id, role: 'client' });
        for (const k of ['Peso', 'IMC']) afirmarContiene(r.json.response, k, 'respuesta');
        afirmar(/\d+(\.\d+)?\s?kg/.test(r.json.response), 'un peso en kg', 'no hay un peso numérico');
        return r.json.response.replace(/\*\*/g, '').replace(/\s+/g, ' ').slice(0, 160) + '…';
      }),
    ],
  },
  {
    id: 'TC-INT-004', nombre: 'El asistente de IA rechaza mensajes vacíos', tipo: 'funcional', suite: 'Integration', navegador: false,
    objetivo: 'Comprobar la validación de entrada del asistente.',
    precondiciones: 'Sistema disponible.', datos: 'Mensaje vacío',
    esperado: 'HTTP 400 con un mensaje que pide una consulta.',
    pasos: [
      paso('Enviar un mensaje vacío a POST /api/ai/chat', 'HTTP 400', async () => {
        const r = await api('POST', '/api/ai/chat', { message: '', role: 'client' });
        afirmarIgual(r.estado, 400, 'código HTTP');
        afirmarContiene(r.texto, 'consulta', 'mensaje de error');
        return `HTTP 400 · ${r.texto.slice(0, 80)}`;
      }),
    ],
  },
];
