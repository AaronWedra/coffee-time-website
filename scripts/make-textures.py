"""Draws the site's seamless background textures and the 3D box faces. Run: python3 scripts/make-textures.py"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'public/img/'
random.seed(7)
rnd = random.Random(11)

def save(im, name, q=80):
    im.convert('RGB').save(OUT + name, quality=q, method=6)

def tile3(draw_fn, size, bg, ss=2):
    """Draw at supersample, wrapping every shape across the tile edges so the tile repeats seamlessly."""
    S = size * ss
    im = Image.new('RGB', (S, S), bg)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_fn(d, S, ss)
    return im.resize((size, size), Image.LANCZOS)

def bean_layer(size, base, hi, crease, n, scale, jitter_col=18):
    S = size * 2
    im = Image.new('RGB', (S, S), base)
    g = int(n ** .5)
    for i in range(g * g):
        cx = (i % g + .5 + rnd.uniform(-.3, .3)) / g * S + (S / g / 2 if (i // g) % 2 else 0)
        cy = (i // g + .5 + rnd.uniform(-.3, .3)) / g * S
        ang = rnd.uniform(0, 360)
        w = scale * 2 * rnd.uniform(.9, 1.1); h = w * .68
        # one bean sprite
        spr = Image.new('RGBA', (int(w * 1.4), int(w * 1.4)), (0, 0, 0, 0))
        sd = ImageDraw.Draw(spr)
        c = spr.size[0] / 2
        k = rnd.randint(-jitter_col, jitter_col)
        col = tuple(max(0, min(255, v + k)) for v in base)
        sd.ellipse((c - w / 2, c - h / 2, c + w / 2, c + h / 2), fill=col + (255,), outline=tuple(int(v * .55) for v in col) + (255,), width=max(2, int(scale * .09)))
        sd.ellipse((c - w * .42, c - h * .46, c + w * .1, c - h * .05), fill=hi + (150,))
        pts = [(c - w * .42, c + math.sin(t / 8 * math.pi) * h * .12 * 1 + 0) for t in range(0)]
        # S shaped crease down the middle
        cp = []
        for i in range(0, 21):
            t = i / 20
            x = c - w * .46 + t * w * .92
            y = c + math.sin(t * math.pi * 2) * h * .14
            cp.append((x, y))
        sd.line(cp, fill=crease + (255,), width=max(3, int(scale * .12)), joint='curve')
        spr = spr.rotate(ang, resample=Image.BICUBIC)
        for dx in (-S, 0, S):
            for dy in (-S, 0, S):
                im.paste(spr, (int(cx + dx - spr.size[0] / 2), int(cy + dy - spr.size[1] / 2)), spr)
    return im.resize((size, size), Image.LANCZOS)

def sprinkles(size, bg):
    S = size * 2
    im = Image.new('RGB', (S, S), bg)
    cols = [(255, 79, 123), (255, 217, 58), (110, 231, 255), (126, 224, 47), (255, 138, 61), (255, 255, 255), (190, 120, 255)]
    for _ in range(190):
        cx, cy = rnd.uniform(0, S), rnd.uniform(0, S)
        L, W = 46, 15
        spr = Image.new('RGBA', (70, 70), (0, 0, 0, 0)); sd = ImageDraw.Draw(spr)
        col = rnd.choice(cols)
        sd.rounded_rectangle((12, 27, 12 + L, 27 + W), radius=8, fill=col + (255,))
        sd.rounded_rectangle((16, 29, 12 + L - 6, 32), radius=2, fill=(255, 255, 255, 110))
        spr = spr.rotate(rnd.uniform(0, 360), resample=Image.BICUBIC)
        for dx in (-S, 0, S):
            for dy in (-S, 0, S):
                im.paste(spr, (int(cx + dx - 35), int(cy + dy - 35)), spr)
    return im.resize((size, size), Image.LANCZOS)

def rings(size, bg):
    S = size * 2
    im = Image.new('RGB', (S, S), bg); d = ImageDraw.Draw(im, 'RGBA')
    for _ in range(11):
        cx, cy, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(70, 150)
        a = rnd.randint(40, 80)
        for dx in (-S, 0, S):
            for dy in (-S, 0, S):
                x, y = cx + dx, cy + dy
                for k in range(5):
                    d.ellipse((x - r - k, y - r - k, x + r + k, y + r + k), outline=(30, 12, 4, a - k * 8), width=3)
                d.ellipse((x - r * .94, y - r * .94, x + r * .94, y + r * .94), fill=(255, 190, 120, 10))
                for _ in range(8):
                    a2 = rnd.uniform(0, 6.28); rr = r + rnd.uniform(8, 40); sr = rnd.uniform(2, 7)
                    d.ellipse((x + math.cos(a2) * rr - sr, y + math.sin(a2) * rr - sr, x + math.cos(a2) * rr + sr, y + math.sin(a2) * rr + sr), fill=(30, 12, 4, a))
    return im.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(.6))

def clocks(size, bg, line):
    S = size * 2
    im = Image.new('RGB', (S, S), bg); d = ImageDraw.Draw(im, 'RGBA')
    centers = [(S * .25, S * .25, S * .2), (S * .75, S * .25, S * .13), (S * .25, S * .75, S * .13), (S * .75, S * .75, S * .2), (S * .5, S * .5, S * .09)]
    for cx, cy, r in centers:
        for dx in (-S, 0, S):
            for dy in (-S, 0, S):
                x, y = cx + dx, cy + dy
                d.ellipse((x - r, y - r, x + r, y + r), outline=line + (150,), width=5)
                d.ellipse((x - r * .9, y - r * .9, x + r * .9, y + r * .9), outline=line + (70,), width=2)
                for h in range(12):
                    a = h / 12 * 6.2832
                    d.line((x + math.cos(a) * r * .8, y + math.sin(a) * r * .8, x + math.cos(a) * r * .9, y + math.sin(a) * r * .9), fill=line + (170,), width=4)
                ha = rnd.uniform(0, 6.28)
                d.line((x, y, x + math.cos(ha) * r * .5, y + math.sin(ha) * r * .5), fill=line + (190,), width=6)
                d.line((x, y, x + math.cos(ha + 2) * r * .72, y + math.sin(ha + 2) * r * .72), fill=line + (190,), width=4)
                d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=line + (200,))
    return im.resize((size, size), Image.LANCZOS)

def marble(size, c1, c2, c3, seed, warp=1.0):
    """Periodic domain-warped swirl, tileable: every term is a whole number of cycles."""
    rs = np.random.RandomState(seed)
    y, x = np.mgrid[0:size, 0:size] / size * 2 * np.pi
    wx = np.zeros_like(x); wy = np.zeros_like(x)
    for i in range(1, 4):
        wx += np.sin(y * i + rs.rand() * 6) * (.9 / i) * warp
        wy += np.sin(x * i + rs.rand() * 6) * (.9 / i) * warp
    v = np.sin((x + wx) * 2 + np.sin((y + wy) * 3) * 1.4) + np.sin((y + wy) * 2 + (x + wx))
    v = (v - v.min()) / (v.max() - v.min())
    v2 = np.sin(v * 9 + (x + y)) * .5 + .5
    c1, c2, c3 = [np.array(c, float) for c in (c1, c2, c3)]
    t = v[..., None]
    img = c1 * (1 - t) + c2 * t
    veins = (np.abs(np.sin(v * 14)) ** 18)[..., None]
    img = img * (1 - veins * .55) + c3 * veins * .55
    return Image.fromarray(np.clip(img, 0, 255).astype('uint8'))

# ---- tiles
save(bean_layer(300, (58, 32, 18), (130, 84, 52), (22, 10, 4), 36, 58), 'tex-beans-brown.webp')
save(bean_layer(300, (62, 24, 108), (150, 90, 210), (24, 6, 48), 36, 58, 10), 'tex-beans-purple.webp')
save(sprinkles(320, (58, 20, 100)), 'tex-sprinkles.webp')
save(rings(420, (88, 52, 32)), 'tex-rings.webp')
save(clocks(420, (52, 14, 92), (190, 130, 255)), 'tex-clocks.webp')
save(marble(512, (76, 22, 128), (166, 70, 214), (255, 214, 250), 3), 'tex-marble-purple.webp')
save(marble(512, (44, 22, 12), (150, 96, 58), (255, 232, 200), 9, 1.2), 'tex-latte.webp')
save(marble(512, (236, 150, 80), (255, 214, 160), (255, 255, 255), 5), 'tex-peach.webp')

# ---- a single transparent bean for the falling-beans effect
S = 260
spr = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(spr)
w, h, c = 200, 136, S / 2
for i in range(20):
    k = i / 19
    col = (int(46 + 40 * k), int(24 + 28 * k), int(12 + 18 * k), 255)
    sd.ellipse((c - w / 2 + i * .8, c - h / 2 + i * .8, c + w / 2 - i * .8, c + h / 2 - i * .8), fill=col)
sd.ellipse((c - w * .38, c - h * .44, c + w * .05, c - h * .1), fill=(190, 140, 100, 120))
cp = [(c - w * .46 + t / 20 * w * .92, c + math.sin(t / 20 * math.pi * 2) * h * .14) for t in range(21)]
sd.line(cp, fill=(14, 6, 2, 255), width=9, joint='curve')
spr = spr.rotate(-18, resample=Image.BICUBIC).resize((130, 130), Image.LANCZOS)
spr.save(OUT + 'bean.webp', quality=90, lossless=False, method=6)

# ---- 3D box faces cut from the printed dieline
d = Image.open(OUT + 'box-cover.webp').convert('RGB')
d.crop((197, 192, 1603, 908)).save(OUT + 'box-top.webp', quality=88)
d.crop((197, 908, 1603, 1096)).save(OUT + 'box-front.webp', quality=88)
d.crop((197, 4, 1603, 190)).save(OUT + 'box-back.webp', quality=88)
d.crop((10, 192, 192, 908)).save(OUT + 'box-left.webp', quality=88)
d.crop((1608, 192, 1790, 908)).save(OUT + 'box-right.webp', quality=88)
print('ok')

# ---- star tiles for the animated space background (transparent, 1024px, repeat on both axes)
def stars(name, n, rmin, rmax, glow, cols):
    T = 1024
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    r2 = random.Random(hash(name) & 0xffff)
    for _ in range(n):
        x, y, r = r2.uniform(0, T), r2.uniform(0, T), r2.uniform(rmin, rmax)
        col = r2.choice(cols)
        layer = Image.new('RGBA', (int(r * 12) + 8, int(r * 12) + 8), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer); c = layer.size[0] / 2
        if glow:
            for k in range(8, 0, -1):
                ld.ellipse((c - r * k, c - r * k, c + r * k, c + r * k), fill=col + (int(10 + 3 * (9 - k)),))
        ld.ellipse((c - r, c - r, c + r, c + r), fill=col + (255,))
        if glow and r > 1.6:
            ld.line((c - r * 5, c, c + r * 5, c), fill=col + (140,), width=1)
            ld.line((c, c - r * 5, c, c + r * 5), fill=col + (140,), width=1)
        for dx in (-T, 0, T):
            for dy in (-T, 0, T):
                im.alpha_composite(layer, (max(0, int(x + dx - c)), max(0, int(y + dy - c)))) if 0 <= x + dx < T and 0 <= y + dy < T else None
    im.save(OUT + name, quality=90, method=6)
W = [(255, 255, 255), (255, 244, 190), (255, 200, 230), (190, 240, 255)]
stars('stars-a.webp', 260, .7, 1.1, False, W)
stars('stars-b.webp', 70, 1.2, 2.0, True, W)
stars('stars-c.webp', 14, 2.2, 3.2, True, [(255, 242, 69), (255, 255, 255), (255, 138, 61)])
print('stars ok')
