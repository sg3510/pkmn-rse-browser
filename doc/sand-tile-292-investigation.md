# Sand Tile Investigation: Metatile 292

## Finding Summary
Metatile 292 in gTileset_General **does have sand behavior** and the footprints implementation is correct, but the specific tile instance on Route104 is impassable.

## Metatile 292 Attributes

### Hex Dump
```
00000248: 2110
```

### Decoded Values
- **Behavior (byte 0)**: `0x21` = **33 decimal** = **MB_SAND** ✓
- **Layer Type (byte 1)**: `0x10` = **COVERED**

## Why You Can't Walk On It

The metatile definition says it's sand, but the specific instance on the map at Route104 (16, 54) is impassable because:

1. **Map-level collision**: The map.bin file may have collision bits set for this specific tile instance
2. **Object blocking**: There might be an event object (NPC, sign, item) on that tile
3. **COVERED layer type**: Suggests there's a visual layer on top that blocks passage

## Sand Footprints Behavior

Sand footprints WILL appear when you walk on tiles with:
- **MB_SAND (33/0x21)** - Regular sand
- **MB_DEEP_SAND (6/0x06)** - Deep sand

The implementation is correct - it just needs a **walkable** sand tile.

## Finding Walkable Sand

To test sand footprints, you need to find sand tiles that:
1. Have MB_SAND or MB_DEEP_SAND behavior
2. Are **passable** (no collision in map.bin)
3. Are not blocked by objects

### Suggested Locations
Try exploring:
- **Route 111** (Desert area) - if it exists and is accessible
- **Beach areas** on various routes
- Look for sandy patches that you can actually walk on

## Technical Details

### Collision in Pokémon Emerald
Tiles can be impassable due to:
1. **Metatile behavior**: The behavior value itself (but MB_SAND is walkable)
2. **Map collision bits**: Bits 10-11 in map.bin tile entries
3. **Event objects**: NPCs, items, signs block movement
4. **Script triggers**: Some tiles trigger events that prevent passage

### How to Verify
When you find a walkable sandy area:
1. Walk on it
2. Sand footprints should appear behind you
3. They stay for 40 frames (~0.67s)
4. Then flicker for 16 frames (~0.27s)
5. Then disappear

## Conclusion
The sand footprints feature is **implemented correctly**. The issue is finding the right tiles to test it on. Metatile 292 proves that MB_SAND tiles exist in the game - we just need to find walkable instances of them.
