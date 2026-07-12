"""Regenerate brand assets from the master mark in icon-only.png.

- App icon: white mark preserved exactly, amber->orange gradient replaced
  with the glass palette gradient (cyan top-left -> deep teal bottom-right).
- logo-mark.png: the white mark alone on transparency, for the in-app logo.
"""
from PIL import Image

SRC = 'assets/icon-only.png'
TOP = (0x22, 0xD3, 0xEE)   # cyan
BOT = (0x0E, 0x74, 0x90)   # deep teal

src = Image.open(SRC).convert('RGB')
w, h = src.size

# Diagonal gradient built small then upscaled for smoothness
g = Image.new('RGB', (256, 256))
px = g.load()
for y in range(256):
    for x in range(256):
        t = (x + y) / 510
        px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOT))
bg = g.resize((w, h), Image.BICUBIC)

# White-mark alpha from the blue channel (bg orange: low blue; mark: 255)
b = src.split()[2]
alpha = b.point(lambda v: 0 if v < 120 else min(255, round((v - 120) * 255 / 135)))
white = Image.new('RGB', (w, h), (255, 255, 255))
bg.paste(white, (0, 0), alpha)
bg.save('assets/icon-source.png')
bg.resize((1024, 1024), Image.LANCZOS).save(
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

# In-app logo: white mark on transparency, full canvas so proportions
# inside the app's gradient tile match the home-screen icon exactly
mark = Image.new('RGBA', (w, h), (255, 255, 255, 0))
mark.paste(white, (0, 0), alpha)
mark.resize((512, 512), Image.LANCZOS).save('src/assets/logo-mark.png')
print('regenerated: icon-source.png, AppIcon-512@2x.png, logo-mark.png from', SRC, (w, h))
