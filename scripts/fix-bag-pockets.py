#!/usr/bin/env python3
"""
Fix bag-icon-pockets.png spacing

Takes a 1-row × 8-column spritesheet with inconsistent spacing,
detects each icon, and repacks with 1px padding on all sides.
Uses the (0,0) pixel color as transparent.
"""

from PIL import Image
import numpy as np
from pathlib import Path
import sys

COLS = 8
PADDING = 1  # 1 empty pixel on each side


def get_transparent_color(img):
    """Get the color at (0,0) to use as transparent."""
    return img.getpixel((0, 0))


def find_icon_columns(img_array, bg_color):
    """Find column boundaries for each icon by detecting non-background pixels."""
    height, width = img_array.shape[:2]

    # Create mask of non-background pixels
    if len(bg_color) == 3:
        bg = np.array(bg_color)
        is_content = np.any(img_array[:, :, :3] != bg, axis=2)
    else:
        bg = np.array(bg_color)
        is_content = np.any(img_array != bg, axis=2)

    # Find columns with content
    col_has_content = np.any(is_content, axis=0)

    # Find transitions from no-content to content and vice versa
    icons = []
    in_icon = False
    start_x = 0

    for x in range(width):
        if col_has_content[x] and not in_icon:
            start_x = x
            in_icon = True
        elif not col_has_content[x] and in_icon:
            icons.append((start_x, x))
            in_icon = False

    if in_icon:
        icons.append((start_x, width))

    return icons


def find_icon_bounds(img_array, x_start, x_end, bg_color):
    """Find the exact bounding box of an icon."""
    height = img_array.shape[0]
    region = img_array[:, x_start:x_end]

    # Create mask of non-background pixels
    if len(bg_color) == 3:
        bg = np.array(bg_color)
        is_content = np.any(region[:, :, :3] != bg, axis=2)
    else:
        bg = np.array(bg_color)
        is_content = np.any(region != bg, axis=2)

    rows = np.any(is_content, axis=1)
    cols = np.any(is_content, axis=0)

    if not np.any(rows) or not np.any(cols):
        return None

    y_min = np.argmax(rows)
    y_max = len(rows) - np.argmax(rows[::-1])
    x_min = np.argmax(cols)
    x_max = len(cols) - np.argmax(cols[::-1])

    return (x_start + x_min, y_min, x_start + x_max, y_max)


def extract_icon(img, bounds):
    """Extract an icon from the image."""
    x_min, y_min, x_max, y_max = bounds
    return img.crop((x_min, y_min, x_max, y_max))


def make_transparent(img, bg_color):
    """Convert background color to transparent."""
    img_rgba = img.convert('RGBA')
    data = np.array(img_rgba)

    # Find pixels matching background color
    if len(bg_color) == 3:
        bg = np.array(bg_color)
        mask = np.all(data[:, :, :3] == bg, axis=2)
    else:
        bg = np.array(bg_color[:3])
        mask = np.all(data[:, :, :3] == bg, axis=2)

    # Set alpha to 0 for background pixels
    data[mask, 3] = 0

    return Image.fromarray(data)


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} fix <image_path>")
        sys.exit(1)

    command = sys.argv[1]
    input_path = Path(sys.argv[2])

    if command != 'fix':
        print(f"Unknown command: {command}")
        sys.exit(1)

    print(f"Loading {input_path}")
    img = Image.open(input_path)
    print(f"Original size: {img.width}×{img.height}")
    print(f"Mode: {img.mode}")

    # Get transparent color from (0,0)
    bg_color = get_transparent_color(img)
    print(f"Background color (0,0): {bg_color}")

    # Convert to array for analysis
    img_array = np.array(img)

    # Find all icon column ranges
    icon_cols = find_icon_columns(img_array, bg_color)
    print(f"Found {len(icon_cols)} icon regions")

    # Get exact bounds for each icon
    icons = []
    max_width = 0
    max_height = 0

    for i, (x_start, x_end) in enumerate(icon_cols):
        bounds = find_icon_bounds(img_array, x_start, x_end, bg_color)
        if bounds:
            x_min, y_min, x_max, y_max = bounds
            w = x_max - x_min
            h = y_max - y_min
            max_width = max(max_width, w)
            max_height = max(max_height, h)
            icons.append(bounds)
            print(f"  Icon {i}: bounds=({x_min},{y_min})-({x_max},{y_max}), size={w}×{h}")

    print(f"Max icon size: {max_width}×{max_height}")

    # Calculate cell size (icon + padding on all sides)
    cell_width = max_width + PADDING * 2
    cell_height = max_height + PADDING * 2

    print(f"Cell size with padding: {cell_width}×{cell_height}")

    # Create output image
    output_width = len(icons) * cell_width
    output_height = cell_height
    output = Image.new('RGBA', (output_width, output_height), (0, 0, 0, 0))

    print(f"Output size: {output_width}×{output_height}")

    # Extract each icon, make transparent, and place centered in cell
    for i, bounds in enumerate(icons):
        icon = extract_icon(img, bounds)
        icon_transparent = make_transparent(icon, bg_color)

        # Center icon in cell
        icon_w, icon_h = icon_transparent.size
        paste_x = i * cell_width + PADDING + (max_width - icon_w) // 2
        paste_y = PADDING + (max_height - icon_h) // 2

        output.paste(icon_transparent, (paste_x, paste_y), icon_transparent)

    # Save
    print(f"Saving to {input_path}")
    output.save(input_path)
    print("Done!")


if __name__ == '__main__':
    main()
