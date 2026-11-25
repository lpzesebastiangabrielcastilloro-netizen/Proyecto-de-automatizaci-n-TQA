// Ejecución desde la consola (sin interfaz). Ejemplo:
//   npm run ejecutar -- --tipo funcional --suite Smoke --email tu@correo.com
import { seleccionar } from '../tests/catalogo.js';
import { crearCorrida, ejecutarCorrida } from '../server/ejecutor.js';
import { generarSalidas } from '../server/salidas.js';
import { correoValido } from '../src/mailer.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const tipo = arg('tipo', 'funcional'); const suite = arg('suite', 'Smoke'); const email = arg('email', 'demo@prueba.local');
const casos = arg('casos', '') ? arg('casos').split(',') : [];
if (!correoValido(email)) { console.error('Correo inválido'); process.exit(2); }
const lista = seleccionar({ tipo, suite, casos });
if (!lista.length) { console.error(`No hay casos para ${tipo} / ${suite}`); process.exit(2); }
const corrida = crearCorrida({ tipo, suite, alcance: casos.length ? `${lista.length} casos seleccionados` : 'Categoría completa', email, casos: lista });
let vistas = 0;
await ejecutarCorrida(corrida, lista, { generarSalidas, alActualizar: (c) => { while (vistas < c.registro.length) console.log('  ' + c.registro[vistas++]); } });
const r = corrida.resumen;
console.log(`\n${corrida.id} · ${corrida.resultadoGlobal}\nPASS ${r.pass} · FAIL ${r.fail} · SKIPPED ${r.skipped} · NOT RUN ${r.notRun} · éxito ${r.exito}%\nCarpeta: runs/${corrida.id}`);
process.exit(corrida.estado === 'fallida' ? 1 : 0);
