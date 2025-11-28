# WebGL Implementation TODO - Detailed Feature Checklist

> This document tracks what Canvas2D features need WebGL equivalents or hybrid solutions,
> as well as all game functionality that must work correctly with WebGL rendering.
> Each item is broken down into specific, testable sub-tasks.

## Legend

- ✅ Covered in WebGL implementation guide
- 🔶 Partially covered / needs more detail
- ❌ Not covered - needs implementation plan
- 🔀 Hybrid approach (WebGL tiles + Canvas2D sprites)
- 🎮 Game functionality (not rendering, but must work with WebGL)

---

# PART A: RENDERING FEATURES

## 1. Core Tile Rendering

### 1.1 Basic Tile Drawing ✅
- [x] Instanced quad rendering for 8x8 tiles
- [x] Tile position calculation (screen coordinates)
- [x] Tile ID lookup from metatile
- [x] X-flip via UV coordinate inversion in vertex shader
- [x] Y-flip via UV coordinate inversion in vertex shader
- [x] Combined X+Y flip handling

### 1.2 Palette System ✅
- [x] 16-color palette texture (16x16 RGBA)
- [x] Palette index 0 transparency (discard in fragment shader)
- [x] Primary palette selection (indices 0-5)
- [x] Secondary palette selection (indices 6-15)
- [x] GPU palette lookup in fragment shader

### 1.3 Tileset Management ✅
- [x] Primary tileset as R8 texture upload
- [x] Secondary tileset as R8 texture upload
- [x] Tileset switching in shader (tilesetIndex attribute)
- [x] NEAREST filtering for pixel-perfect rendering
- [x] CLAMP_TO_EDGE wrapping

### 1.4 Metatile Layer Handling ✅
- [x] Layer 0 extraction (tiles 0-3, bottom 2x2)
- [x] Layer 1 extraction (tiles 4-7, top 2x2)
- [x] COVERED layer type: both layers in background pass
- [x] NORMAL layer type: layer 0 bg, layer 1 top
- [x] SPLIT layer type: layer 0 bg, layer 1 top

---

## 2. 3-Pass Rendering System

### 2.1 Framebuffer Setup ✅
- [x] Background pass framebuffer (BG2)
- [x] TopBelow pass framebuffer (BG1 behind player)
- [x] TopAbove pass framebuffer (BG1 above player)
- [x] Framebuffer texture creation (RGBA)
- [x] Framebuffer resize on viewport change

### 2.2 Pass Rendering ✅
- [x] Background pass: render layer 0 + COVERED layer 1
- [x] TopBelow pass: render NORMAL/SPLIT layer 1 with below filter
- [x] TopAbove pass: render NORMAL/SPLIT layer 1 with above filter
- [x] Clear framebuffer before render (transparent black)

### 2.3 Elevation Filtering ✅
- [x] Elevation-based priority calculation (0-15 → priority 0/1/2)
- [x] Elevations 0-3, 5, 7, 9, 11, 15 → behind BG1 (topBelow)
- [x] Elevations 4, 6, 8, 10, 12 → above BG1 (topAbove)
- [x] Elevations 13, 14 → always above everything
- [x] Vertical object override (trees/poles always above)

### 2.4 Pass Composition ✅
- [x] CompositeBackgroundOnly for sprite interleaving
- [x] CompositeTopBelowOnly for sprite interleaving
- [x] CompositeTopAbove after sprites
- [x] Sub-pixel offset application during composition

---

## 3. Animation System

### 3.1 Texture Region Updates ✅
- [x] texSubImage2D for partial tileset updates
- [x] Animation region calculation (x, y, width, height)
- [x] Frame sequence support ([0, 1, 0, 2])
- [x] Frame interval timing (game frames)
- [x] Phase offset per destination

### 3.2 Animation Types 🔶
- [x] Water animation (8 frames)
- [x] Flower animation (3 frames, sequence)
- [x] Water edge animations (sand-water, land-water)
- [x] Waterfall animation
- [ ] **Alt sequence support** (Mauville flowers: threshold-based sequence switch)
- [ ] **Multi-destination phase offsets** (Rustboro windy water: 8 destinations with -i phase)

### 3.3 Dirty Region Optimization ✅
- [x] Track animated tile positions in viewport
- [x] Detect animation frame changes
- [x] Return dirty regions for partial re-render
- [x] Threshold fallback for >50% animated tiles
- [x] Region merging for adjacent tiles

---

## 4. Scrolling & Camera

### 4.1 Sub-Pixel Scrolling ✅
- [x] Sub-tile offset calculation from camera position
- [x] Offset application during pass composition
- [x] Smooth pixel-perfect scrolling

### 4.2 Viewport Buffer 🔶
- [ ] **Overscan buffer implementation for WebGL**
  - [ ] 4-tile overscan in each direction
  - [ ] Buffer validity check on camera move
  - [ ] Incremental edge tile rendering on partial move
  - [ ] GPU-accelerated blit for reuse case
- [ ] **Buffer invalidation triggers**
  - [ ] View change detection
  - [ ] Elevation change invalidation
  - [ ] Animation-only update path

---

## 5. Sprite Rendering (Objects) 🔀

> **Decision Required**: Pure WebGL or Hybrid Canvas2D approach?
> Recommendation: Hybrid - render tiles with WebGL, sprites with Canvas2D,
> composite using WebGL readback or 2D canvas overlay.

### 5.1 Player Sprite ❌
- [ ] Direction-based frame selection (N/S/E/W)
- [ ] Horizontal flip for east-facing (avoid duplicate assets)
- [ ] Walking animation frame cycling
- [ ] Running animation frame cycling
- [ ] Surfing sprite variant
- [ ] Cycling sprite variant
- [ ] Y-position for layer ordering

### 5.2 NPC Sprites ❌
- [ ] NPC sprite loading from object events
- [ ] Direction-based frame selection
- [ ] Horizontal flip for east-facing
- [ ] Movement animation frames
- [ ] **Y-sorting relative to player**
  - [ ] NPCs above player Y: render before player
  - [ ] NPCs below/at player Y: render after player
- [ ] **Priority-based rendering**
  - [ ] Priority 2 NPCs (elevations 0-3, 5, 7, 9, 11, 15): after background, before topBelow
  - [ ] Priority 1 NPCs (player elevation): Y-sorted with player
  - [ ] Priority 0 NPCs (elevations 13-14): after topAbove, always on top
- [ ] Viewport culling (skip off-screen NPCs)

### 5.3 Item Balls ❌
- [ ] 16x16 fixed sprite rendering
- [ ] Y-sorting relative to player
- [ ] Collect-and-hide logic integration

---

## 6. Reflections ❌

> **Complex Feature**: Requires pixel-level masking and composite operations.
> May need Canvas2D fallback or stencil buffer approach.

### 6.1 Reflection Detection ❌
- [ ] Metatile behavior checking for reflective tiles
- [ ] Water behavior detection (MB_POND_WATER, MB_OCEAN_WATER, etc.)
- [ ] Ice behavior detection (MB_ICE variants)
- [ ] Bridge/puddle behavior special cases

### 6.2 Pixel Mask Generation ❌
- [ ] Scan bottom layer tiles for water-colored pixels (blue hue detection)
- [ ] Scan top layer tiles for opaque pixels (block reflection)
- [ ] Build 16x16 alpha mask per metatile
- [ ] Cache masks per metatile for reuse

### 6.3 Player Reflection ❌
- [ ] Vertical sprite flip (scale Y = -1)
- [ ] Y-position calculation: `sprite.y + height - 2 + bridgeOffset`
- [ ] Water tint application (blue overlay)
- [ ] Ice tint application (light blue overlay)
- [ ] Alpha mask application (only visible on water pixels)
- [ ] Bridge-specific darker tint

### 6.4 NPC Reflections ❌
- [ ] Same logic as player reflection
- [ ] Per-NPC reflection enabled/disabled flag
- [ ] Y-sorting with other reflections

### 6.5 WebGL Reflection Strategy ❌
- [ ] **Option A: Stencil buffer masking**
  - [ ] Render water tile mask to stencil
  - [ ] Render flipped sprite with stencil test
  - [ ] Apply tint via blend mode
- [ ] **Option B: Separate reflection texture**
  - [ ] Render all reflections to offscreen texture
  - [ ] Composite with mask texture
- [ ] **Option C: Canvas2D hybrid**
  - [ ] Use Canvas2D for reflection sprite
  - [ ] Composite on WebGL output

---

## 7. Field Effects ❌

### 7.1 Tall Grass Effect ❌
- [ ] Trigger on player step into tall grass tile
- [ ] 5-frame animation (10 ticks per frame)
- [ ] Sprite positioning at tile center
- [ ] Direction-based horizontal flip
- [ ] Effect lifetime management
- [ ] Multiple simultaneous effects (NPC grass)

### 7.2 Long Grass Effect ❌
- [ ] 7-frame animation with variable timing
- [ ] Frame durations: [10, 10, 10, 10, 10, 10, 10] ticks
- [ ] Sprite sheet frame selection
- [ ] Effect spawn on tile entry

### 7.3 Sand Footprints ❌
- [ ] 2-frame animation (8 ticks per frame)
- [ ] Direction-based flip (horizontal for E/W)
- [ ] Fade-out after delay
- [ ] Multiple footprint tracking (trail)

### 7.4 Puddle Splash ❌
- [ ] 2-frame animation (4 ticks per frame)
- [ ] Trigger on puddle tile entry
- [ ] Sprite centering on tile

### 7.5 Water Ripple ❌
- [ ] 4-frame animation with variable timing
- [ ] Frame durations: [12, 9, 9, 9] ticks
- [ ] **Pixel mask to water tiles only**
  - [ ] Sample metatile water pixels
  - [ ] Clip ripple sprite to water area
  - [ ] Handle partial overlap cases
- [ ] Subpriority offset (frame 0 = behind player, others = in front)

### 7.6 Grass Over NPC ❌
- [ ] Draw grass frame 0 over NPC lower body
- [ ] Only when NPC standing on tall/long grass
- [ ] Proper Z-ordering with other effects

---

## 8. Door System ❌

### 8.1 Door Animation Loading ❌
- [ ] Load door sprite sheets for each tileset
- [ ] Horizontal strip format (all frames in row)
- [ ] Auto-detect frame count from image width

### 8.2 Door Opening Animation ❌
- [ ] Trigger on warp tile approach
- [ ] Frame sequence: 0 → 1 → 2 → (open)
- [ ] Frame timing: 8 ticks per frame
- [ ] Position: centered on door tile, 1 tile Y offset

### 8.3 Door Closing Animation ❌
- [ ] Trigger on warp exit
- [ ] Frame sequence: (open) → 2 → 1 → 0
- [ ] Reverse of opening sequence
- [ ] Clear animation on complete

### 8.4 Door State Management ❌
- [ ] Track which door is animating
- [ ] Handle multiple doors (edge case)
- [ ] Integration with warp controller

---

## 9. Warp System Integration 🔶

### 9.1 Warp Tile Detection ❌
- [ ] Metatile behavior checking for warp types
- [ ] Door warp identification
- [ ] Stairs warp identification
- [ ] Portal warp identification

### 9.2 Warp Transition Rendering ❌
- [ ] Fade out before warp
- [ ] Tile layer freeze during transition
- [ ] Fade in after map load
- [ ] Door animation timing integration

### 9.3 Map Loading During Warp ❌
- [ ] Texture upload for new tilesets
- [ ] Palette upload for new map
- [ ] Animation registration for new map
- [ ] Cache invalidation on map change

---

## 10. Surf Blob ❌

### 10.1 Surf Blob Sprite ❌
- [ ] 32x32 sprite loading
- [ ] 3 direction variants (down/up, left, right)
- [ ] Horizontal flip for right direction
- [ ] Transparent background handling at load

### 10.2 Bobbing Animation ❌
- [ ] GBA-accurate discrete stepping
- [ ] Update every 4 frames (`timer & 0x3 == 0`)
- [ ] ±1 pixel Y velocity
- [ ] Reverse direction every 16 frames (`timer & 15 == 0`)
- [ ] Range: -4 to +4 pixels from base

### 10.3 Bob State Control ❌
- [ ] BOB_PLAYER_AND_MON: both player and blob bob
- [ ] BOB_JUST_MON: only blob bobs (player stationary)
- [ ] BOB_NONE: no bobbing (transitional states)

### 10.4 Render Order ❌
- [ ] Surf blob renders before player sprite
- [ ] Player appears "on top" of blob
- [ ] Water reflection of blob (if applicable)

---

## 11. Arrow Overlay ❌

### 11.1 Arrow Sprite ❌
- [ ] 16x16 animated arrow
- [ ] 4 direction variants
- [ ] Frame animation cycling

### 11.2 Arrow Animation ❌
- [ ] Frame duration: 533ms (32 GBA frames)
- [ ] Loop through frames
- [ ] Position above player

---

## 12. Fade Overlay ❌

### 12.1 Fade Controller ❌
- [ ] Fade to black (warp out)
- [ ] Fade from black (warp in)
- [ ] Configurable fade duration
- [ ] Smooth alpha interpolation

### 12.2 WebGL Fade Implementation ❌
- [ ] Full-screen quad with alpha
- [ ] Render as final layer (on top of everything)
- [ ] Integration with scene composition

---

## 13. Debug Rendering 🔶

### 13.1 Collision Overlay ❌
- [ ] Green border for passable tiles
- [ ] Red fill for blocked tiles
- [ ] Semi-transparent overlay
- [ ] Toggle on/off

### 13.2 Elevation Overlay ❌
- [ ] 16-color gradient (blue=0 to red=15)
- [ ] Per-tile elevation display
- [ ] Toggle on/off

### 13.3 Layer Decomposition ❌
- [ ] Bottom layer only view
- [ ] Top layer only view
- [ ] Side-by-side comparison

### 13.4 Debug Grid ❌
- [ ] 3x3 grid around player
- [ ] Metatile ID display
- [ ] Collision flag display
- [ ] Elevation value display
- [ ] Reflective tile markers ('•R')

### 13.5 WebGL Debug Approach ❌
- [ ] **Option A: Separate debug pass**
  - [ ] Render debug overlay to own framebuffer
  - [ ] Composite on top
- [ ] **Option B: Canvas2D overlay**
  - [ ] Render WebGL tiles
  - [ ] Use Canvas2D layer for debug text/shapes

---

## 14. Scene Composition Order ❌

> **Critical**: The exact render order must match Canvas2D for visual correctness.

### 14.1 Full Composition Sequence ❌
```
1.  [ ] Clear canvas (WebGL clear)
2.  [ ] Composite Background pass
3.  [ ] Render Priority 2 NPCs (between bg and topBelow)
4.  [ ] Render Door animations
5.  [ ] Render Arrow overlay
6.  [ ] Render Player reflection
7.  [ ] Render NPC reflections (before NPC sprites for depth)
8.  [ ] Render Field effects behind player (grass, sand, splashes)
9.  [ ] Render Item balls behind player (Y < player Y)
10. [ ] Render NPCs behind player (Y-sorted, Y < player Y)
11. [ ] Render Grass effects over NPCs (lower body coverage)
12. [ ] Render Surf blob (before player)
13. [ ] Render Player sprite
14. [ ] Render Field effects in front of player
15. [ ] Render Item balls in front of player (Y >= player Y)
16. [ ] Render NPCs in front of player (Y-sorted, Y >= player Y)
17. [ ] Render Grass effects over NPCs
18. [ ] Composite TopAbove pass
19. [ ] Render Priority 0 NPCs (always on top)
20. [ ] Render Debug overlays
21. [ ] Render Fade overlay (absolute top)
```

### 14.2 WebGL/Canvas2D Interleaving ❌
- [ ] Read WebGL framebuffer to Canvas2D (performance cost)
- [ ] OR: Render sprites to WebGL textures
- [ ] OR: Use shared canvas with getContext switching
- [ ] OR: Overlay Canvas2D on WebGL canvas (z-index)

---

## 15. Context Management

### 15.1 Context Creation ✅
- [x] WebGL2 context request
- [x] Feature detection
- [x] Extension checking

### 15.2 Context Loss Recovery 🔶
- [ ] **webglcontextlost event handler**
  - [ ] preventDefault to allow recovery
  - [ ] Set contextLost flag
  - [ ] Pause rendering loop
- [ ] **webglcontextrestored event handler**
  - [ ] Re-initialize GL state
  - [ ] Re-upload all textures (tilesets, palettes)
  - [ ] Re-compile shaders
  - [ ] Rebuild framebuffers
  - [ ] Reset uniform/attribute locations
  - [ ] Resume rendering
- [ ] **Graceful degradation during loss**
  - [ ] Show loading indicator
  - [ ] OR fall back to Canvas2D temporarily

### 15.3 Resource Cleanup ❌
- [ ] Texture deletion on map unload
- [ ] Framebuffer deletion on unmount
- [ ] Buffer deletion
- [ ] Program/shader deletion
- [ ] Memory leak prevention

---

## 16. Palette Effects ❌

### 16.1 Weather Palette Tinting ❌
- [ ] Rain darkening effect
- [ ] Sandstorm tint
- [ ] Ash overlay
- [ ] Update palette texture per-frame

### 16.2 Time-of-Day Palette ❌
- [ ] Morning warm tint
- [ ] Day neutral
- [ ] Evening orange tint
- [ ] Night blue/dark tint
- [ ] Smooth transitions

### 16.3 Flash Effects ❌
- [ ] White flash (battle encounter)
- [ ] Red flash (damage)
- [ ] Custom duration

---

## 17. Mobile/Performance Considerations 🔶

### 17.1 Mobile Detection ❌
- [ ] User agent detection
- [ ] Touch capability detection
- [ ] Performance tier assessment

### 17.2 Mobile Optimizations ❌
- [ ] Reduced texture size (2048 max vs 4096)
- [ ] Reduced instance buffer (2048 vs 4096)
- [ ] Half-resolution framebuffers option
- [ ] Simplified shader variants

### 17.3 Performance Monitoring ❌
- [ ] Frame time measurement
- [ ] Draw call counting
- [ ] Memory usage tracking
- [ ] Performance budget enforcement

---

## 18. Testing Infrastructure

### 18.1 Visual Conformance Tests ❌
- [ ] Pixel-perfect comparison: WebGL vs Canvas2D
- [ ] All 16 palettes render correctly
- [ ] Flipped tiles match Canvas2D
- [ ] Secondary tileset correct
- [ ] Animation frames match timing

### 18.2 Performance Benchmarks ✅
- [x] Scenario definitions (8 scenarios)
- [x] Metrics collection framework
- [x] Result formatting and comparison
- [ ] **Automated benchmark runner**
- [ ] **CI integration**

### 18.3 Edge Case Tests ❌
- [ ] Context loss/restore cycle
- [ ] Map transition during animation
- [ ] Rapid elevation changes
- [ ] Maximum tile count stress test
- [ ] Memory pressure scenarios

---

# PART B: GAME FUNCTIONALITY

> All game systems must work correctly with WebGL rendering.
> This section breaks down each system's rendering requirements.

---

## 19. Player Movement System 🎮

### 19.1 Movement States ❌
- [ ] **Normal/Walking State**
  - [ ] Walking speed: 0.06 px/ms (~1 pixel/frame at 60fps)
  - [ ] Sprite animation frame cycling (walkFrameAlternate toggle)
  - [ ] Direction-based sprite frame selection (0=down, 1=up, 2=left, 3=right-flipped)
  - [ ] 16px tile-to-tile movement interpolation
  - [ ] Input handling during movement (queue next direction)

- [ ] **Running State**
  - [ ] Running speed: 0.12 px/ms (~2 pixels/frame)
  - [ ] Z key toggle detection
  - [ ] Running sprite variant (if different from walking)
  - [ ] Speed transition smoothness

- [ ] **Jumping State (Ledges)**
  - [ ] Jump arc calculation: `JUMP_Y_HIGH[frame]` table lookup
  - [ ] 32-frame jump duration
  - [ ] 16-pixel horizontal travel (1 tile)
  - [ ] Y-offset for arc (`spriteYOffset` applied to sprite)
  - [ ] Shadow sprite visibility during jump
  - [ ] Landing detection and state transition
  - [ ] Grass effect trigger on landing

### 19.2 Movement Rendering ❌
- [ ] Pixel-accurate position during interpolation
- [ ] Sub-tile position for smooth movement
- [ ] Direction change mid-movement handling
- [ ] Sprite frame synchronization with position

---

## 20. Surfing System 🎮

### 20.1 Surf State Machine ❌
- [ ] **IDLE state**: Not surfing, normal movement
- [ ] **SURFING state**: On water, blob visible
- [ ] **JUMPING_ON state**: Mount animation (32 frames)
- [ ] **JUMPING_OFF state**: Dismount animation (32 frames)

### 20.2 Mount Sequence (Land → Water) ❌
- [ ] **Detection**: Player on land, attempting to move to water
  - [ ] Check target tile is surfable water (MB_POND_WATER, etc.)
  - [ ] Check player has Surf ability (game flag)
- [ ] **Initiation**
  - [ ] Lock player input
  - [ ] Spawn blob at water tile position
  - [ ] Set bob state to BOB_NONE (no bobbing during jump)
- [ ] **Jump Arc Animation**
  - [ ] Frame 0-31: Horizontal interpolation over 16px
  - [ ] Y-offset from `JUMP_Y_HIGH[]` table (arc peaks mid-jump)
  - [ ] Player sprite moves from land to blob
- [ ] **Completion**
  - [ ] Update player position to water tile
  - [ ] Set state to SURFING
  - [ ] Set bob state to BOB_PLAYER_AND_MON
  - [ ] Enable water movement collision rules

### 20.3 Dismount Sequence (Water → Land) ❌
- [ ] **Detection**: Player on water, attempting to move to land
  - [ ] Check target tile is passable land
  - [ ] Check elevation is 3 (standard ground)
- [ ] **Initiation**
  - [ ] Lock player input
  - [ ] Set bob state to BOB_JUST_MON (blob bobs, player doesn't)
- [ ] **Jump Arc Animation**
  - [ ] Frame 0-31: Horizontal interpolation over 16px
  - [ ] Y-offset from `JUMP_Y_HIGH[]` table
  - [ ] Player sprite jumps from blob to land
  - [ ] Blob stays at water tile position
- [ ] **Completion**
  - [ ] Update player position to land tile
  - [ ] Set state to IDLE
  - [ ] Remove blob sprite
  - [ ] Restore normal movement collision rules

### 20.4 Blob Bobbing Animation ❌
- [ ] **BOB_NONE**: No Y-offset applied
- [ ] **BOB_JUST_MON**: Only blob bobs, player static
- [ ] **BOB_PLAYER_AND_MON**: Both player and blob bob together
- [ ] **Bobbing mechanics**
  - [ ] Update every 4 frames (`timer & 0x3 == 0`)
  - [ ] Velocity: ±1 pixel per update
  - [ ] Direction reverses every 16 frames (`timer & 15 == 0`)
  - [ ] Y-offset range: -4 to +4 pixels
  - [ ] Discrete stepping (not smooth interpolation)

### 20.5 Blob Sprite Rendering ❌
- [ ] 32x32 sprite from 96x32 sprite sheet
- [ ] Frame 0: Down/Up facing directions
- [ ] Frame 1: Left facing direction
- [ ] Frame 2: Right facing (horizontal flip of frame 1)
- [ ] Transparent background handling at load time
- [ ] Render before player sprite (player appears on top)
- [ ] Apply bob Y-offset when BOB_JUST_MON or BOB_PLAYER_AND_MON

### 20.6 Surfing Movement ❌
- [ ] Speed: 0.12 px/ms (same as running)
- [ ] Collision: Only surfable water tiles passable
- [ ] Direction change on water (no restrictions)
- [ ] Auto-dismount attempt when moving to land

---

## 21. Elevation & Collision System 🎮

### 21.1 Elevation States ❌
- [ ] **currentElevation**: Actual tile elevation (0-15)
  - [ ] Used for collision checks
  - [ ] Updated when entering tile
- [ ] **previousElevation**: Rendered elevation for Y-sorting
  - [ ] Preserved when on ground level (elevation 0)
  - [ ] Updated when changing to non-zero elevation
- [ ] **previousTileElevation**: Last tile's elevation
  - [ ] Used for transition detection

### 21.2 Elevation Compatibility ❌
- [ ] **Ground level (0)**: Can move to/from any elevation
- [ ] **Universal level (15)**: Accessible from any elevation
- [ ] **Same non-zero**: Can interact (e.g., both elevation 4)
- [ ] **Different non-zero**: Collision (cannot pass)
- [ ] **Bridge handling**: Elevation determines if on or under bridge

### 21.3 Collision Types ❌
- [ ] **Out of bounds**: Beyond map edges
- [ ] **Blocked metatile**: Collision flag set
- [ ] **Surfable water (no surf)**: Cannot walk on water
- [ ] **Directional blocks (48-55)**: Passable one way only
- [ ] **Object/NPC**: Another entity at target
- [ ] **Elevation mismatch**: Different elevation levels
- [ ] **Door behaviors**: Handled by warp system, not collision

### 21.4 Object Collision ❌
- [ ] Check NPCs at target tile
- [ ] Check item balls at target tile
- [ ] Consider object elevation for compatibility
- [ ] Elevation 0 or 15 objects interact with all

---

## 22. Field Effect Triggers 🎮

### 22.1 Tall Grass (MB_TALL_GRASS) ❌
- [ ] **Trigger**: OnBeginStep (when starting to move onto tile)
- [ ] **Animation**: Sequence [1, 2, 3, 4, 0], 10 ticks/frame
- [ ] **Duration**: 50 ticks total (~833ms)
- [ ] **Cleanup**: Animated frames removed immediately after completion
- [ ] **Frame 0 cleanup**: Keep until player moves away from tile
  - [ ] DOWN direction: Remove immediately (sprite covers grass)
  - [ ] UP/LEFT/RIGHT: Keep until current AND previous positions are off tile

### 22.2 Long Grass (MB_LONG_GRASS) ❌
- [ ] **Trigger**: OnBeginStep
- [ ] **Animation**: Sequence [1, 2, 0, 3, 0, 3, 0]
- [ ] **Frame durations**: [3, 3, 4, 4, 4, 4, 4] ticks
- [ ] **Duration**: 26 ticks total (~433ms)
- [ ] **Player clipping**: Bottom 50% of player sprite hidden
  - [ ] `currentGrassType` flag updated OnFinishStep
  - [ ] Sprite clipping applied in render
- [ ] **Cleanup**: Same as tall grass

### 22.3 Sand Footprints (MB_SAND, MB_DEEP_SAND) ❌
- [ ] **Trigger**: OnBeginStep (create on PREVIOUS tile)
- [ ] **Direction storage**: For correct footprint orientation
- [ ] **Frame selection**
  - [ ] Frame 0: up/down directions
  - [ ] Frame 1: left/right directions (horizontal flip for right)
- [ ] **Phase 1** (ticks 0-40): Static display
- [ ] **Phase 2** (ticks 40-56): Flicker/fade animation
- [ ] **Duration**: 56 ticks total (~933ms)

### 22.4 Puddle Splash ❌
- [ ] **Trigger**: When BOTH current AND previous tiles are puddle tiles
- [ ] **Animation**: Sequence [0, 1], 4 ticks/frame
- [ ] **Duration**: 8 ticks total (~133ms)
- [ ] **Position**: Follows player during animation

### 22.5 Water Ripple ❌
- [ ] **Trigger**: Current tile has water behavior
  - [ ] MB_POND_WATER (16)
  - [ ] MB_PUDDLE (22)
  - [ ] MB_SOOTOPOLIS_DEEP_WATER (20)
- [ ] **Animation**: Sequence [0, 1, 2, 3, 0, 1, 2, 4]
- [ ] **Frame durations**: [12, 9, 9, 9, 9, 9, 11, 11] ticks
- [ ] **Duration**: 79 ticks total (~1.32s)
- [ ] **Position**: Fixed at spawn location (doesn't follow player)
- [ ] **Pixel masking**: Only visible on water-colored pixels
- [ ] **Subpriority**: Frame 0 = behind player, others = in front

### 22.6 Grass Over NPC ❌
- [ ] **Condition**: NPC standing on tall/long grass tile
- [ ] **Render**: Grass frame 0 over NPC lower body
- [ ] **Z-ordering**: After NPC sprite, before higher priority layers

---

## 23. Door System 🎮

### 23.1 Door Entry Sequence ❌
- [ ] **Phase 1: 'opening'** (animated doors only)
  - [ ] Door sprite animation: 3 frames × 90ms each
  - [ ] Wait for animation completion
  - [ ] Non-animated: Skip to stepping
- [ ] **Phase 2: 'stepping'**
  - [ ] Force player movement into doorway
  - [ ] `forceMove()` call with locked input
  - [ ] Wait for 1-tile movement completion
- [ ] **Phase 3: 'closing'** (animated doors only)
  - [ ] Door sprite animation: 3 frames × 90ms (reverse)
  - [ ] Non-animated: Skip to waiting
- [ ] **Phase 4: 'waitingBeforeFade'**
  - [ ] Brief pause: 200ms
  - [ ] Visual settling before fade
- [ ] **Phase 5: 'fadingOut'**
  - [ ] Screen fade to black: 500ms
  - [ ] Prevents visual glitches during load
- [ ] **Phase 6: 'warping'**
  - [ ] Execute warp to destination map
  - [ ] Load new map assets
  - [ ] Position player at destination warp point
  - [ ] Player hidden during this phase

### 23.2 Door Exit Sequence ❌
- [ ] **Phase 1: 'opening'**
  - [ ] Wait for fade-in completion
  - [ ] Door opens from inside (animated)
- [ ] **Phase 2: 'stepping'**
  - [ ] Show player sprite
  - [ ] Force player movement out of doorway
  - [ ] Wait for 1-tile movement completion
- [ ] **Phase 3: 'closing'** (animated doors only)
  - [ ] Door sprite animation: 3 frames × 90ms
- [ ] **Phase 4: 'done'**
  - [ ] Unlock player input
  - [ ] Sequence complete

### 23.3 Door Animation Rendering ❌
- [ ] Sprite sheet format: Horizontal strip (all frames in row)
- [ ] Frame dimensions: Variable width, 32px height
- [ ] Auto-detect frame count from image width
- [ ] Position: Centered on door tile, 1 tile Y offset upward
- [ ] FRAME_DURATION_MS: 90ms per frame

### 23.4 Door Behavior Types ❌
- [ ] **MB_ANIMATED_DOOR (105)**: Full animation sequence
- [ ] **MB_WATER_DOOR (108)**: Water-themed animated door
- [ ] **MB_NON_ANIMATED_DOOR (96)**: Skip opening/closing animation
- [ ] **MB_LADDER (97)**: Ladder entry (no door animation)

---

## 24. Warp System 🎮

### 24.1 Warp Detection ❌
- [ ] **Trigger conditions**
  - [ ] Player stopped moving (pixelsMoved == 0)
  - [ ] Not on cooldown (350ms default)
  - [ ] Not same tile as last checked
- [ ] **Arrow warps**: Additional direction matching required
  - [ ] MB_NORTH_ARROW_WARP (100): direction == 'up'
  - [ ] MB_SOUTH_ARROW_WARP (101): direction == 'down'
  - [ ] MB_WEST_ARROW_WARP (99): direction == 'left'
  - [ ] MB_EAST_ARROW_WARP (98): direction == 'right'
  - [ ] MB_WATER_SOUTH_ARROW_WARP (109): direction == 'down' (underwater)

### 24.2 Warp Types ❌
- [ ] **Door warp**: Animated door sequence before/after
- [ ] **Teleport warp**: Instant transition (caves, pads)
  - [ ] MB_AQUA_HIDEOUT_WARP (103)
  - [ ] MB_LAVARIDGE_GYM_1F_WARP (104)
  - [ ] MB_LAVARIDGE_GYM_B1F_WARP (41)
  - [ ] MB_BATTLE_PYRAMID_WARP (13)
  - [ ] MB_MOSSDEEP_GYM_WARP (14)
  - [ ] MB_DEEP_SOUTH_WARP (110)
  - [ ] MB_MT_PYRE_HOLE (15)
- [ ] **Arrow warp**: Forced movement in direction (stairs, carpets)

### 24.3 Warp Execution ❌
- [ ] **Pre-warp**
  - [ ] Lock player input
  - [ ] Start fade-out (if applicable)
  - [ ] Door sequence (if door warp)
- [ ] **Map loading**
  - [ ] Load destination map data
  - [ ] Upload new tilesets to GPU (WebGL texture update)
  - [ ] Upload new palettes (palette texture update)
  - [ ] Register new animations
  - [ ] Invalidate render cache
- [ ] **Post-warp**
  - [ ] Position player at destination warp point
  - [ ] Start fade-in
  - [ ] Door exit sequence (if door warp)
  - [ ] Unlock player input

### 24.4 Warp Runtime State ❌
- [ ] `inProgress`: Boolean flag for warp execution
- [ ] `cooldownMs`: Time until next warp can trigger (350ms)
- [ ] `lastCheckedTile`: Prevent re-triggering same tile

---

## 25. NPC System 🎮

### 25.1 NPC Data Structure ❌
- [ ] `graphicsId`: Sprite identifier for loading
- [ ] `x`, `y`: World tile coordinates
- [ ] `elevation`: Z-level for collision/priority
- [ ] `direction`: Initial facing direction
- [ ] `movementType`: Behavior pattern (static, patrol, etc.)
- [ ] `movementRangeX`, `movementRangeY`: Patrol bounds
- [ ] `trainerType`: Trainer classification
- [ ] `trainerSightRange`: Battle trigger distance
- [ ] `flag`: Visibility/persistence flag
- [ ] `script`: Interaction script identifier

### 25.2 NPC Visibility ❌
- [ ] Hidden when associated flag IS set
- [ ] Refreshed via GameFlags system
- [ ] Flag "0" = always visible (no flag)

### 25.3 NPC Collision ❌
- [ ] NPCs block movement at same elevation
- [ ] Elevation 0 or 15 blocks all elevations
- [ ] Collision check in `isCollisionAt()`

### 25.4 NPC Sprite Rendering ❌
- [ ] Direction-based frame selection
  - [ ] Frame 0: Down
  - [ ] Frame 1: Up
  - [ ] Frame 2: Left
  - [ ] Frame 3: Right (horizontal flip of frame 2)
- [ ] Walk frame alternation per tile moved
- [ ] 16x32 sprite dimensions (standard)
- [ ] Horizontal centering on tile
- [ ] Feet at bottom of tile

### 25.5 NPC Priority Rendering ❌
- [ ] **Priority 2** (Elevation 0-3, 5, 7, 9, 11, 15)
  - [ ] Render after background, before topBelow
- [ ] **Priority 1** (Elevation 4, 6, 8, 10, 12)
  - [ ] Render with player, Y-sorted
- [ ] **Priority 0** (Elevation 13-14)
  - [ ] Render after topAbove, always on top

### 25.6 NPC Y-Sorting ❌
- [ ] NPCs at Y < playerY: Render behind player
- [ ] NPCs at Y >= playerY: Render in front of player
- [ ] Within same priority level only

### 25.7 NPC Reflections ❌
- [ ] Same reflection logic as player
- [ ] Per-NPC reflection enabled flag
- [ ] 4-pixel downward offset from sprite

---

## 26. Item Ball System 🎮

### 26.1 Item Ball Data ❌
- [ ] `tileX`, `tileY`: World coordinates
- [ ] `itemId`: Item type identifier
- [ ] `itemName`: Display name for collection
- [ ] `flag`: Persistence flag
- [ ] `collected`: Collection state (from flags)
- [ ] `elevation`: Z-level for collision

### 26.2 Item Ball Visibility ❌
- [ ] Invisible when flag is set (collected)
- [ ] Checked against GameFlags system

### 26.3 Item Ball Collision ❌
- [ ] Blocks movement at same elevation
- [ ] Elevation 0 or 15 blocks all
- [ ] Collection on interaction (not collision)

### 26.4 Item Ball Rendering ❌
- [ ] 16x16 fixed sprite
- [ ] Y-sorted with player and NPCs
- [ ] Single static frame (no animation)

---

## 27. Fade Controller 🎮

### 27.1 Fade States ❌
- [ ] `mode`: 'in' (from black) | 'out' (to black) | null
- [ ] `startedAt`: Timestamp for progress calculation
- [ ] `duration`: Fade duration in milliseconds

### 27.2 Fade Timing Constants ❌
- [ ] DEFAULT_DURATION_MS: 500ms (standard transitions)
- [ ] QUICK_DURATION_MS: 250ms (fast transitions)

### 27.3 Fade Alpha Calculation ❌
- [ ] Fade out: progress 0→1 = alpha 0→1 (transparent to black)
- [ ] Fade in: progress 0→1 = alpha 1→0 (black to transparent)
- [ ] Linear interpolation: `progress = elapsed / duration`

### 27.4 Fade Rendering ❌
- [ ] Full-screen overlay
- [ ] `rgba(0, 0, 0, alpha)` fill
- [ ] Render as absolute top layer (after everything else)

---

## 28. Game Flags System 🎮

### 28.1 Flag Storage ❌
- [ ] Persist to localStorage
- [ ] String-based flag identifiers
- [ ] Set/Clear/Check operations

### 28.2 Flag Operations ❌
- [ ] `set(flag)`: Mark flag as true
- [ ] `clear(flag)`: Remove flag
- [ ] `isSet(flag)`: Check flag status
- [ ] `reset()`: Clear all flags
- [ ] `getAllFlags()`: Get array of set flags

### 28.3 Flag Usage ❌
- [ ] Item collection (set on pickup)
- [ ] NPC visibility (hide when set)
- [ ] Story progression tracking
- [ ] Door unlock states

---

## 29. Map Loading (WebGL Integration) 🎮

### 29.1 Map Data Loading ❌
- [ ] Map layout (map.bin) → tile grid
- [ ] Border metatiles (border.bin) → edge tiles
- [ ] Warp events (map.json) → warp triggers
- [ ] Object events (map.json) → NPCs and items

### 29.2 Tileset Loading (WebGL) ❌
- [ ] **Primary tileset image** → R8 texture upload
- [ ] **Secondary tileset image** → R8 texture upload
- [ ] **Primary palettes** → Palette texture rows 0-5
- [ ] **Secondary palettes** → Palette texture rows 6-15
- [ ] **Metatile attributes** → CPU-side lookup

### 29.3 Animation Registration ❌
- [ ] Load animation frame images
- [ ] Calculate texture regions for each animation
- [ ] Register with WebGL AnimationManager
- [ ] Track animated tile IDs for dirty region optimization

### 29.4 Cache Invalidation ❌
- [ ] Clear render pipeline cache on map change
- [ ] Clear dirty region tracker
- [ ] Clear tileset texture cache (if tileset changed)
- [ ] Preserve shared tilesets across map transitions

---

# PART C: SUMMARY & ROADMAP

---

## Summary Statistics

| Category | Type | Total | Done | Partial | Missing |
|----------|------|-------|------|---------|---------|
| **Rendering** |
| Core Tiles | Render | 22 | 22 | 0 | 0 |
| 3-Pass System | Render | 18 | 18 | 0 | 0 |
| Animation | Render | 14 | 10 | 2 | 2 |
| Scrolling | Render | 9 | 3 | 0 | 6 |
| Sprites | Render | 20 | 0 | 0 | 20 |
| Reflections | Render | 21 | 0 | 0 | 21 |
| Field Effects | Render | 25 | 0 | 0 | 25 |
| Doors | Render | 12 | 0 | 0 | 12 |
| Surf Blob | Render | 12 | 0 | 0 | 12 |
| Arrow Overlay | Render | 5 | 0 | 0 | 5 |
| Fade Overlay | Render | 5 | 0 | 0 | 5 |
| Debug | Render | 15 | 0 | 3 | 12 |
| Scene Composition | Render | 23 | 0 | 0 | 23 |
| Context Mgmt | Render | 14 | 3 | 3 | 8 |
| Palette Effects | Render | 10 | 0 | 0 | 10 |
| Mobile | Render | 10 | 0 | 2 | 8 |
| Testing | Render | 12 | 5 | 0 | 7 |
| **Game Systems** |
| Player Movement | Game | 22 | 0 | 0 | 22 |
| Surfing System | Game | 42 | 0 | 0 | 42 |
| Elevation/Collision | Game | 16 | 0 | 0 | 16 |
| Field Effect Triggers | Game | 32 | 0 | 0 | 32 |
| Door System | Game | 25 | 0 | 0 | 25 |
| Warp System | Game | 24 | 0 | 0 | 24 |
| NPC System | Game | 28 | 0 | 0 | 28 |
| Item Ball System | Game | 12 | 0 | 0 | 12 |
| Fade Controller | Game | 10 | 0 | 0 | 10 |
| Game Flags | Game | 8 | 0 | 0 | 8 |
| Map Loading | Game | 12 | 0 | 0 | 12 |
| **TOTAL** | | **518** | **61** | **10** | **447** |

---

## Recommended Implementation Order

### Phase 2: WebGL Foundation
1. WebGL context setup with loss recovery
2. Shader compilation and caching
3. Basic instanced quad rendering
4. Texture upload (R8 tilesets, RGBA palettes)

### Phase 3: Core Tile Rendering
5. GPU palette lookup
6. Framebuffer passes (bg, topBelow, topAbove)
7. Elevation filtering integration
8. Pass composition with sub-pixel scrolling

### Phase 4: Hybrid Sprite System
9. Canvas2D sprite rendering preserved
10. WebGL ↔ Canvas2D composition strategy
11. Y-sorting implementation
12. Priority-based NPC rendering

### Phase 5: Game System Integration
13. Verify player movement with WebGL tiles
14. Verify elevation collision with WebGL rendering
15. Field effect triggers work correctly
16. Door sequences display properly
17. Warp map loading updates WebGL textures

### Phase 6: Complex Features
18. Surfing mount/dismount animations
19. Blob bobbing synchronized with render
20. Reflections (player, NPC, blob)
21. Water ripple pixel masking

### Phase 7: Polish
22. Fade overlay
23. Viewport buffer for scrolling
24. Debug overlay support
25. Context loss recovery
26. Mobile optimizations
27. Visual conformance tests

---

## Critical Integration Points

### Surfing ↔ WebGL
- Blob sprite must render correctly with WebGL tiles
- Bob animation Y-offset applied in composition
- Mount/dismount jump arc synchronized with tile rendering
- Water tile detection uses same elevation data

### Doors ↔ WebGL
- Door animation overlays on WebGL tiles
- Fade coordinates with WebGL clear/render
- Map transition triggers texture re-upload

### Field Effects ↔ WebGL
- Effect sprites composite over WebGL tiles
- Grass clipping requires player sprite manipulation
- Water ripple masking may need stencil buffer

### NPCs ↔ WebGL
- NPC sprites Y-sorted with player relative to WebGL passes
- Priority rendering interleaves with WebGL pass composition
- Reflection rendering after WebGL but before player sprite
