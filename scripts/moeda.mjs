// Logo do app: o Tio Patinhas de perfil, cunhado numa moeda de ouro.
// Versão simplificada do mascote (js/mascote.js): cartola, óculos redondos, sobrancelha farta
// e gravata-borboleta, em relevo dourado com contorno bronze. Desenho original, em SVG.
// Os ícones (icons/) saem daqui: node scripts/icones.mjs

const BRONZE = '#6b4510';

/** Partes do desenho (sem a tag <svg>), num quadro de 200x200. `p` prefixa os ids. */
export function desenhoMoeda(p = 'm') {
  return `
  <defs>
    <linearGradient id="${p}borda" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe7a1"/><stop offset=".45" stop-color="#e9b443"/><stop offset="1" stop-color="#a8701a"/>
    </linearGradient>
    <linearGradient id="${p}aro" x1=".15" y1="0" x2=".85" y2="1">
      <stop offset="0" stop-color="#fff0c2"/><stop offset=".5" stop-color="#f1c252"/><stop offset="1" stop-color="#c88d24"/>
    </linearGradient>
    <radialGradient id="${p}campo" cx=".42" cy=".38" r=".7">
      <stop offset="0" stop-color="#fbd776"/><stop offset=".6" stop-color="#efbb48"/><stop offset="1" stop-color="#d79c2f"/>
    </radialGradient>
    <linearGradient id="${p}relevo" x1=".1" y1="0" x2=".9" y2="1">
      <stop offset="0" stop-color="#fff4cc"/><stop offset=".55" stop-color="#f8d36a"/><stop offset="1" stop-color="#e2a83c"/>
    </linearGradient>
    <linearGradient id="${p}cartola" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c99130"/><stop offset="1" stop-color="#8a5a14"/>
    </linearGradient>
    <clipPath id="${p}dentro"><circle cx="100" cy="100" r="77"/></clipPath>
  </defs>

  <!-- Moeda: serrilha, aro em relevo e campo -->
  <circle cx="100" cy="100" r="98" fill="url(#${p}borda)"/>
  <circle cx="100" cy="100" r="95.6" fill="none" stroke="#9a6514" stroke-width="4.2" stroke-dasharray="1.3 1.7" opacity=".55"/>
  <circle cx="100" cy="100" r="92" fill="url(#${p}aro)"/>
  <circle cx="100" cy="100" r="84" fill="url(#${p}campo)"/>
  <path d="M40.6 40.6A84 84 0 0 1 159.4 40.6" fill="none" stroke="#b07a1c" stroke-width="1.6" opacity=".7"/>
  <path d="M159.4 159.4A84 84 0 0 1 40.6 159.4" fill="none" stroke="#fff3c8" stroke-width="1.6" opacity=".8"/>
  <circle cx="100" cy="100" r="79.5" fill="none" stroke="#b47e1f" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 6.24"/>

  <!-- Retrato de perfil -->
  <g clip-path="url(#${p}dentro)" stroke="${BRONZE}" stroke-linejoin="round" stroke-linecap="round">
    <!-- Casaco, camisa, colarinho e gravata-borboleta -->
    <path d="M30 196c2-26 18-42 46-48l30 4 30-4c26 6 42 22 46 48z" fill="url(#${p}relevo)" stroke-width="3"/>
    <path d="M76 148l30 4-6 44H66c-2-18 2-34 10-48zM136 148l-30 4 6 44h34c2-18-2-34-10-48z" fill="#e7b247" stroke-width="2.6"/>
    <path d="M106 152l-14 44h28z" fill="#fff1c4" stroke-width="2.4"/>
    <path d="M106 151l-15-7-3 11 9 2zM106 151l15-7 3 11-9 2z" fill="#fff1c4" stroke-width="2.4"/>
    <path d="M106 156l-14-8v16zM106 156l14-8v16z" fill="url(#${p}cartola)" stroke-width="2.4"/>
    <rect x="102" y="152" width="8" height="8" rx="2.4" fill="#d19a35" stroke-width="2.2"/>

    <!-- Cabeça -->
    <path d="M116 66c22 0 37 16 37 38 0 23-16 39-38 39-12 0-22-4-28-12-5-6-8-14-8-24 0-24 15-41 37-41z" fill="url(#${p}relevo)" stroke-width="3.2"/>
    <path d="M144 80c6 7 9 15 9 24 0 20-12 34-30 38 16-8 24-22 24-38 0-9-1-17-3-24z" fill="#e3a83c" stroke="none" opacity=".55"/>

    <!-- Bico largo de pato -->
    <path d="M89 112.4c-8 4-20 6.6-31 6.8-5 .1-8.4-.4-10-1.2 2 3.4 7.4 5.4 14 5.4 11 0 20-2.6 27-6.6z" fill="#e5ad40" stroke-width="2.6"/>
    <path d="M88 97c-14-1-30 0-40 3-9 2.6-11 9-6 12.4 4 2.6 12 3.4 22 2.6 9-.6 18-2.4 25-5z" fill="url(#${p}relevo)" stroke-width="3.2"/>
    <path d="M57.4 103.6c2.2-.8 4.6-1.2 6.8-1.2" stroke-width="2.4" fill="none"/>
    <path d="M50 104.4c9-3.4 21-4.6 33-4" stroke="#fff6d6" stroke-width="2" fill="none" opacity=".9"/>

    <!-- Olho, de pálpebra meio baixa -->
    <ellipse cx="102" cy="92" rx="6.4" ry="8.4" fill="#fff6dc" stroke-width="2.2"/>
    <ellipse cx="100" cy="94.4" rx="3.2" ry="4.6" fill="${BRONZE}" stroke="none"/>
    <path d="M95.6 88.6c4.2-2.4 9-2.4 13 0" stroke-width="2.8" fill="none"/>

    <!-- Óculos redondos -->
    <circle cx="101" cy="93" r="13.5" fill="#fff8e0" fill-opacity=".16" stroke-width="2.8"/>
    <path d="M114.4 91L142 85" stroke-width="2.8" fill="none"/>
    <path d="M91.4 85.4c1.8-3 4.6-4.8 8-5.2" stroke="#fff6d6" stroke-width="1.8" fill="none"/>

    <!-- Sobrancelha farta -->
    <path d="M85 82.4c3.6-7 12.6-10.6 25-9 2.8.4 2.8 3.6.2 3.8-7.8 0-13.4 1.6-17.4 4.6l1.8 1.8c-3.2.6-6.4.4-9.6-1.2z" fill="#fff1c4" stroke-width="2.4"/>

    <!-- Cartola, inclinada para trás -->
    <g transform="translate(0 -2) rotate(9 118 70)">
      <path d="M96 66c.8-9 1.2-17 1.6-26 .2-3.6 43-3.6 43.2 0 .4 9 .8 17 1.6 26z" fill="url(#${p}cartola)" stroke-width="3.2"/>
      <path d="M97 55.6c14.6 2 29.6 2 44.2 0l.6 9.6c-15 2.2-30.4 2.2-45.4 0z" fill="#ffe08a" stroke-width="2.6"/>
      <path d="M78 70c-2-4.4 9-8 41-8s43 3.6 41 8c-2 4.4-18 7-41 7s-39-2.6-41-7z" fill="url(#${p}cartola)" stroke-width="3.2"/>
      <path d="M104 44c-.4 4-.6 7.6-.6 10.6" stroke="#e3ad48" stroke-width="3.4" fill="none"/>
    </g>
  </g>`;
}
