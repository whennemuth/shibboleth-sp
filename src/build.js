const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  tsconfig: 'tsconfig.json',
  sourcemap: true,
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
})().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});