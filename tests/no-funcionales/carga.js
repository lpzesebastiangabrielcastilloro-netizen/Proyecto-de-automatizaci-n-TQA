import { paso, afirmar, api, cuenta, percentil } from '../ayudas.js';
import { config } from '../../server/config.js';

const base = { tipo: 'no_funcional', precondiciones: 'Sistema disponible.', navegador: false };

async function lanzarConcurrente(total, concurrencia, fabrica) {
  const tiempos = []; let errores = 0; let siguiente = 0;
  async function obrero() {
    while (siguiente < total) {
      const i = siguiente++;
      try { const r = await fabrica(i); tiempos.push(r.ms); if (r.estado >= 400) errores++; } catch { errores++; }
    }
  }
  const t0 = performance.now();
  await Promise.all(Array.from({ length: concurrencia }, obrero));
  return { tiempos, errores, total, segundos: (performance.now() - t0) / 1000 };
}
const resumen = (r) => {
  const prom = Math.round(r.tiempos.reduce((a, b) => a + b, 0) / Math.max(1, r.tiempos.length));
  return `${r.total} peticiones en ${r.segundos.toFixed(1)} s · ${Math.round(r.total / r.segundos)} req/s · promedio ${prom} ms · p95 ${percentil(r.tiempos, 95)} ms · errores ${r.errores}`;
};

export default [
  {
    ...base, id: 'TC-LOAD-001', nombre: 'Carga: 25 usuarios simultáneos consultan los socios', suite: 'Carga',
    objetivo: 'Verificar el comportamiento con carga normal sostenida.', datos: '100 peticiones GET /api/members, 25 en paralelo',
    esperado: 'Sin errores y promedio menor que 500 ms.',
    pasos: [
      paso('Ejecutar 100 peticiones con 25 usuarios en paralelo', 'Sin errores; promedio < 500 ms', async () => {
        const r = await lanzarConcurrente(100, 25, () => api('GET', '/api/members'));
        const prom = r.tiempos.reduce((a, b) => a + b, 0) / r.tiempos.length;
        afirmar(r.errores === 0, '0 errores', `${r.errores} errores`);
        afirmar(prom < 500, 'promedio menor que 500 ms', `${Math.round(prom)} ms`);
        return resumen(r);
      }),
    ],
  },
  {
    ...base, id: 'TC-LOAD-002', nombre: 'Carga: 50 inicios de sesión simultáneos', suite: 'Carga',
    objetivo: 'Verificar el servicio de acceso cuando muchos usuarios entran a la vez.', datos: '50 POST /api/auth/login, 50 en paralelo',
    esperado: 'Sin errores y p95 menor que 1000 ms.',
    pasos: [
      paso('Lanzar 50 inicios de sesión en paralelo', 'Sin errores; p95 < 1000 ms', async () => {
        const r = await lanzarConcurrente(50, 50, () => api('POST', '/api/auth/login', { username: cuenta('cliente').usuario, password: cuenta('cliente').clave }));
        const p95 = percentil(r.tiempos, 95);
        afirmar(r.errores === 0, '0 errores', `${r.errores} errores`);
        afirmar(p95 < 1000, 'p95 menor que 1000 ms', `${p95} ms`);
        return resumen(r);
      }),
    ],
  },
  {
    ...base, id: 'TC-STR-001', nombre: 'Estrés: 300 peticiones simultáneas', suite: 'Estrés',
    objetivo: 'Llevar el sistema por encima de su uso normal para observar si degrada o falla.', datos: '300 GET /api/members, 300 en paralelo',
    esperado: 'Tasa de errores menor o igual a 1 %.',
    pasos: [
      paso('Lanzar 300 peticiones al mismo tiempo', 'Errores ≤ 1 %', async () => {
        const r = await lanzarConcurrente(300, 300, () => api('GET', '/api/members'));
        const tasa = (r.errores / r.total) * 100;
        afirmar(tasa <= 1, 'tasa de errores ≤ 1 %', `${tasa.toFixed(1)} %`);
        return `${resumen(r)} · tasa de error ${tasa.toFixed(1)} %`;
      }),
    ],
  },
  {
    ...base, id: 'TC-SOAK-001', nombre: 'Resistencia: tráfico constante sin degradación', suite: 'Resistencia',
    objetivo: 'Verificar que la latencia no se degrada con el paso del tiempo bajo tráfico constante.',
    datos: `${config.segundosResistencia} s de tráfico, 5 peticiones por segundo`,
    esperado: 'Sin errores; la latencia del último tercio no supera el doble de la del primer tercio (+50 ms).',
    pasos: [
      paso('Mantener tráfico constante y registrar la latencia', 'Sin errores y latencia estable', async () => {
        const seg = config.segundosResistencia; const muestras = []; let errores = 0;
        const t0 = performance.now(); let n = 0;
        while ((performance.now() - t0) / 1000 < seg) {
          const ruta = n % 2 ? '/api/routines' : '/api/members';
          try { const r = await api('GET', ruta); muestras.push(r.ms); if (r.estado >= 400) errores++; } catch { errores++; }
          n++; await new Promise((ok) => setTimeout(ok, 200));
        }
        const tercio = Math.floor(muestras.length / 3);
        const prom = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        const inicio = prom(muestras.slice(0, tercio)); const fin = prom(muestras.slice(-tercio));
        afirmar(errores === 0, '0 errores', `${errores} errores`);
        afirmar(fin <= inicio * 2 + 50, 'latencia estable', `inicio ${inicio.toFixed(0)} ms → fin ${fin.toFixed(0)} ms`);
        return `${muestras.length} peticiones en ${seg} s · latencia inicial ${inicio.toFixed(0)} ms · final ${fin.toFixed(0)} ms · errores ${errores}`;
      }),
    ],
  },
];
