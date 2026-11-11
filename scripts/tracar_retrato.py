# Traça o desenho da logo (scripts/retrato.png, traço preto em fundo branco) em dois caminhos SVG,
# as linhas e a silhueta preenchida, e grava scripts/retrato.mjs. Depois: node scripts/icones.mjs
# Uso: pip install potracer numpy pillow && python3 scripts/tracar_retrato.py
import sys, numpy as np, potrace
from PIL import Image, ImageFilter, ImageDraw
src = sys.argv[1] if len(sys.argv) > 1 else 'scripts/retrato.png'
saida = sys.argv[2] if len(sys.argv) > 2 else 'scripts/retrato.mjs'
ESC = 4
im = Image.open(src).convert('L')
a0 = np.array(im)
ys, xs = np.where(a0 < 200)
x0, y0, x1, y1 = xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5
im = im.crop((x0, y0, x1, y1))
W, H = im.size
im = im.resize((W * ESC, H * ESC), Image.LANCZOS).filter(ImageFilter.GaussianBlur(ESC * 0.35))
claro = np.array(im) >= 140

def caminho(bitmap_claro, **op):
    plist = potrace.Bitmap(bitmap_claro).trace(**op)
    f = lambda v: f'{v / ESC:.1f}'.rstrip('0').rstrip('.')
    d = []
    for c in plist:
        d.append(f'M{f(c.start_point.x)} {f(c.start_point.y)}')
        for s in c.segments:
            if s.is_corner: d.append(f'L{f(s.c.x)} {f(s.c.y)}L{f(s.end_point.x)} {f(s.end_point.y)}')
            else: d.append(f'C{f(s.c1.x)} {f(s.c1.y)} {f(s.c2.x)} {f(s.c2.y)} {f(s.end_point.x)} {f(s.end_point.y)}')
        d.append('Z')
    return ''.join(d).replace(' -', '-')

linhas = caminho(claro, turdsize=6 * ESC, alphamax=1.1, opticurve=True, opttolerance=0.4)

# Silhueta: fecha as frestas engrossando as linhas, enche por fora e desfaz o engrossamento.
K = 17
b = Image.fromarray(np.where(claro, 255, 0).astype('uint8')).filter(ImageFilter.MinFilter(K))
ImageDraw.floodfill(b, (0, 0), 128)
dentro = Image.fromarray(np.where(np.array(b) == 128, 0, 255).astype('uint8')).filter(ImageFilter.MinFilter(K - 4))
dentro = dentro.filter(ImageFilter.GaussianBlur(ESC))
dm = np.array(dentro) >= 128
silhueta = caminho(~dm, turdsize=200 * ESC, alphamax=1.3, opticurve=True, opttolerance=0.6)

# Menor círculo que contém a silhueta (busca em grade), para encaixar na moeda.
py, px = np.where(dm[::ESC, ::ESC]); pts = np.stack([px, py], 1).astype(float)
melhor = None
for cx in np.arange(W * .3, W * .7, 1):
    for cy in np.arange(H * .3, H * .7, 1):
        r = np.sqrt(((pts - (cx, cy)) ** 2).sum(1)).max()
        if melhor is None or r < melhor[2]: melhor = (cx, cy, r)
cx, cy, r = melhor
open(saida, 'w').write(
f'''// Retrato da logo, traçado do desenho em scripts/retrato.png (python3 scripts/tracar_retrato.py).
// Coordenadas em pixels do desenho; CENTRO e RAIO dão o menor círculo que contém a silhueta.
export const CENTRO = [{cx:.1f}, {cy:.1f}];
export const RAIO = {r:.1f};
export const SILHUETA = '{silhueta}';
export const LINHAS = '{linhas}';
''')
print('quadro', W, H, 'círculo', round(cx, 1), round(cy, 1), round(r, 1), 'tamanhos', len(silhueta), len(linhas))
