#!/usr/bin/env python3
"""
Fix menu-icons.png spacing

Detects individual icons in the sprite sheet and repacks them
into a proper 50x250 grid (2 columns × 10 rows × 25px icons).
"""

from PIL import Image
import numpy as np
from pathlib import Path

INPUT_PATH = Path(__file__).parent.parent / "public/img/menu-icons.png"
OUTPUT_PATH = INPUT_PATH  # Overwrite original

ICON_SIZE = 25
COLS = 2
ROWS = 10
OUTPUT_WIDTH = COLS * ICON_SIZE   # 50
OUTPUT_HEIGHT = ROWS * ICON_SIZE  # 250


def find_icon_bounds(img_array, start_y, end_y, start_x, end_x):
    """Find the bounding box of non-transparent pixels in a region."""
    region = img_array[start_y:end_y, start_x:end_x]

    # Find non-transparent pixels (alpha > 0)
    if region.shape[2] == 4:
        non_transparent = region[:, :, 3] > 10
    else:
        # If no alpha, find non-white pixels
        non_transparent = np.any(region < 250, axis=2)

    rows = np.any(non_transparent, axis=1)
    cols = np.any(non_transparent, axis=0)

    if not np.any(rows) or not np.any(cols):
        return None

    y_min = np.argmax(rows)
    y_max = len(rows) - np.argmax(rows[::-1])
    x_min = np.argmax(cols)
    x_max = len(cols) - np.argmax(cols[::-1])

    return (start_x + x_min, start_y + y_min, start_x + x_max, start_y + y_max)


def find_all_icons(img):
    """Find all icons by scanning for content regions."""
    img_array = np.array(img)
    height, width = img_array.shape[:2]

    icons = []
    col_width = width // COLS

    # Scan each column
    for col in range(COLS):
        col_start = col * col_width
        col_end = (col + 1) * col_width

        # Find content rows in this column
        y = 0
        while y < height:
            # Look for start of content
            found_content = False
            content_start = y

            for scan_y in range(y, height):
                row_region = img_array[scan_y, col_start:col_end]
                if row_region.shape[-1] == 4:
                    has_content = np.any(row_region[:, 3] > 10)
                else:
                    has_content = np.any(row_region < 250)

                if has_content:
                    if not found_content:
                        content_start = scan_y
                        found_content = True
                elif found_content:
                    # End of content block
                    bounds = find_icon_bounds(img_array, content_start, scan_y, col_start, col_end)
                    if bounds:
                        icons.append((col, bounds))
                    y = scan_y
                    break
            else:
                # Reached end of image
                if found_content:
                    bounds = find_icon_bounds(img_array, content_start, height, col_start, col_end)
                    if bounds:
                        icons.append((col, bounds))
                break

            y += 1

    return icons


def extract_and_center_icon(img, bounds, size=ICON_SIZE):
    """Extract icon and center it in a size×size box."""
    x_min, y_min, x_max, y_max = bounds
    icon_width = x_max - x_min
    icon_height = y_max - y_min

    # Extract the icon
    icon = img.crop((x_min, y_min, x_max, y_max))

    # Create centered output
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # Center the icon
    paste_x = (size - icon_width) // 2
    paste_y = (size - icon_height) // 2

    output.paste(icon, (paste_x, paste_y))
    return output


def main():
    print(f"Loading {INPUT_PATH}")
    img = Image.open(INPUT_PATH).convert('RGBA')
    print(f"Original size: {img.width}×{img.height}")

    # Find all icons
    icons_found = find_all_icons(img)
    print(f"Found {len(icons_found)} icons")

    # Sort by column, then by y position
    icons_found.sort(key=lambda x: (x[0], x[1][1]))

    # Debug: print found positions
    for i, (col, bounds) in enumerate(icons_found):
        x_min, y_min, x_max, y_max = bounds
        print(f"  Icon {i}: col={col}, bounds=({x_min},{y_min})-({x_max},{y_max}), size={x_max-x_min}×{y_max-y_min}")

    # Separate by column
    col0_icons = [b for c, b in icons_found if c == 0]
    col1_icons = [b for c, b in icons_found if c == 1]

    print(f"Column 0: {len(col0_icons)} icons")
    print(f"Column 1: {len(col1_icons)} icons")

    # Create output image
    output = Image.new('RGBA', (OUTPUT_WIDTH, OUTPUT_HEIGHT), (0, 0, 0, 0))

    # Place icons
    for row in range(ROWS):
        # Column 0
        if row < len(col0_icons):
            icon = extract_and_center_icon(img, col0_icons[row])
            output.paste(icon, (0, row * ICON_SIZE))

        # Column 1
        if row < len(col1_icons):
            icon = extract_and_center_icon(img, col1_icons[row])
            output.paste(icon, (ICON_SIZE, row * ICON_SIZE))

    # Save
    print(f"Saving to {OUTPUT_PATH}")
    print(f"New size: {output.width}×{output.height}")
    output.save(OUTPUT_PATH)
    print("Done!")


if __name__ == '__main__':
    main()
