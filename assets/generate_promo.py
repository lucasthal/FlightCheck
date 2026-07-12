"""Generate 1024x1024 IAP promotional image for FlightCheck."""
from PIL import Image, ImageDraw
import math

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE))
draw = ImageDraw.Draw(img)

# --- Background: radial gradient from dark navy center to darker edges ---
bg_center = (23, 29, 38)     # #171D26
bg_edge = (10, 12, 16)       # #0A0C10
for y in range(SIZE):
    for x in range(SIZE):
        dx = (x - SIZE * 0.55) / SIZE
        dy = (y - SIZE * 0.4) / SIZE
        dist = min(1.0, math.sqrt(dx * dx + dy * dy) * 1.6)
        r = int(bg_center[0] + (bg_edge[0] - bg_center[0]) * dist)
        g = int(bg_center[1] + (bg_edge[1] - bg_center[1]) * dist)
        b = int(bg_center[2] + (bg_edge[2] - bg_center[2]) * dist)
        img.putpixel((x, y), (r, g, b, 255))

draw = ImageDraw.Draw(img)

# --- Subtle radial glow in upper-right area ---
glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
cx, cy = 620, 280
for radius in range(350, 0, -1):
    alpha = int(12 * (1 - radius / 350))
    glow_draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=(34, 211, 238, alpha)
    )
img = Image.alpha_composite(img, glow)
draw = ImageDraw.Draw(img)

# --- Aircraft silhouette (upper right, subtle) ---
def draw_aircraft(draw, cx, cy, scale, alpha):
    color = (148, 163, 184, alpha)
    pts = [(cx - 45*scale, cy), (cx - 20*scale, cy - 4*scale),
           (cx + 50*scale, cy - 3*scale), (cx + 55*scale, cy),
           (cx + 50*scale, cy + 3*scale), (cx - 20*scale, cy + 4*scale)]
    draw.polygon(pts, fill=color)
    wing_pts = [(cx - 5*scale, cy - 3*scale), (cx + 5*scale, cy - 3*scale),
                (cx + 10*scale, cy - 38*scale), (cx - 10*scale, cy - 38*scale)]
    draw.polygon(wing_pts, fill=color)
    wing_pts2 = [(cx - 5*scale, cy + 3*scale), (cx + 5*scale, cy + 3*scale),
                 (cx + 10*scale, cy + 38*scale), (cx - 10*scale, cy + 38*scale)]
    draw.polygon(wing_pts2, fill=color)
    tail_pts = [(cx - 38*scale, cy - 2*scale), (cx - 32*scale, cy - 2*scale),
                (cx - 28*scale, cy - 18*scale), (cx - 38*scale, cy - 18*scale)]
    draw.polygon(tail_pts, fill=color)
    tail_pts2 = [(cx - 38*scale, cy + 2*scale), (cx - 32*scale, cy + 2*scale),
                 (cx - 28*scale, cy + 18*scale), (cx - 38*scale, cy + 18*scale)]
    draw.polygon(tail_pts2, fill=color)

overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
overlay_draw = ImageDraw.Draw(overlay)
draw_aircraft(overlay_draw, 750, 200, 2.8, 25)
draw_aircraft(overlay_draw, 280, 820, 1.8, 15)
img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img)

# --- Checklist panel (centered) ---
panel_bg = (23, 29, 38, 180)   # #171D26 card
check_color = (34, 211, 238, 255)   # #22D3EE checkbox fill

panel_x, panel_y = 280, 260
panel_w, panel_h = 500, 480
panel_r = 24

panel_overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
panel_draw = ImageDraw.Draw(panel_overlay)
panel_draw.rounded_rectangle(
    [panel_x, panel_y, panel_x + panel_w, panel_y + panel_h],
    radius=panel_r, fill=panel_bg, outline=(51, 65, 85, 100), width=2
)
img = Image.alpha_composite(img, panel_overlay)

items_overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
items_draw = ImageDraw.Draw(items_overlay)

items = [
    {"checked": True, "width": 280},
    {"checked": True, "width": 220},
    {"checked": True, "width": 310},
    {"checked": True, "width": 250},
    {"checked": False, "width": 290},
    {"checked": False, "width": 200},
    {"checked": False, "width": 260},
]

start_y = panel_y + 50
row_height = 56
left_margin = panel_x + 40

for i, item in enumerate(items):
    y = start_y + i * row_height
    box_size = 22
    box_x = left_margin
    box_y = y + 2

    if item["checked"]:
        items_draw.rounded_rectangle(
            [box_x, box_y, box_x + box_size, box_y + box_size],
            radius=5, fill=check_color
        )
        cx, cy = box_x + box_size // 2, box_y + box_size // 2
        items_draw.line(
            [(cx - 5, cy + 1), (cx - 1, cy + 5), (cx + 6, cy - 4)],
            fill=(0, 0, 0, 255), width=3
        )
    else:
        items_draw.rounded_rectangle(
            [box_x, box_y, box_x + box_size, box_y + box_size],
            radius=5, fill=(0, 0, 0, 0), outline=(100, 116, 139, 150), width=2
        )

    line_y = y + 10
    line_x = left_margin + 38
    line_h = 8
    c = (139, 152, 169, 100) if item["checked"] else (90, 101, 117, 60)
    items_draw.rounded_rectangle(
        [line_x, line_y, line_x + item["width"], line_y + line_h],
        radius=4, fill=c
    )

    if i < len(items) - 1:
        sep_y = y + row_height - 6
        items_draw.line(
            [(left_margin, sep_y), (panel_x + panel_w - 40, sep_y)],
            fill=(51, 65, 85, 60), width=1
        )

img = Image.alpha_composite(img, items_overlay)

# --- Decorative elements ---
decor = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
decor_draw = ImageDraw.Draw(decor)

for r in range(48, 44, -1):
    alpha = int(30 * (48 - r) / 4)
    decor_draw.ellipse([140 - r, 180 - r, 140 + r, 180 + r],
                       outline=(34, 211, 238, alpha), width=2)

decor_draw.arc([200, -100, 860, 180], 20, 160, fill=(34, 211, 238, 30), width=2)

dots = [(180, 680, 4, 20), (200, 700, 3, 15), (160, 710, 5, 25),
        (820, 650, 3, 18), (850, 680, 4, 22), (870, 640, 3, 14)]
for dx, dy, dr, da in dots:
    decor_draw.ellipse([dx-dr, dy-dr, dx+dr, dy+dr], fill=(34, 211, 238, da))

img = Image.alpha_composite(img, decor)

# --- Final: convert to RGB ---
final = Image.new("RGB", (SIZE, SIZE), (10, 12, 16))
final.paste(img, mask=img.split()[3])

out_path = r"C:\Users\Louie\.local\bin\PilotChecklist\assets\iap-promo-1024.png"
final.save(out_path, "PNG", optimize=True)
print(f"Saved to {out_path}")
print(f"Size: {final.size}")
