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

  // A single rolled-up declaration file can be served to both import and require consumers.
  execSync('dts-bundle-generator --no-check -o dist/types/index.d.ts src/index.ts', { stdio: 'inherit' });
  fs.copyFileSync('dist/types/index.d.ts', 'dist/types/index.d.mts');

  await Promise.all([
    esbuild.build({ ...common, format: 'cjs', outdir: 'dist/cjs' }),
    esbuild.build({
      ...common,
      format: 'esm',
      outdir: 'dist/esm',
      outExtension: { '.js': '.mjs' },
      // Inlined CommonJS dependencies require() node builtins, which ESM does not provide.
      banner: { js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);" },
    }),
  ]);

  if (SOURCEMAP === 'app') {
    ['dist/cjs/index.js.map', 'dist/esm/index.mjs.map'].forEach(stripLibrarySources);
  }
})().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});