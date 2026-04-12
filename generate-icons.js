const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

async function generateIcons() {
  for (const { name, size } of sizes) {
    const dir = path.join(__dirname, 'android/app/src/main/res', name);
    
    await sharp('icon.svg')
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    await sharp('icon.svg')
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`Generated ${name} (${size}x${size})`);
  }
  console.log('All icons generated!');
}

generateIcons().catch(console.error);
