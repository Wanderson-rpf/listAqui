/**
 * Gera os PNGs do PWA a partir dos SVGs em public/icons/.
 *
 * Os SVGs sao a fonte de verdade; os PNGs sao artefatos, mas ficam
 * versionados porque o build nao os gera - o manifest aponta direto para
 * eles e o GitHub Pages so serve arquivo pronto.
 *
 * Uso (sharp nao e dependencia do projeto, so desta ferramenta):
 *   npm i -D sharp && node gerar-icones.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ORIGEM = 'public/icons';

/** Cada PNG que o manifest.webmanifest e o index.html esperam encontrar. */
const ALVOS = [
  { svg: 'icone.svg', saida: 'public/icons/icon-192.png', tamanho: 192 },
  { svg: 'icone.svg', saida: 'public/icons/icon-512.png', tamanho: 512 },
  { svg: 'icone-maskable.svg', saida: 'public/icons/icon-maskable-192.png', tamanho: 192 },
  { svg: 'icone-maskable.svg', saida: 'public/icons/icon-maskable-512.png', tamanho: 512 },
  { svg: 'icone.svg', saida: 'public/favicon.png', tamanho: 96 },
];

await mkdir(ORIGEM, { recursive: true });

for (const { svg, saida, tamanho } of ALVOS) {
  const fonte = await readFile(`${ORIGEM}/${svg}`);

  const png = await sharp(fonte, { density: 384 })
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(saida, png);
  console.log(`  ${saida} (${tamanho}x${tamanho}, ${(png.length / 1024).toFixed(1)} kB)`);
}

console.log('\nPronto.');
