#!/bin/bash

# Generate PNG icons from SVG for Chrome Web Store
# This script converts src/assets/icons/icon.svg to multiple PNG sizes

echo "🎨 Generating PNG icons from SVG..."

SVG_FILE="src/assets/icons/icon.svg"

# Check if SVG file exists
if [ ! -f "$SVG_FILE" ]; then
    echo "❌ Error: $SVG_FILE not found!"
    exit 1
fi

# Check if rsvg-convert is installed (best for SVG conversion)
if command -v rsvg-convert &> /dev/null; then
    echo "✅ Using rsvg-convert (librsvg)..."
    rsvg-convert -w 16 -h 16 "$SVG_FILE" -o icon16.png
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o icon32.png
    rsvg-convert -w 48 -h 48 "$SVG_FILE" -o icon48.png
    rsvg-convert -w 128 -h 128 "$SVG_FILE" -o icon128.png
    echo "✅ Done! Created icon16.png, icon32.png, icon48.png, icon128.png"
    exit 0
fi

# Check if Inkscape is installed
if command -v inkscape &> /dev/null; then
    echo "✅ Using Inkscape..."
    inkscape "$SVG_FILE" -w 16 -h 16 -o icon16.png 2>/dev/null
    inkscape "$SVG_FILE" -w 32 -h 32 -o icon32.png 2>/dev/null
    inkscape "$SVG_FILE" -w 48 -h 48 -o icon48.png 2>/dev/null
    inkscape "$SVG_FILE" -w 128 -h 128 -o icon128.png 2>/dev/null
    echo "✅ Done! Created icon16.png, icon32.png, icon48.png, icon128.png"
    exit 0
fi

# Check if ImageMagick 7 is installed
if command -v magick &> /dev/null; then
    echo "✅ Using ImageMagick 7..."
    magick "$SVG_FILE" -background none -resize 16x16 icon16.png 2>/dev/null
    magick "$SVG_FILE" -background none -resize 32x32 icon32.png 2>/dev/null
    magick "$SVG_FILE" -background none -resize 48x48 icon48.png 2>/dev/null
    magick "$SVG_FILE" -background none -resize 128x128 icon128.png 2>/dev/null
    
    # Check if conversion actually worked
    if [ -f icon16.png ] && [ -s icon16.png ]; then
        echo "✅ Done! Created icon16.png, icon32.png, icon48.png, icon128.png"
        exit 0
    else
        echo "⚠️  ImageMagick conversion failed (missing dependencies)"
    fi
fi

# Check if old ImageMagick convert is installed
if command -v convert &> /dev/null; then
    echo "⚠️  Found old ImageMagick but it's missing required dependencies (ghostscript)"
fi

# No working tool found
echo ""
echo "❌ Error: No suitable SVG converter found!"
echo ""
echo "📦 Install one of these (recommended order):"
echo "  1. librsvg (best): brew install librsvg"
echo "  2. Inkscape:       brew install --cask inkscape"
echo "  3. ImageMagick:    brew install imagemagick ghostscript"
echo ""
echo "🌐 Or use an online converter:"
echo "  • https://cloudconvert.com/svg-to-png"
echo "  • https://svgtopng.com/"
echo "  • https://svgomg.net/ (optimize then convert)"
exit 1
