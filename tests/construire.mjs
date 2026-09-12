/**
 * Compile le script de verification en un bundle executable par Electron.
 * Les modules natifs et Electron restent externes ; les fichiers .sql sont
 * embarques comme texte, exactement comme le fait Vite avec `?raw`.
 */
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const sqlBrut = {
  name: 'sql-brut',
  setup(constructeur) {
    constructeur.onResolve({ filter: /\.sql\?raw$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.replace('?raw', '')),
      namespace: 'sql-brut'
    }))
    constructeur.onLoad({ filter: /.*/, namespace: 'sql-brut' }, async (args) => ({
      contents: `export default ${JSON.stringify(await readFile(args.path, 'utf-8'))}`,
      loader: 'js'
    }))
  }
}

await build({
  entryPoints: ['tests/verification.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'out-tests/verification.mjs',
  external: ['electron', 'better-sqlite3', 'qrcode', 'bcryptjs'],
  plugins: [sqlBrut],
  alias: { '@shared': resolve('src/shared'), '@main': resolve('src/main') },
  logLevel: 'info'
})
