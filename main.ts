// PIPIT ASHGATE — this repository's entry program for threejs-fps-02. Node 22 runs it with nothing
// installed; there is no build step. It stages the entry for the grader: the game/ and screenshots/
// beside this file are copied to the output directory (/output inside the grader's container, or
// MAKEFUN_OUTPUT_DIR outside it) and dossier.json — the summary the judge reads — is written there
// by the kit's vendored buildDossier.
//
// The caps handed to buildDossier are the scorer's own, kept here so an entry the scorer would
// refuse never leaves this machine: the text cap shapes the bytes, screenshots at most 4 and 256 KiB
// each, game/ at most 993 files and 48 MiB (game/ also sits inside the container's 1000-entry cap).
//
// Run it yourself:   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally:   node serve.ts   (the same static game/, at http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const stage = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shots = join(root, 'screenshots');

const scorerCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

mkdirSync(stage, { recursive: true });
cpSync(join(root, 'game'), join(stage, 'game'), { recursive: true });

const staged = join(stage, 'screenshots');
mkdirSync(staged, { recursive: true });
if (existsSync(shots)) cpSync(shots, staged, { recursive: true });

writeFileSync(join(stage, 'dossier.json'), buildDossier(stage, scorerCaps));
console.log('ashgate: staged game/, screenshots/ and dossier.json into ' + stage);
