// O Tio Patinhas do app: um pato idoso e econômico, de cartola, óculos redondos dourados,
// casaco verde e gravata-borboleta. Desenho original (SVG) no estilo dos desenhos animados
// clássicos: contorno de tinta, cores chapadas com sombra e brilho.
// Três humores para os conselhos: normal, feliz e alerta.

const TINTA = '#1f1a17';
let instancia = 0;

// Olhos grandes e ovais, encostados um no outro, como nos patos de desenho.
const OLHO_E = 'M87.5 92c5.6 0 9.6 5.8 9.6 13s-4 13-9.6 13-9.6-5.8-9.6-13 4-13 9.6-13z';
const OLHO_D = 'M112.5 92c5.6 0 9.6 5.8 9.6 13s-4 13-9.6 13-9.6-5.8-9.6-13 4-13 9.6-13z';

function olhos(h, u) {
  const fundo = `<path d="${OLHO_E}" fill="#fff"/><path d="${OLHO_D}" fill="#fff"/>`;
  const contorno = `<g fill="none" stroke="${TINTA}" stroke-width="2"><path d="${OLHO_E}"/><path d="${OLHO_D}"/></g>`;
  if (h === 'feliz') {
    // Olhos fechados de tanto sorrir, bochechas para cima.
    return `
      <path d="M79.5 108c4.4-6 11.6-6 16 0M104.5 108c4.4-6 11.6-6 16 0" stroke="${TINTA}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M80.4 115c3.2 1.6 6.6 1.6 9.8 0M109.8 115c3.2 1.6 6.6 1.6 9.8 0" stroke="#ec9a95" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".75"/>`;
  }
  if (h === 'alerta') {
    // Arregalados, pupilas pequenas.
    return `${fundo}
      <ellipse cx="88.6" cy="105" rx="2.9" ry="4" fill="${TINTA}"/><ellipse cx="111.4" cy="105" rx="2.9" ry="4" fill="${TINTA}"/>
      <circle cx="89.5" cy="103.6" r="1.1" fill="#fff"/><circle cx="112.3" cy="103.6" r="1.1" fill="#fff"/>
      ${contorno}`;
  }
  // Normal: olhar sábio, de pálpebras meio baixas.
  return `${fundo}
    <ellipse cx="91.2" cy="108" rx="4.1" ry="5.8" fill="${TINTA}"/><ellipse cx="108.8" cy="108" rx="4.1" ry="5.8" fill="${TINTA}"/>
    <ellipse cx="92.6" cy="105.8" rx="1.4" ry="1.9" fill="#fff"/><ellipse cx="110.2" cy="105.8" rx="1.4" ry="1.9" fill="#fff"/>
    <path d="M77.9 101.6c.6-6 4.4-9.6 9.6-9.6s9 3.6 9.6 9.6c-5.4-2.4-13.8-2.4-19.2 0zM102.9 101.6c.6-6 4.4-9.6 9.6-9.6s9 3.6 9.6 9.6c-5.4-2.4-13.8-2.4-19.2 0z" fill="#ecebe6"/>
    ${contorno}
    <path d="M78.2 101.8c5.6-2.6 13-2.6 18.6 0M103.2 101.8c5.6-2.6 13-2.6 18.6 0" stroke="${TINTA}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
}

// Sobrancelhas de penas brancas, fartas.
const SOBRANCELHAS = {
  normal: 'M69 91c2-8.4 12.4-13 25-10 2.6.6 2.6 3.6.2 3.8-7.8-.4-13.6 1.2-17.6 4.2l1.6 1.8c-3.2.4-6.2.6-9.2.2zM131 91c-2 -8.4 -12.4 -13 -25 -10 -2.6 0.6 -2.6 3.6 -0.2 3.8 7.8 -0.4 13.6 1.2 17.6 4.2l-1.6 1.8c3.2 0.4 6.2 0.6 9.2 0.2z',
  feliz: 'M69 87c2.4-8 13-12 25.4-8.4 2.6.8 2.4 3.8-.2 3.8-7.8-.8-13.6.4-17.8 3.2l1.4 1.8c-3.2.2-6 .2-8.8-.4zM131 87c-2.4 -8 -13 -12 -25.4 -8.4 -2.6 0.8 -2.4 3.8 0.2 3.8 7.8 -0.8 13.6 0.4 17.8 3.2l-1.4 1.8c3.2 0.2 6 0.2 8.8 -0.4z',
  alerta: 'M69.4 94c3.6-7 12-13 22.6-16 2.6-.8 3.8 2 1.8 3.4-7.4 3.8-12.4 7.8-16.2 12.4l1.6 1.6c-3.4 0-6.6-.4-9.8-1.4zM130.6 94c-3.6 -7 -12 -13 -22.6 -16 -2.6 -0.8 -3.8 2 -1.8 3.4 7.4 3.8 12.4 7.8 16.2 12.4l-1.6 1.6c3.4 0 6.6 -0.4 9.8 -1.4z',
};

// Bico: o de cima, largo e arredondado; o de baixo muda com o humor.
const BICO_BAIXO = {
  normal: `<path d="M80 139c3 10 10.6 15 20 15s17-5 20-15z" fill="url(#U-bico2)"/>`,
  feliz: `<path d="M77 138c2 15 11.4 23 23 23s21-8 23-23z" fill="#7a2a24"/>
      <path d="M86 153.5c3.4-4.6 8.6-6.4 14-6.4s10.6 1.8 14 6.4c-3.6 4.6-8.4 7.4-14 7.4s-10.4-2.8-14-7.4z" fill="#e86f6a" stroke="none"/>
      <path d="M77 138c2 15 11.4 23 23 23s21-8 23-23" fill="none"/>
      <path d="M79.5 150c4.6 7.4 12 11 20.5 11s15.9-3.6 20.5-11c-4 9.4-11.4 14-20.5 14s-16.5-4.6-20.5-14z" fill="url(#U-bico2)"/>`,
  alerta: `<path d="M84 139c2 12 8.4 18 16 18s14-6 16-18z" fill="url(#U-bico2)"/>
      <path d="M92 146c2-1.4 5-2.2 8-2.2s6 .8 8 2.2c-1 4-4 6.4-8 6.4s-7-2.4-8-6.4z" fill="#7a2a24"/>`,
};

/** SVG do mascote. `humor`: normal | feliz | alerta. */
export function mascote({ humor = 'normal', titulo = 'Tio Patinhas' } = {}) {
  const h = SOBRANCELHAS[humor] ? humor : 'normal';
  const u = `tp${++instancia}`;
  return `<svg class="mascote" viewBox="14 6 172 195" role="img" aria-label="${titulo}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${u}casaco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c8a64"/><stop offset="1" stop-color="#0d5c43"/></linearGradient>
    <linearGradient id="${u}cartola" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3d47"/><stop offset=".55" stop-color="#25272f"/><stop offset="1" stop-color="#16171c"/></linearGradient>
    <linearGradient id="${u}ouro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#f0bd45"/><stop offset="1" stop-color="#c98d1c"/></linearGradient>
    <linearGradient id="${u}bico" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc35c"/><stop offset="1" stop-color="#f08f22"/></linearGradient>
    <linearGradient id="${u}bico2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9701a"/><stop offset="1" stop-color="#f59a2f"/></linearGradient>
    <linearGradient id="${u}pena" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1f0eb"/></linearGradient>
    <radialGradient id="${u}lente" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".0"/><stop offset="1" stop-color="#bfe3f2" stop-opacity=".28"/></radialGradient>
    <clipPath id="${u}cabeca"><path d="M100 60c28 0 49 19 49 50 0 15-5 27-13 36l6 3.6-8 1.6 3.6 5.8-9.2-1.8c-8 5-17.4 7.4-28.4 7.4s-20.4-2.4-28.4-7.4l-9.2 1.8 3.6-5.8-8-1.6 6-3.6c-8-9-13-21-13-36 0-31 21-50 49-50z"/></clipPath>
  </defs>

  <!-- Casaco, colarinho e gravata -->
  <g stroke="${TINTA}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">
    <path d="M28 201c2-24 17-39 42-44l30 6 30-6c25 5 40 20 42 44z" fill="url(#${u}casaco)"/>
    <path d="M100 163l-30-7c-7 13-8 27-6 45h17zM100 163l30-7c7 13 8 27 6 45h-17z" fill="#0b4d38"/>
    <path d="M100 163l-19 38h38z" fill="#f8f7f2"/>
    <path d="M100 162l-20-8-5 15 15 2zM100 162l20-8 5 15-15 2z" fill="#fff"/>
    <path d="M100 168l-15-9.6v16.4zM100 168l15-9.6v16.4z" fill="url(#${u}ouro)"/>
    <rect x="95.4" y="163.6" width="9.2" height="9" rx="3" fill="#f0bd45"/>
    <circle cx="100" cy="186" r="2.6" fill="url(#${u}ouro)" stroke-width="1.6"/>
    <circle cx="100" cy="196" r="2.6" fill="url(#${u}ouro)" stroke-width="1.6"/>
  </g>
  <path d="M120 182c8 6 17 7 25 3" stroke="#f0bd45" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray=".1 4.6"/>
  <circle cx="146.6" cy="184.4" r="4.4" fill="url(#${u}ouro)" stroke="${TINTA}" stroke-width="2"/>

  <!-- Cabeça, com sombra do lado direito -->
  <path d="M100 60c28 0 49 19 49 50 0 15-5 27-13 36l6 3.6-8 1.6 3.6 5.8-9.2-1.8c-8 5-17.4 7.4-28.4 7.4s-20.4-2.4-28.4-7.4l-9.2 1.8 3.6-5.8-8-1.6 6-3.6c-8-9-13-21-13-36 0-31 21-50 49-50z" fill="url(#${u}pena)"/>
  <g clip-path="url(#${u}cabeca)">
    <path d="M131 60c14 14 19 34 15 56-3 18-14 34-32 46l40 6 6-108z" fill="#e3e4e6"/>
    <path d="M58 150c10 10 24 15 42 15s32-5 42-15v20H58z" fill="#e6e6e3"/>
  </g>
  <path d="M100 60c28 0 49 19 49 50 0 15-5 27-13 36l6 3.6-8 1.6 3.6 5.8-9.2-1.8c-8 5-17.4 7.4-28.4 7.4s-20.4-2.4-28.4-7.4l-9.2 1.8 3.6-5.8-8-1.6 6-3.6c-8-9-13-21-13-36 0-31 21-50 49-50z" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>

  <!-- Olhos e sobrancelhas -->
  ${olhos(h, u)}
  <path d="${SOBRANCELHAS[h]}" fill="#e4e3de" stroke="${TINTA}" stroke-width="2.2" stroke-linejoin="round"/>

  <!-- Bico -->
  <g stroke="${TINTA}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">
    ${BICO_BAIXO[h].replace(/U-/g, u)}
    <path d="M100 119c-14 0-25 3-30.6 8.6-5.4 5.6-4 12.6 3 15.4 7 2.8 16.6 3.6 27.6 3.6s20.6-.8 27.6-3.6c7-2.8 8.4-9.8 3-15.4C125 122 114 119 100 119z" fill="url(#${u}bico)"/>
  </g>
  <path d="M80 126c5-2.4 12-3.6 20-3.6" stroke="#fff3d6" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/>
  <path d="M74 140.6c7 2.4 15.4 3.2 26 3.2s19-.8 26-3.2" stroke="#d27417" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>
  <path d="M93 128.6c.8-1.4 2.4-1.4 3.2 0M103.8 128.6c.8-1.4 2.4-1.4 3.2 0" stroke="${TINTA}" stroke-width="2.2" fill="none" stroke-linecap="round"/>

  <!-- Óculos redondos dourados -->
  <g fill="url(#${u}lente)" stroke="#b9861f" stroke-width="2.8" stroke-linecap="round">
    <circle cx="86" cy="105" r="15"/><circle cx="114" cy="105" r="15"/>
  </g>
  <g fill="none" stroke-linecap="round">
    <circle cx="86" cy="105" r="15" stroke="#f3cd6a" stroke-width="1" stroke-dasharray="14 80" transform="rotate(200 86 105)"/>
    <circle cx="114" cy="105" r="15" stroke="#f3cd6a" stroke-width="1" stroke-dasharray="14 80" transform="rotate(200 114 105)"/>
    <path d="M75.4 99.4c1-2.6 2.6-4.6 4.8-6M103.4 99.4c1-2.6 2.6-4.6 4.8-6" stroke="#fff" stroke-width="2" opacity=".9"/>
    <path d="M71.2 102.6L53 97.6M128.8 102.6L147 97.6" stroke="#b9861f" stroke-width="2.6"/>
  </g>

  <!-- Cartola inclinada -->
  <g transform="translate(0 -8) rotate(-9 100 66)" stroke="${TINTA}" stroke-width="2.8" stroke-linejoin="round">
    <path d="M68.5 66c1.5-14 2.2-28 2.8-41 .2-4.6 57.2-4.6 57.4 0 .6 13 1.3 27 2.8 41z" fill="url(#${u}cartola)"/>
    <path d="M70 51.6c19 2.6 41 2.6 60 0l.8 11.4c-20 3-41.6 3-61.6 0z" fill="url(#${u}ouro)"/>
    <path d="M70 51.6c19 2.6 41 2.6 60 0" fill="none" stroke-width="1.6" opacity=".5"/>
    <path d="M44 71c-3.4-5 12-10 56-10s59.4 5 56 10c-3 5-25 9-56 9s-53-4-56-9z" fill="url(#${u}cartola)"/>
    <path d="M71.3 25c0 3.4 25.6 5.4 28.7 5.4s28.7-2 28.7-5.4" fill="none" stroke-width="2"/>
    <path d="M79 33c-.4 6-.6 11-.6 15" stroke="#5b606e" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M58 70c10 3 26 4.6 42 4.6" stroke="#4b4f5c" stroke-width="2" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}
