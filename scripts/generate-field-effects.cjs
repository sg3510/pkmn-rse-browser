#!/usr/bin/env node
/**
 * Generate field effect metadata from pokeemerald C source.
 * 
 * Parses:
 *   - public/pokeemerald/src/data/field_effects/field_effect_object_template_pointers.h
 *   - public/pokeemerald/src/data/field_effects/field_effect_objects.h
 *   - public/pokeemerald/src/data/object_events/object_event_graphics.h
 * 
 * Outputs:
 *   - src/data/fieldEffects.gen.ts
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POINTERS_PATH = path.join(ROOT, 'public/pokeemerald/src/data/field_effects/field_effect_object_template_pointers.h');
const OBJECTS_PATH = path.join(ROOT, 'public/pokeemerald/src/data/field_effects/field_effect_objects.h');
const GRAPHICS_PATH = path.join(ROOT, 'public/pokeemerald/src/data/object_events/object_event_graphics.h');
const OUTPUT_PATH = path.join(ROOT, 'src/data/fieldEffects.gen.ts');

function parsePointers(source) {
    const map = new Map();
    const regex = /\[(FLDEFFOBJ_[A-Z0-9_]+)\]\s*=\s*&?(gFieldEffectObjectTemplate_[A-Za-z0-9_]+)/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        map.set(match[1], match[2]);
    }
    return map;
}

function parseAnimCmds(source) {
    const anims = new Map();
    // Match all static animation command arrays:
    // e.g. sAnim_TallGrass, sSandFootprintsAnim_South, sBikeTireTracksAnim_NECornerTurn
    const regex = /static const union AnimCmd ([A-Za-z0-9_]+)\[\]\s*=\s*\{([\s\S]*?)\};/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        const name = match[1];
        const body = match[2];
        const frames = [];
        const frameRegex = /ANIMCMD_FRAME\((\d+),\s*(\d+)(?:,\s*([^)]+))?\)/g;
        let frameMatch;
        while ((frameMatch = frameRegex.exec(body)) !== null) {
            const options = frameMatch[3] || '';
            frames.push({
                frame: parseInt(frameMatch[1]),
                duration: parseInt(frameMatch[2]),
                hFlip: /\.hFlip\s*=\s*TRUE/.test(options),
                vFlip: /\.vFlip\s*=\s*TRUE/.test(options),
            });
        }
        anims.set(name, frames);
    }
    return anims;
}

function parseTemplates(source) {
    const templates = new Map();
    // Match const struct SpriteTemplate Name = { ... };
    const regex = /const struct SpriteTemplate (gFieldEffectObjectTemplate_[A-Za-z0-9_]+)\s*=\s*\{([\s\S]*?)\};/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        const name = match[1];
        const body = match[2];
        
        const animsMatch = body.match(/\.anims\s*=\s*([A-Za-z0-9_]+)/);
        const imagesMatch = body.match(/\.images\s*=\s*([A-Za-z0-9_]+)/);
        const oamMatch = body.match(/\.oam\s*=\s*&?([A-Za-z0-9_]+)/);

        templates.set(name, {
            animsTable: animsMatch ? animsMatch[1] : null,
            imagesTable: imagesMatch ? imagesMatch[1] : null,
            oam: oamMatch ? oamMatch[1] : null
        });
    }
    return templates;
}

function parseAnimTables(source) {
    const tables = new Map();
    const regex = /static const union AnimCmd \*const ([A-Za-z0-9_]+)\[\]\s*=\s*\{([\s\S]*?)\};/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        const name = match[1];
        const body = match[2]
            .replace(/\/\/.*$/gm, '') // strip line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // strip block comments
        const animNames = body
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0 && s !== 'NULL');
        tables.set(name, animNames);
    }
    return tables;
}

function parsePicTables(source) {
    const tables = new Map();
    const regex = /static const struct SpriteFrameImage ([A-Za-z0-9_]+)\[\]\s*=\s*\{([\s\S]*?)\};/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        const name = match[1];
        const body = match[2];
        // Match overworld_frame(gFieldEffectObjectPic_Name, 2, 2, 0)
        const frameRegex = /overworld_frame\(([A-Za-z0-9_]+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g;
        let frameMatch;
        let picName = null;
        let widthTiles = 2;
        let heightTiles = 2;
        if ((frameMatch = frameRegex.exec(body)) !== null) {
            picName = frameMatch[1];
            widthTiles = parseInt(frameMatch[2]);
            heightTiles = parseInt(frameMatch[3]);
        }
        tables.set(name, { picName, width: widthTiles * 8, height: heightTiles * 8 });
    }
    return tables;
}

function parseGraphics(source) {
    const graphics = new Map();
    // Match const u32 gFieldEffectObjectPic_Name[] = INCBIN_U32("graphics/field_effects/pics/name.4bpp");
    const regex = /const u32 ([A-Za-z0-9_]+)\[\]\s*=\s*INCBIN_U32\("([^"]+)"\);/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        graphics.set(match[1], match[2].replace('.4bpp', '.png'));
    }
    return graphics;
}

function main() {
    const pointersSource = fs.readFileSync(POINTERS_PATH, 'utf-8');
    const objectsSource = fs.readFileSync(OBJECTS_PATH, 'utf-8');
    const graphicsSource = fs.readFileSync(GRAPHICS_PATH, 'utf-8');

    const pointerMap = parsePointers(pointersSource);
    const animCmds = parseAnimCmds(objectsSource);
    const animTables = parseAnimTables(objectsSource);
    const picTables = parsePicTables(objectsSource);
    const templates = parseTemplates(objectsSource);
    const graphics = parseGraphics(graphicsSource);

    const registry = {};

    for (const [id, templateName] of pointerMap.entries()) {
        const template = templates.get(templateName);
        if (!template) continue;

        const picTable = picTables.get(template.imagesTable);
        const animTable = animTables.get(template.animsTable);
        
        if (!picTable || !animTable) continue;

        const imagePath = graphics.get(picTable.picName);
        const animation = animCmds.get(animTable[0]); // Use first animation for now

        if (!imagePath || !animation) continue;

        const effectKey = id.replace('FLDEFFOBJ_', '');
        registry[effectKey] = {
            id,
            imagePath: `/pokeemerald/${imagePath}`,
            width: picTable.width,
            height: picTable.height,
            animation: animation
        };
    }

    const output = `// ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from pokeemerald field effect C source.
// Run 'npm run generate:field-effects' to regenerate

export interface FieldEffectAnimationFrame {
  frame: number;
  duration: number;
  hFlip?: boolean;
  vFlip?: boolean;
}

export interface FieldEffectMetadata {
  id: string;
  imagePath: string;
  width: number;
  height: number;
  animation: FieldEffectAnimationFrame[];
}

export const FIELD_EFFECT_REGISTRY: Record<string, FieldEffectMetadata> = ${JSON.stringify(registry, null, 2)};
`;

    fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
    console.log(`Generated ${OUTPUT_PATH} with ${Object.keys(registry).length} effects.`);
}

main();
