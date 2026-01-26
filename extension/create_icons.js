// Simple script to create placeholder icons using canvas
// This would normally be run in Node.js with canvas package
// For now, we'll create SVG icons

const fs = require('fs');

const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size / 8}" fill="url(#grad)"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-size="${size * 0.6}" font-weight="bold" font-family="Arial">✍</text>
</svg>`;
  
  console.log(`Icon ${size}x${size} would be: icon${size}.png`);
  console.log(svg);
});
