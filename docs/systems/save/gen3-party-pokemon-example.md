---
title: Worked Example: Decoding/Encoding a Party Pokémon (R/S/E)
status: reference
last_verified: 2026-01-13
---

# Worked Example: Decoding/Encoding a Party Pokémon (R/S/E)

A practical walk-through of the 100-byte party structure: where EVs/IVs/moves live, how substructures are ordered/encrypted, and how to rebuild a valid entry. Offsets are hex, little-endian.

## Party Layout (100 bytes)

```
0x00  u32 personality
0x04  u32 otId (TID + SID)
0x08  10  nickname (Gen3 charset, 0xFF-terminated)
0x12  u8  language
0x13  u8  flags (isBadEgg/hasSpecies/isEgg/blockBoxRS)
0x14  7   otName (0xFF-terminated)
0x1B  u8  markings
0x1C  u16 checksum (of decrypted substructs)
0x1E  u16 padding
0x20  48  encrypted substructs (Growth/Attacks/EVs&Misc)
0x50  u32 status (sleep/burn/poison/etc.)
0x54  u8  level (cached)
0x55  u8  mail (0xFF = none)
0x56  u16 current HP
0x58  u16 max HP
0x5A  u16 attack
0x5C  u16 defense
0x5E  u16 speed
0x60  u16 spAttack
0x62  u16 spDefense
```

Party-specific fields (0x50–0x62) are cached battle stats; the boxed 80 bytes above must be consistent with them.

## Substructure Order & Encryption

1. Compute `key = personality ^ otId`.
2. Determine order: `orderIndex = personality % 24` → four-letter order from the table below (same as Bulbapedia/PKHeX):
   ```
   0:G A E M  1:G A M E  2:G E A M  3:G E M A  4:G M A E  5:G M E A
   6:A G E M  7:A G M E  8:A E G M  9:A E M G 10:A M G E 11:A M E G
   12:E G A M 13:E G M A 14:E A G M 15:E A M G 16:E M G A 17:E M A G
   18:M G A E 19:M G E A 20:M A G E 21:M A E G 22:M E G A 23:M E A G
   ```
3. Decrypt: take the 48-byte secure block as 12 words; for each `u32 word`, `word ^= key`.
4. Unscramble: split into four 12-byte substructs in the order above; label them G/A/E/M.

## Field Mapping Inside Substructs

- **G (Growth)**
  - 0x00 u16 `species`
  - 0x02 u16 `heldItem`
  - 0x04 u32 `experience`
  - 0x08 u8  `ppBonuses` (2 bits per move)
  - 0x09 u8  `friendship`
  - 0x0A u16 padding
- **A (Attacks)**
  - 0x00 u16 `moves[4]`
  - 0x08 u8  `pp[4]`
- **E (EVs & Contest)**
  - 0x00 u8 `hpEV`
  - 0x01 u8 `attackEV`
  - 0x02 u8 `defenseEV`
  - 0x03 u8 `speedEV`
  - 0x04 u8 `spAttackEV`
  - 0x05 u8 `spDefenseEV`
  - 0x06 u8 `cool`
  - 0x07 u8 `beauty`
  - 0x08 u8 `cute`
  - 0x09 u8 `smart`
  - 0x0A u8 `tough`
  - 0x0B u8 `sheen`
- **M (Misc)**
  - 0x00 u8  `pokerus`
  - 0x01 u8  `metLocation`
  - 0x02 u16 `metLevel(7) | metGame(4) | ball(4) | otGender(1)`
  - 0x04 u32 IV/ability/egg bitfield:
    - bits 0–4   hpIV
    - bits 5–9   attackIV
    - bits 10–14 defenseIV
    - bits 15–19 speedIV
    - bits 20–24 spAttackIV
    - bits 25–29 spDefenseIV
    - bit 30     isEgg
    - bit 31     abilityNum (0/1)
  - 0x08 u32 ribbon bitfield (contest ranks + champion/winning/victory/artist/effort/marine/land/sky/country/national/earth/world, then unused).

## Checksum Calculation

Checksum covers the decrypted 48-byte substruct region as 24 `u16` values:
```
sum = Σ u16_le[i] over 24 entries
checksum = sum & 0xFFFF
```
Stored at 0x1C. If it doesn’t match, games mark “Bad Egg”.

## Decoding Example (hypothetical numbers)

Suppose:
- `personality = 0x12345678`
- `otId = 0x11223344`
- Key = `0x12345678 ^ 0x11223344 = 0x0176653C`
- `orderIndex = 0x12345678 % 24 = 12` → order = `E G A M`

Steps:
1. Read the 48-byte secure block.
2. XOR each u32 with `0x0176653C`.
3. Split into four 12-byte chunks, assign: chunk0=E, chunk1=G, chunk2=A, chunk3=M.
4. Parse EVs from E chunk bytes 0–5, contest stats bytes 6–11.
5. Parse species/heldItem/experience/ppBonuses/friendship from G.
6. Parse moves/PP from A.
7. Parse met/IVs/ribbons from M (note bitfield for IVs and flags).
8. Use boxed data + growth to recompute level/stats if needed; compare to cached party stats at 0x50+.

## Encoding Checklist

1. Build substructs G/A/E/M with desired values (EVs, IVs, moves, OT info, ribbons).
2. Choose `personality` (affects nature, ability slot, gender, Unown/Spinda pattern) and `otId`.
3. Compute order index and arrange substructs accordingly.
4. Compute checksum over decrypted substructs; write to 0x1C.
5. XOR encrypt each u32 with `key = personality ^ otId` and place into secure block.
6. Fill nickname/OT name (Gen 3 charset, 0xFF terminator), language, flags, markings.
7. If producing a party entry, fill status/level/mail/current HP/maxHP/stats at 0x50+ (or allow the game to recalc).

With these steps, a constructed party Pokémon will pass in-game checksums and match PKHeX/PokeTunes decoding. Cross-check by re-running the decode pipeline and verifying checksum and IV/EV/move fields round-trip.  
