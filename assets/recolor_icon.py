from PIL import Image

SRC = 'assets/icon-source.png'
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
bg.save(SRC)
bg.resize((1024, 1024), Image.LANCZOS).save(
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
print('icon regenerated', w, h)
