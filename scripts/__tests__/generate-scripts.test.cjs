const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  parseIncFile,
  isAssemblerDirective,
  buildMapScriptHeader,
} = require('../generate-scripts.cjs');

test('isAssemblerDirective keeps script/string terminators and filters assembler control directives', () => {
  assert.equal(isAssemblerDirective('.ifdef FOO'), true);
  assert.equal(isAssemblerDirective('.endif'), true);
  assert.equal(isAssemblerDirective('.set BAR, 1'), true);
  assert.equal(isAssemblerDirective('.string "Test$"'), false);
  assert.equal(isAssemblerDirective('.byte 0'), false);
  assert.equal(isAssemblerDirective('.2byte 0'), false);
});

test('parseIncFile filters assembler directives inside script entities', () => {
  const content = [
    'TestScript::',
    '\t.ifdef TEST',
    '\tsetvar VAR_RESULT, 1',
    '\t.endif',
    '\treturn',
    '',
  ].join('\n');

  const parsed = parseIncFile(content);
  assert.ok(parsed.scripts.TestScript);
  assert.deepEqual(parsed.scripts.TestScript, [
    { cmd: 'setvar', args: ['VAR_RESULT', 1] },
    { cmd: 'return' },
  ]);
});

test('buildMapScriptHeader maps MAP_SCRIPT_ON_RETURN_TO_FIELD', () => {
  const header = buildMapScriptHeader([
    { type: 'MAP_SCRIPT_ON_TRANSITION', label: 'Map_OnTransition' },
    { type: 'MAP_SCRIPT_ON_RETURN_TO_FIELD', label: 'Map_OnReturnToField' },
  ]);

  assert.equal(header.onTransition, 'Map_OnTransition');
  assert.equal(header.onReturnToField, 'Map_OnReturnToField');
});

test('event_scripts.s includes Common_EventScript_LegendaryFlewAway label for shared generation', () => {
  const eventScriptsPath = path.join(
    __dirname,
    '..',
    '..',
    'public',
    'pokeemerald',
    'data',
    'event_scripts.s'
  );
  const content = fs.readFileSync(eventScriptsPath, 'utf8');
  const parsed = parseIncFile(content);
  const script = parsed.scripts.Common_EventScript_LegendaryFlewAway;

  assert.ok(Array.isArray(script), 'Common_EventScript_LegendaryFlewAway must be parsed as a script');
  assert.ok(script.some((cmd) => cmd.cmd === 'removeobject'));
  assert.ok(script.some((cmd) => cmd.cmd === 'msgbox'));
});

