// Logo do app: o Tio Patinhas cunhado numa moeda de ouro.
// O retrato vem do desenho em scripts/retrato.png, vetorizado em scripts/retrato.mjs
// (python3 scripts/tracar_retrato.py): silhueta em relevo dourado e traço bronze.
// Os ícones (icons/) saem daqui: node scripts/icones.mjs
import { CENTRO, RAIO, SILHUETA, LINHAS } from './retrato.mjs';

const BRONZE = '#6b4510';
const RAIO_RETRATO = 75; // cabe dentro do anel de pontinhos (r 79,5)
const ESPESSURA = 1.6; // engrossa o traço, em pixels do desenho, para ler bem nos ícones pequenos

/** Partes do desenho (sem a tag <svg>), num quadro de 200x200. `p` prefixa os ids. */
export function desenhoMoeda(p = 'm') {
  const escala = (RAIO_RETRATO / RAIO).toFixed(4);
  const encaixe = `translate(100 100) scale(${escala}) translate(${-CENTRO[0]} ${-CENTRO[1]})`;
  return `
  <defs>
    <linearGradient id="${p}borda" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe7a1"/><stop offset=".45" stop-color="#e9b443"/><stop offset="1" stop-color="#a8701a"/>
    </linearGradient>
    <linearGradient id="${p}aro" x1=".15" y1="0" x2=".85" y2="1">
      <stop offset="0" stop-color="#fff0c2"/><stop offset=".5" stop-color="#f1c252"/><stop offset="1" stop-color="#c88d24"/>
    </linearGradient>
    <radialGradient id="${p}campo" cx=".42" cy=".38" r=".7">
      <stop offset="0" stop-color="#f6c95e"/><stop offset=".6" stop-color="#e9b03f"/><stop offset="1" stop-color="#d0942a"/>
    </radialGradient>
    <linearGradient id="${p}relevo" x1=".1" y1="0" x2=".9" y2="1">
      <stop offset="0" stop-color="#fff6d4"/><stop offset=".55" stop-color="#fbe08e"/><stop offset="1" stop-color="#eebd55"/>
    </linearGradient>
  </defs>

  <!-- Moeda: serrilha, aro em relevo, campo e anel de pontinhos -->
  <circle cx="100" cy="100" r="98" fill="url(#${p}borda)"/>
  <circle cx="100" cy="100" r="95.6" fill="none" stroke="#9a6514" stroke-width="4.2" stroke-dasharray="1.3 1.7" opacity=".55"/>
  <circle cx="100" cy="100" r="92" fill="url(#${p}aro)"/>
  <circle cx="100" cy="100" r="84" fill="url(#${p}campo)"/>
  <path d="M40.6 40.6A84 84 0 0 1 159.4 40.6" fill="none" stroke="#b07a1c" stroke-width="1.6" opacity=".7"/>
  <path d="M159.4 159.4A84 84 0 0 1 40.6 159.4" fill="none" stroke="#fff3c8" stroke-width="1.6" opacity=".8"/>
  <circle cx="100" cy="100" r="79.5" fill="none" stroke="#b47e1f" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 6.24"/>

  <!-- Retrato: sombra, relevo e traço -->
  <path d="${SILHUETA}" transform="translate(1.3 1.8) ${encaixe}" fill="#a26a16" opacity=".5"/>
  <path d="${SILHUETA}" transform="${encaixe}" fill="url(#${p}relevo)"/>
  <path d="${LINHAS}" transform="${encaixe}" fill="${BRONZE}" stroke="${BRONZE}" stroke-width="${ESPESSURA}" stroke-linejoin="round"/>`;
}
