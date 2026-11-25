import { paso, afirmar, api, cuenta, percentil } from '../ayudas.js';
import { config } from '../../server/config.js';

const base = { tipo: 'no_funcional', precondiciones: 'Sistema disponible y sin otras cargas pesadas.' };

export default [
  {
    ...base, id: 'TC-PERF-001', nombre: 'La página principal carga en menos de 3 segundos', suite: 'Performance', navegador: true,
    objetivo: 'Medir el tiempo de carga de la página de inicio.', datos: 'Umbral: 3000 ms',
    esperado: 'El evento load ocurre en menos de 3000 ms.',
    pasos: [
      paso('Abrir la página principal y medir el tiempo de carga', 'Carga < 3000 ms', async ({ page }) => {
        const t0 = performance.now();
        await page.goto(config.urlSistema, { waitUntil: 'load' });
        const ms = Math.round(performance.now() - t0);
        afirmar(ms < 3000, 'carga en menos de 3000 ms', `${ms} ms`);
        return `Carga completa en ${ms} ms (umbral 3000 ms)`;
      }),
    ],
  },
  {
    ...base, id: 'TC-PERF-002', nombre: 'El inicio de sesión responde en menos de 300 ms (percentil 95)', suite: 'Performance', navegador: false,
    objetivo: 'Medir la latencia de POST /api/auth/login en 30 peticiones consecutivas.', datos: 'Umbral: p95 < 300 ms',
    esperado: 'El percentil 95 de las 30 mediciones es menor que 300 ms.',
    pasos: [
      paso('Enviar 30 inicios de sesión consecutivos', 'p95 < 300 ms', async () => {
        const t = [];
        for (let i = 0; i < 30; i++) {
          const r = await api('POST', '/api/auth/login', { username: cuenta('admin').usuario, password: cuenta('admin').clave });
          afirmar(r.estado === 200, 'HTTP 200 en todas las peticiones', `HTTP ${r.estado}`);
          t.push(r.ms);
        }
        const p95 = percentil(t, 95); const prom = Math.round(t.reduce((a, b) => a + b, 0) / t.length);
        afirmar(p95 < 300, 'p95 menor que 300 ms', `${p95} ms`);
        return `30 peticiones · promedio ${prom} ms · p95 ${p95} ms · máximo ${Math.max(...t)} ms`;
      }),
    ],
  },
  {
    ...base, id: 'TC-PERF-003', nombre: 'El asistente de IA responde en menos de 2 segundos', suite: 'Performance', navegador: false,
    objetivo: 'Medir el tiempo de respuesta del asistente.', datos: 'Umbral: 2000 ms',
    esperado: 'La respuesta llega en menos de 2000 ms.',
    pasos: [
      paso('Consultar al asistente y medir el tiempo', 'Respuesta < 2000 ms', async () => {
        const r = await api('POST', '/api/ai/chat', { message: 'rutina', clientId: cuenta('cliente').id, role: 'client' });
        afirmar(r.estado === 200, 'HTTP 200', `HTTP ${r.estado}`);
        afirmar(r.ms < 2000, 'respuesta en menos de 2000 ms', `${r.ms} ms`);
        return `Respuesta en ${r.ms} ms (umbral 2000 ms)`;
      }),
    ],
  },
];
