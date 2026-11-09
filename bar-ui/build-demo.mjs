// Builds demo.html: index.html with its stylesheets and the bundled modules inlined, so the demo opens straight
// from disk (file://) with no server. Images stay as files next to it in assets/.
//   npm install && npm run demo
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const js = (await build({ entryPoints: ['bar.js'], bundle: true, format: 'esm', minify: true, write: false, legalComments: 'none' })).outputFiles[0].text;

let out = html.replace(/<link rel="stylesheet" href="([\w.-]+\.css)">/g, (_, f) => `<style>\n${readFileSync(f, 'utf8')}</style>`);
out = out.replace('<script type="module" src="bar.js"></script>', () => `<script type="module">\n${js.replaceAll('</script', '<\\/script')}</script>`);
if (out.includes('src="bar.js"') || /href="[\w.-]+\.css"/.test(out)) throw new Error('demo.html still links a local file');
writeFileSync('demo.html', out);
console.log(`demo.html ${(out.length / 1024).toFixed(0)} KB`);
