export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fechaLarga = (iso) => (iso ? new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
export const fechaHora = (iso) => (iso ? `${new Date(iso).toLocaleDateString('es-BO')} ${hora(iso)}` : '—');
export const duracion = (ms) => {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000; if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
};
export const TIPO = { funcional: 'Funcional', no_funcional: 'No funcional' };
export const ICONO = { PASS: '✓', FAIL: '✕', SKIPPED: '–', 'NOT RUN': '○' };
export const COLOR = {
  PASS: { fondo: '#E3F4EC', texto: '#0A6B47', borde: '#0E9F6E' },
  FAIL: { fondo: '#FBE7E5', texto: '#A5261C', borde: '#D6372B' },
  SKIPPED: { fondo: '#EDF0F3', texto: '#4A5865', borde: '#8593A0' },
  'NOT RUN': { fondo: '#FFF3D6', texto: '#7A5800', borde: '#E0A100' },
};
export const insignia = (estado) => {
  const c = COLOR[estado] || COLOR['NOT RUN'];
  return `<span class="est" style="background:${c.fondo};color:${c.texto};border-color:${c.borde}"><b>${ICONO[estado] || '○'}</b> ${esc(estado)}</span>`;
};
export const etiquetaResumenIA = (r) => (r ? `Generado por ${r.proveedor === 'local' ? 'reglas locales (sin IA externa)' : 'IA · ' + r.proveedor + ' ' + (r.modelo || '')}. El estado de cada caso proviene de la ejecución real.` : '');
