// O Tio Patinhas do app: o pato mais rico do mundo, de cartola, pincenê, costeletas brancas e casaco vermelho.
// Desenho em SVG no traço clássico dos desenhos animados, com três humores para os conselhos: normal, feliz e alerta.

const TINTA = '#1f1a17';
const PENA = '#ffffff';
const PENA_SOMBRA = '#e3e1db';
const BICO = '#f7a823';
const BICO_SOMBRA = '#dc7f12';
const BOCA_DENTRO = '#7a2418';
const LINGUA = '#e8605a';
const CASACO = '#c8302c';
const CASACO_SOMBRA = '#9b2020';
const OURO = '#e8b84a';
const CARTOLA = '#26232b';
const CARTOLA_LUZ = '#45414d';

// Olhos de pato da Disney: dois ovais altos encostados, logo acima do bico.
const OLHOS = {
  // Olhar esperto, de lado, com a pálpebra de cima um pouco baixa.
  normal: `
    <g stroke="${TINTA}" stroke-width="2.6">
      <path d="M86 84c-8.5 0-13 9-13 19s4.5 18 12 18c7 0 10.5-8 10.5-18S93 84 86 84z" fill="${PENA}"/>
      <path d="M107 82c-9.5 0-14 9.5-14 21s5 20 13.5 20 14-9 14-20-4.5-21-13.5-21z" fill="${PENA}"/>
    </g>
    <ellipse cx="80.5" cy="106" rx="4" ry="6.6" fill="${TINTA}"/><ellipse cx="99.5" cy="106" rx="4.6" ry="7.2" fill="${TINTA}"/>
    <circle cx="81.6" cy="103.4" r="1.4" fill="#fff"/><circle cx="100.8" cy="103" r="1.6" fill="#fff"/>
    <path d="M73.6 97c2-7 7-10.6 12.4-10.6S95 90 96 97c-6.6-2.4-15.6-2.4-22.4 0zM93.5 96c1.6-7.6 7.2-11.6 13.5-11.6s11.6 4.4 12.6 12c-7.6-2.8-18.6-3-26.1-.4z" fill="${PENA_SOMBRA}"/>
    <path d="M73.6 97c6.8-2.4 15.8-2.4 22.4 0M93.5 96c7.5-2.6 18.5-2.4 26.1.4" stroke="${TINTA}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  // Sorrindo de olhos fechados, satisfeito com as economias.
  feliz: `
    <g stroke="${TINTA}" stroke-width="2.6">
      <path d="M86 84c-8.5 0-13 9-13 19s4.5 18 12 18c7 0 10.5-8 10.5-18S93 84 86 84z" fill="${PENA}"/>
      <path d="M107 82c-9.5 0-14 9.5-14 21s5 20 13.5 20 14-9 14-20-4.5-21-13.5-21z" fill="${PENA}"/>
    </g>
    <path d="M76.5 106c2.6-6 12-6 15 0M97 105c3-6.6 14-6.6 17.4 0" stroke="${TINTA}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  // Olhos arregalados, pupilas pequenas e sobrancelhas franzidas: alguém está gastando demais!
  alerta: `
    <g stroke="${TINTA}" stroke-width="2.6">
      <path d="M86 82c-9 0-14 10-14 21s5 19 13 19c7.6 0 11.4-8.6 11.4-19S93.6 82 86 82z" fill="${PENA}"/>
      <path d="M107 80c-10 0-15 10.6-15 23s5.4 21 14.4 21 15-9.6 15-21-5-23-14.4-23z" fill="${PENA}"/>
    </g>
    <circle cx="84" cy="104" r="3.4" fill="${TINTA}"/><circle cx="105" cy="104" r="3.8" fill="${TINTA}"/>
    <path d="M72 90c7-.4 13-3 18-8.4M120 88c-7 .4-13-2-18-7.4" stroke="${TINTA}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
};

// Bico de perfil, apontando para a esquerda, com a ponta virada para cima.
const BOCA = {
  normal: `
    <path d="M110 128c-18 4-42 4-58 1 6 9 18 14 34 14 12 0 21-6 24-15z" fill="${BICO_SOMBRA}" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M114 114c-16-3-42 1-68-1-8-.6-13-3-16-1.4-3 1.6-1 6 3 9 9 6.4 26 9.4 44 9.4 15 0 28-1.4 37-4z" fill="${BICO}" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M44 122c14 3.4 36 4 62 1.4" stroke="${BICO_SOMBRA}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M36 114.6c1.6.6 3.2.6 4.6.2" stroke="${TINTA}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  feliz: `
    <path d="M112 125c-18 5-44 6-62 3 5 14 19 22 36 22 15 0 24-10 26-25z" fill="${BOCA_DENTRO}" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M62 141c7-6 23-7 34-2-4 7-11 10-19 10-7 0-12-3-15-8z" fill="${LINGUA}"/>
    <path d="M50 128c5 14 19 22 36 22 15 0 24-10 26-25" fill="none" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M114 113c-16-3-42 0-68-3-8-1-13-4-16-2.4-3 1.6-1 6 3 9.4 9 6.6 26 10 44 10 15 0 28-2 37-5z" fill="${BICO}" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M36 111.6c1.6.6 3.2.6 4.6.2" stroke="${TINTA}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  alerta: `
    <path d="M110 129c-18 3-40 4-56 2 4 5 16 8 30 8 12 0 21-4 26-10z" fill="${BICO_SOMBRA}" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M114 115c-16-2-42 2-68 1-8-.4-13-2.4-16-.8-3 1.6-1 5.6 3 8.4 9 6 26 8.4 44 8 15-.4 28-2 37-4.6z" fill="${BICO}" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M44 124c14 2.4 36 2.6 62 .4" stroke="${BICO_SOMBRA}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M36 116.4c1.6.4 3.2.4 4.6 0" stroke="${TINTA}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
};

/** SVG do mascote. `humor`: normal | feliz | alerta. */
export function mascote({ humor = 'normal', titulo = 'Tio Patinhas' } = {}) {
  const h = OLHOS[humor] ? humor : 'normal';
  return `<svg class="mascote" viewBox="14 18 172 183" role="img" aria-label="${titulo}" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${TINTA}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 201c2-26 18-42 44-48l30-4 34 3c24 6 38 22 40 49z" fill="${CASACO}"/>
    <path d="M138 152c18 7 28 22 30 49h-20c0-20-4-36-10-49z" fill="${CASACO_SOMBRA}" stroke="none"/>
    <path d="M78 151l22 50 22-50" fill="#f6f3ea"/>
    <path d="M100 160l-12-8.6-3 13.6zM100 160l12-8.6 3 13.6z" fill="${CARTOLA}"/>
    <path d="M70 152c-4 14-4 30 0 49M130 152c4 14 4 30 0 49" fill="none" stroke="${OURO}" stroke-width="4"/>
    <path d="M70 152c-4 14-4 30 0 49M130 152c4 14 4 30 0 49" fill="none" stroke-width="1.6"/>
    <path d="M62 150c6 8 12 22 16 36l6-34zM138 150c-6 8-12 22-16 36l-6-34z" fill="${CASACO_SOMBRA}"/>
  </g>
  <circle cx="132" cy="178" r="3.2" fill="${OURO}" stroke="${TINTA}" stroke-width="1.6"/><circle cx="134" cy="192" r="3.2" fill="${OURO}" stroke="${TINTA}" stroke-width="1.6"/>
  <g stroke="${TINTA}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M86 156c-20-3-34-17-36-36-2-22 12-44 40-48 30-4 52 14 54 40 2 24-14 42-38 44z" fill="${PENA}"/>
    <path d="M128 92c10 8 14 22 11 36-3 12-12 21-24 25 10-8 16-22 15-36 0-9-1-17-2-25z" fill="${PENA_SOMBRA}" stroke="none"/>
    <path d="M114 122c10 5 22 4 32-3l-4 8c7 1 14-1 20-5l-5 9c4 1.6 8 1.6 12 .4-5 7-14 10-23 9l5 7c-10 2-20-1-27-7-6 1-11-2-13-7-2-4 0-8 3-11.4z" fill="${PENA}"/>
    <path d="M58 132c-6 3-13 3-19 0l4 6c-5 1-10 0-14-2 5 6 12 9 19 8l-4 5c8 1 16-2 21-7z" fill="${PENA}"/>
  </g>
  <g transform="translate(0 -4)">${OLHOS[h]}</g>
  ${BOCA[h]}
  <g fill="none" stroke="${OURO}" stroke-width="2.4" stroke-linecap="round">
    <ellipse cx="84" cy="110" rx="7.4" ry="6.4" fill="rgba(255,255,255,.22)"/><ellipse cx="103.5" cy="110" rx="8.4" ry="7" fill="rgba(255,255,255,.22)"/>
    <path d="M91.4 108.6c1.2-1.6 2.8-1.6 4 0"/>
    <path d="M111.8 111c7 10 6 26-2 44" stroke-width="1.4"/>
  </g>
  <g transform="translate(2 -7) rotate(9 104 72)" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round">
    <path d="M74 70l-3.4-37c-.4-4 63.2-4 63.2 0l-3.4 37z" fill="${CARTOLA}"/>
    <path d="M73 58h58l-1 12H74z" fill="${CASACO}"/>
    <path d="M44 72c0-6 26-10 60-10s60 4 60 10-26 7-60 7-60-1-60-7z" fill="${CARTOLA}"/>
    <path d="M81 39l1.8 16" stroke="${CARTOLA_LUZ}" stroke-width="5" stroke-linecap="round"/>
  </g>
</svg>`;
}
