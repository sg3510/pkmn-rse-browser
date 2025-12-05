#!/usr/bin/env node
/**
 * Fix menu-icons.png spacing
 *
 * Detects individual icons in the sprite sheet and repacks them
 * into a proper 50x250 grid (2 columns × 10 rows × 25px icons).
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(__dirname, '../public/img/menu-icons.png');
const OUTPUT_PATH = INPUT_PATH; // Overwrite original

const ICON_SIZE = 25;
const COLS = 2;
const ROWS = 10;
const OUTPUT_WIDTH = COLS * ICON_SIZE;   // 50
const OUTPUT_HEIGHT = ROWS * ICON_SIZE;  // 250

async function findContentRows(pixels, width, height, colStart, colEnd) {
  /**
   * Find rows that have content (non-transparent pixels) in a column region.
   * Returns array of { start, end } for each content block.
   */
  const blocks = [];
  let inContent = false;
  let blockStart = 0;

  for (let y = 0; y < height; y++) {
    let hasContent = false;

    for (let x = colStart; x < colEnd; x++) {
      const idx = (y * width + x) * 4;
      const alpha = pixels[idx + 3];
      if (alpha > 10) {
        hasContent = true;
        break;
      }
    }

    if (hasContent && !inContent) {
      // Start of new content block
      blockStart = y;
      inContent = true;
    } else if (!hasContent && inContent) {
      // End of content block
      blocks.push({ start: blockStart, end: y });
      inContent = false;
    }
  }

  // Handle content that extends to bottom
  if (inContent) {
    blocks.push({ start: blockStart, end: height });
  }

  return blocks;
}

function findIconBounds(pixels, width, startY, endY, colStart, colEnd) {
  /**
   * Find the tight bounding box of non-transparent pixels in a region.
   */
  let minX = colEnd, maxX = colStart;
  let minY = endY, maxY = startY;

  for (let y = startY; y < endY; y++) {
    for (let x = colStart; x < colEnd; x++) {
      const idx = (y * width + x) * 4;
      const alpha = pixels[idx + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return null;
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  console.log(`Loading ${INPUT_PATH}`);

  const image = sharp(INPUT_PATH);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  console.log(`Original size: ${width}×${height}`);

  // Get raw pixel data
  const { data: pixels } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  const colWidth = Math.floor(width / COLS);
  const icons = [];

  // Find icons in each column
  for (let col = 0; col < COLS; col++) {
    const colStart = col * colWidth;
    const colEnd = (col + 1) * colWidth;

    console.log(`\nScanning column ${col} (x: ${colStart}-${colEnd})`);

    // Find content blocks in this column
    const blocks = await findContentRows(pixels, width, height, colStart, colEnd);

    console.log(`  Found ${blocks.length} content blocks`);

    for (const block of blocks) {
      const bounds = findIconBounds(pixels, width, block.start, block.end, colStart, colEnd);
      if (bounds) {
        icons.push({ col, bounds });
        console.log(`  Icon at y=${block.start}-${block.end}: bounds (${bounds.x},${bounds.y}) ${bounds.width}×${bounds.height}`);
      }
    }
  }

  console.log(`\nTotal icons found: ${icons.length}`);

  // Separate by column
  const col0Icons = icons.filter(i => i.col === 0).map(i => i.bounds);
  const col1Icons = icons.filter(i => i.col === 1).map(i => i.bounds);

  console.log(`Column 0: ${col0Icons.length} icons`);
  console.log(`Column 1: ${col1Icons.length} icons`);

  // Create compositing operations
  const composites = [];

  for (let row = 0; row < ROWS; row++) {
    // Column 0
    if (row < col0Icons.length) {
      const bounds = col0Icons[row];
      const destX = Math.floor((ICON_SIZE - bounds.width) / 2);
      const destY = row * ICON_SIZE + Math.floor((ICON_SIZE - bounds.height) / 2);

      composites.push({
        input: await sharp(INPUT_PATH)
          .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
          .toBuffer(),
        left: destX,
        top: destY,
      });
    }

    // Column 1
    if (row < col1Icons.length) {
      const bounds = col1Icons[row];
      const destX = ICON_SIZE + Math.floor((ICON_SIZE - bounds.width) / 2);
      const destY = row * ICON_SIZE + Math.floor((ICON_SIZE - bounds.height) / 2);

      composites.push({
        input: await sharp(INPUT_PATH)
          .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
          .toBuffer(),
        left: destX,
        top: destY,
      });
    }
  }

  // Create output image
  console.log(`\nCreating output image ${OUTPUT_WIDTH}×${OUTPUT_HEIGHT}`);

  await sharp({
    create: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(OUTPUT_PATH + '.new.png');

  // Replace original
  const fs = await import('fs/promises');
  await fs.rename(OUTPUT_PATH + '.new.png', OUTPUT_PATH);

  console.log(`Saved to ${OUTPUT_PATH}`);
  console.log('Done!');
}

main().catch(console.error);
