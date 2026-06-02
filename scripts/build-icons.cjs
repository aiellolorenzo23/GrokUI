/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const png2icons = require('png2icons')

const root = path.resolve(__dirname, '..')
const resourcesDir = path.join(root, 'resources')
const buildDir = path.join(root, 'build')
const sourceSvg = path.join(resourcesDir, 'icon.svg')
const sourceLogoSvg = path.join(resourcesDir, 'logo.svg')
const whiteSvg = path.join(resourcesDir, 'icon-white.svg')
const whiteLogoSvg = path.join(resourcesDir, 'logo-white.svg')
const pngPath = path.join(buildDir, 'icon.png')
const icoPath = path.join(buildDir, 'icon.ico')
const icnsPath = path.join(buildDir, 'icon.icns')

function makeWhiteSvg(svg) {
  return svg
    .replace(/fill="currentColor"/g, 'fill="#ffffff"')
    .replace(/class="[^"]*"/g, '')
    .replace(/data-cur="[^"]*"/g, '')
}

async function main() {
  fs.mkdirSync(buildDir, { recursive: true })

  const whiteIconSvg = makeWhiteSvg(fs.readFileSync(sourceSvg, 'utf-8'))
  fs.writeFileSync(whiteSvg, whiteIconSvg, 'utf-8')
  fs.writeFileSync(whiteLogoSvg, makeWhiteSvg(fs.readFileSync(sourceLogoSvg, 'utf-8')), 'utf-8')

  const png = await sharp(Buffer.from(whiteIconSvg))
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  fs.writeFileSync(pngPath, png)

  const ico = png2icons.createICO(png, png2icons.BICUBIC2, 0, false, true)
  const icns = png2icons.createICNS(png, png2icons.BICUBIC2, 0)

  if (!ico || !icns) {
    throw new Error('Icon conversion failed')
  }

  fs.writeFileSync(icoPath, ico)
  fs.writeFileSync(icnsPath, icns)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
