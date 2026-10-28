const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const { dependencies } = require('../package.json');

// SOURCEMAP=app (default): maps embed only this package's sources; full: also bundled libraries; none: no maps.
const SOURCEMAP = process.env.SOURCEMAP ?? 'app';
if (!['app', 'full', 'none'].includes(SOURCEMAP)) {
  console.error(`Invalid SOURCEMAP value "${SOURCEMAP}" (expected app, full or none)`);
  process.exit(1);
}

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  tsconfig: 'tsconfig.json',
  sourcemap: SOURCEMAP !== 'none',
  // Declared dependencies are installed by consumers; everything else (saml2-js and its tree) is inlined.
  external: Object.keys(dependencies).filter(name => !name.startsWith('@types/')),
};

const stripLibrarySources = mapFile => {
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  map.sourcesContent = map.sourcesContent.map((content, i) => map.sources[i].includes('node_modules/') ? null : content);
  fs.writeFileSync(mapFile, JSON.stringify(map));
};

(async () => {
  fs.rmSync('dist', { recursive: true, force: true });

  execSync('tsc -p tsconfig.json --noEmit', { stdio: 'inherit' });

  execSync('dts-bundle-generator --no-check -o dist/types/index.d.ts src/index.ts', { stdio: 'inherit' });

  // CommonJS only: see "Why CommonJS only" in README.md.
  await esbuild.build({ ...common, format: 'cjs', outdir: 'dist/cjs' });

  // import.meta is undefined once a downstream bundler re-bundles this file to CommonJS.
  if (fs.readFileSync('dist/cjs/index.js', 'utf8').includes('import.meta')) {
    throw new Error('dist/cjs/index.js contains import.meta, which breaks consumers that bundle to CommonJS');
  }

  if (SOURCEMAP === 'app') {
    stripLibrarySources('dist/cjs/index.js.map');
  }
})().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});