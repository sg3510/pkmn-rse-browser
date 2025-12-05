/**
 * Gen3 Character Encoding/Decoding
 *
 * Pokemon Gen3 games use a custom character encoding.
 * This module provides encode/decode functions for player names and text.
 *
 * Reference: https://bulbapedia.bulbagarden.net/wiki/Character_encoding_(Generation_III)
 */

// Gen3 character table (index → character)
// 0xFF is the string terminator
const GEN3_CHARSET: string[] = [
  // 0x00-0x0F: Special/space
  ' ', 'À', 'Á', 'Â', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', ' ', 'Î', 'Ï', 'Ò', 'Ó', 'Ô',
  // 0x10-0x1F
  'Œ', 'Ù', 'Ú', 'Û', 'Ñ', 'ß', 'à', 'á', ' ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', ' ',
  // 0x20-0x2F
  'î', 'ï', 'ò', 'ó', 'ô', 'œ', 'ù', 'ú', 'û', 'ñ', 'º', 'ª', '·', '&', '+', ' ',
  // 0x30-0x3F
  ' ', ' ', ' ', ' ', 'Lv', '=', ';', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
  // 0x40-0x4F
  ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
  // 0x50-0x5F
  '▯', '¿', '¡', 'PK', 'MN', 'PO', 'Ké', '♂', '♀', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
  // 0x60-0x6F
  ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'Í', '%', '(', ')', ' ', ' ',
  // 0x70-0x7F
  ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'â', ' ', ' ', ' ', ' ', ' ', ' ', 'í',
  // 0x80-0x8F
  ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '⬆', '⬇', '⬅', '➡', '*', '*', '*',
  // 0x90-0x9F
  '*', '*', '*', '*', 'ᵉ', '<', '>', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
  // 0xA0-0xAF
  ' ', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '!', '?', '.', '-', '・',
  // 0xB0-0xBF
  '…', '\u201C', '\u201D', '\u2018', '\u2019', '♂', '♀', '$', ',', '×', '/', 'A', 'B', 'C', 'D', 'E',
  // 0xC0-0xCF
  'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U',
  // 0xD0-0xDF
  'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
  // 0xE0-0xEF
  'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '▶',
  // 0xF0-0xFF
  ':', 'Ä', 'Ö', 'Ü', 'ä', 'ö', 'ü', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '',  // 0xFF = terminator (empty string)
];

// Build reverse lookup for encoding
const CHAR_TO_GEN3: Map<string, number> = new Map();
GEN3_CHARSET.forEach((char, index) => {
  if (char && char !== ' ' && !CHAR_TO_GEN3.has(char)) {
    CHAR_TO_GEN3.set(char, index);
  }
});

// Add space character explicitly (use 0x00)
CHAR_TO_GEN3.set(' ', 0x00);

/**
 * Decode a Gen3 encoded string from bytes
 * @param bytes - Uint8Array or ArrayBuffer containing Gen3 encoded text
 * @param maxLength - Maximum number of bytes to read (default 8 for player names)
 * @returns Decoded string
 */
export function decodeGen3String(bytes: Uint8Array | ArrayBuffer, maxLength: number = 8): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let result = '';

  for (let i = 0; i < Math.min(data.length, maxLength); i++) {
    const byte = data[i];

    // 0xFF is the string terminator
    if (byte === 0xFF) {
      break;
    }

    const char = GEN3_CHARSET[byte];
    result += char ?? '?';
  }

  return result;
}

/**
 * Encode a string to Gen3 format
 * @param str - String to encode
 * @param length - Fixed length of output (padded with 0xFF terminators)
 * @returns Uint8Array of Gen3 encoded bytes
 */
export function encodeGen3String(str: string, length: number = 8): Uint8Array {
  const result = new Uint8Array(length);
  result.fill(0xFF); // Fill with terminators

  let outIndex = 0;
  for (let i = 0; i < str.length && outIndex < length; i++) {
    const char = str[i];
    const code = CHAR_TO_GEN3.get(char);

    if (code !== undefined) {
      result[outIndex++] = code;
    } else {
      // Unknown character, use '?' placeholder
      result[outIndex++] = 0xAC; // '?'
    }
  }

  return result;
}

/**
 * Check if a byte is the Gen3 string terminator
 */
export function isTerminator(byte: number): boolean {
  return byte === 0xFF;
}
