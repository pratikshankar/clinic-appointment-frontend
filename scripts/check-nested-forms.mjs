/**
 * Guard against nested <form> elements.
 *
 * Nested forms are invalid HTML. React will happily render them, but the browser
 * resolves an inner submit button against the *outer* form — so a "Search"
 * button inside an embedded component submits the page's main form instead.
 * That is exactly the bug that made the patient picker unusable inside the
 * booking screen, and it produces no error message of any kind.
 *
 * Run: npm run check:forms
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;

/** Every .jsx file under src/. */
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.jsx') ? [full] : [];
  });
}

const files = walk(SRC);

/**
 * Strip comments before scanning.
 *
 * Without this the checker flags its own documentation: a comment explaining
 * "this is deliberately not a <form>" contains the very pattern being searched
 * for. Comments are where the *reason* lives, so they must not be evidence.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments, including JSX {/* ... */}
    .replace(/^\s*\/\/.*$/gm, ''); // whole-line // comments
}

// A real element, not a mention in a comment.
const FORM_ELEMENT = /<form[\s>]/;

const rendersForm = new Map(); // component name -> file
const filesWithForm = [];

for (const file of files) {
  const text = stripComments(readFileSync(file, 'utf8'));
  if (!FORM_ELEMENT.test(text)) continue;
  filesWithForm.push(file);
  for (const match of text.matchAll(/export (?:default )?function (\w+)/g)) {
    rendersForm.set(match[1], file);
  }
}

const problems = [];
for (const file of filesWithForm) {
  const text = stripComments(readFileSync(file, 'utf8'));
  for (const [name, origin] of rendersForm) {
    if (origin === file) continue;
    if (new RegExp(`<${name}[\\s/>]`).test(text)) {
      problems.push({ host: file, name, origin });
    }
  }
}

if (problems.length > 0) {
  console.error('Nested <form> elements found:\n');
  for (const { host, name, origin } of problems) {
    console.error(
      `  ${relative(SRC, host)} renders <${name}> (${relative(SRC, origin)}), ` +
        'and both contain a <form>.'
    );
  }
  console.error(
    '\nA nested form makes the inner submit button submit the OUTER form.\n' +
      'Use a <div> with an onClick handler and explicit Enter handling instead.'
  );
  process.exit(1);
}

console.log(`No nested forms. Checked ${files.length} files, ${filesWithForm.length} with a form.`);
