#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { runCli } from './lib/consoleAnalyzer.mjs';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
