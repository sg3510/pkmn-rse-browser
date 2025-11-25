# Testing Guide: Hardware-Accelerated Rendering

## Quick Start

```bash
# Start the development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Test 1: Visual Regression Check ✅

### Goal
Verify that the new Canvas rendering produces **pixel-perfect identical** output to the original ImageData rendering.

### Steps

1. **Disable hardware rendering** (fallback to original):
   - Edit `src/components/MapRenderer.tsx`
   - Find line ~318: `const USE_HARDWARE_RENDERING = true;`
   - Change to: `const USE_HARDWARE_RENDERING = false;`
   - Save file (dev server will hot-reload)

2. **Capture reference screenshots**:
   - Navigate to these test maps:
     - Slateport City (palette 0 test)
     - Rustboro City (palette 3 test)
     - Fortree City (transparency test)
     - Route 119 (water reflection test)
   - Take screenshots at each location

3. **Enable hardware rendering**:
   - Change back to: `const USE_HARDWARE_RENDERING = true;`
   - Save file

4. **Capture comparison screenshots**:
   - Navigate to the SAME locations
   - Take screenshots

5. **Compare**:
   - Use any image diff tool (or just eyeball it)
   - Look for ANY color differences, missing tiles, or artifacts
   - **Expected result**: 100% identical (pixel-perfect match)

### What to Look For

#### ✅ Good (Should See)
- Identical colors
- Same tile positions
- Transparent areas match
- No missing tiles
- Same elevation rendering

#### ❌ Bad (Report Immediately)
- Color shifts (especially black or purple)
- Missing tiles
- Wrong transparency
- Flickering or artifacts

---

## Test 2: Performance Profiling 🚀

### Goal
Measure actual rendering speedup (should be 5-10× faster).

### Steps

1. **Open Chrome DevTools**:
   - Press `F12` or `Cmd+Option+I` (Mac)
   - Go to **Performance** tab

2. **Record with OLD rendering**:
   - Set `USE_HARDWARE_RENDERING = false`
   - Click **Record** button (●)
   - Scroll around the map for 10 seconds
   - Click **Stop**
   - Look for `renderPass` in the flame graph
   - Note the duration (should be ~8-15ms per call)

3. **Record with NEW rendering**:
   - Set `USE_HARDWARE_RENDERING = true`
   - Click **Record** button (●)
   - Scroll around the SAME map for 10 seconds
   - Click **Stop**
   - Look for `renderPassCanvas` in the flame graph
   - Note the duration (should be ~1-3ms per call)

4. **Compare**:
   - Calculate speedup: `oldTime / newTime`
   - Expected: **5-10× faster**

### What to Look For

#### Metrics to Check
- **Frame rate**: Should be stable 60 FPS
- **Main thread**: Less red (blocked) regions
- **Rendering time**: 1-3ms (down from 8-15ms)

#### Good Signs
- Smooth scrolling (no stutters)
- Lower CPU usage
- Stable 60 FPS

#### Bad Signs
- Frame drops
- Higher rendering time than expected
- Stuttering or lag

---

## Test 3: Edge Cases 🔍

### Goal
Verify that special rendering features still work correctly.

### Test Cases

#### A. Animated Tiles
1. Navigate to a map with flowers or water
2. Watch for animations
3. **Expected**: Flowers cycle through frames smoothly

#### B. Tile Flipping
1. Look for symmetrical structures (bridges, fences)
2. **Expected**: No visual glitches or mirror artifacts

#### C. Elevation Changes
1. Navigate to Fortree City (tree houses with bridges)
2. Walk across bridges at different elevations
3. **Expected**: Player correctly appears above/below bridge tiles

#### D. Transparency
1. Find trees or tall grass
2. **Expected**: Transparent pixels are truly transparent (no black boxes)

#### E. Map Transitions
1. Move between connected maps
2. **Expected**: No flashing, smooth transition

---

## Test 4: Console Check 🖥️

### Goal
Ensure no errors or warnings in the browser console.

### Steps

1. **Open Console**: `F12` → Console tab

2. **Look for these messages**:
   ```
   [PERF] Hardware-accelerated rendering enabled  ✅ Good
   [RENDER_DEBUG_CANVAS] ...                      ✅ Good (debug mode)
   Canvas renderer not initialized                ❌ BAD - Report this
   ```

3. **Check for errors**:
   - Red text = errors (report these!)
   - Yellow text = warnings (note but not critical)
   - Blue text = info (normal)

---

## Test 5: Mobile Testing 📱

### Goal
Verify performance improvement on mobile devices.

### Steps

1. **Enable mobile simulation**:
   - Chrome DevTools → Toggle device toolbar (Cmd+Shift+M)
   - Select "iPhone 12 Pro" or similar
   - Throttle CPU (4× slowdown)

2. **Test scrolling**:
   - Old rendering: Should be choppy (15-25 FPS)
   - New rendering: Should be smoother (40-60 FPS)

3. **Actual device** (optional):
   - Find local IP: `ifconfig` or `ipconfig`
   - Access `http://YOUR_IP:5173` from phone
   - Test scrolling performance

---

## Test 6: Browser Compatibility 🌐

### Goal
Ensure hardware rendering works across different browsers.

### Browsers to Test

#### Priority 1
- [x] Chrome/Edge (Chromium) - Primary target

#### Priority 2
- [ ] Firefox - Test rendering
- [ ] Safari (macOS) - Test rendering
- [ ] Safari (iOS) - Test on actual device

### What to Check
- Visual output matches
- Performance improvement is present
- No console errors

---

## Debug Mode 🐛

### Enable Detailed Logging

```javascript
// In browser console
window.DEBUG_MODE = true;
```

### Useful Console Commands

```javascript
// Check cache size
canvasRendererRef.current?.getCacheStats()
// Output: { size: 12, maxSize: 64 }

// Force feature toggle (for testing)
USE_HARDWARE_RENDERING = false;  // Won't work (const)
// Instead, edit the source file
```

---

## Reporting Issues 📝

### If You Find a Problem

1. **Visual regression**:
   - Take screenshots (old vs new)
   - Note the map and location
   - Describe what looks different

2. **Performance issue**:
   - Share DevTools Performance recording
   - Note frame rate and rendering times
   - Describe the scenario (map, action)

3. **Console errors**:
   - Copy the full error message
   - Note when it occurred (during what action)

4. **Browser/device info**:
   - Browser name and version
   - OS version
   - Device (if mobile)

### Expected Issues (Not bugs)

These are NORMAL and expected:
- Higher memory usage (~2-4 MB more) - This is the cache
- First frame slower - Generating palette canvases
- Cache size warnings - LRU eviction is working

---

## Success Criteria ✅

Before merging this optimization, we need:

1. ✅ **Zero visual regressions** (pixel-perfect match)
2. ✅ **5-10× rendering speedup** (measured)
3. ✅ **60 FPS during scrolling** (desktop)
4. ✅ **No console errors**
5. ✅ **Cross-browser compatibility**

---

## Quick Rollback 🔄

If any issues are found:

1. Edit `src/components/MapRenderer.tsx`
2. Change `const USE_HARDWARE_RENDERING = true;` → `false`
3. Save file
4. Problem instantly reverted to original rendering

---

## Next Phase (After Testing)

Once Phase 1 is verified:
- **Phase 2**: Implement backing store (chunk-based caching)
- **Expected gain**: Additional 10-50× speedup for scrolling

For now, focus on verifying this phase works correctly! 🎯



