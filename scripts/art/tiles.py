import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'room')
OUT = os.path.join(ROOT, 'public', 'art')

SHEET = Image.open(os.path.join(SRC, 'Room.png')).convert('RGBA')
TORCH = Image.open(os.path.join(SRC, 'TorchAnimation.png')).convert('RGBA')

BOXES = {
    'brick_dark': (8, 168, 120, 312),
    'brick_moss': (0, 320, 128, 384),
    'brick_moss_dim': (0, 384, 128, 448),
    'cornice': (0, 96, 107, 122),
    'crenel': (0, 0, 107, 30),
    'vault': (128, 100, 256, 160),
    'pillar_stone_a': (224, 162, 256, 320),
    'pillar_stone_b': (352, 158, 384, 320),
    'pillar_wood_a': (288, 162, 320, 320),
    'pillar_wood_b': (416, 158, 448, 320),
    'arch_open': (193, 371, 255, 459),
    'door_wood': (257, 371, 319, 459),
    'crate_big': (321, 414, 383, 458),
    'crate_small': (385, 429, 415, 458),
    'urn_tall': (420, 420, 446, 458),
    'urn_lid': (450, 423, 478, 458),
    'pot': (482, 425, 511, 458),
    'banner_red': (129, 478, 158, 543),
    'banner_tattered': (161, 478, 190, 522),
    'banner_gold': (193, 478, 222, 543),
    'bush': (578, 4, 640, 31),
    'rubble_grey': (290, 34, 350, 95),
    'rubble_brown': (418, 34, 478, 95),
    'niche': (258, 30, 318, 95)
}

_cache = {}


def tile(name):
    if name not in _cache:
        _cache[name] = SHEET.crop(BOXES[name])
    return _cache[name]


def scale2(img):
    return img.resize((img.width * 2, img.height * 2), Image.NEAREST)


def save(img, name, double=True):
    os.makedirs(OUT, exist_ok=True)
    out = scale2(img) if double else img
    out.save(os.path.join(OUT, name))
    return out


def tile_area(canvas, src, x0, y0, x1, y1):
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            canvas.alpha_composite(src, (x, y))
            x += src.width
        y += src.height


def paste(canvas, src, x, y):
    canvas.alpha_composite(src, (int(x), int(y)))


def paste_floor(canvas, src, x, floor_y, sink=0):
    canvas.alpha_composite(src, (int(x), int(floor_y - src.height + sink)))


def tint(img, rgb, amount):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (
                min(255, int(r + (rgb[0] - r) * amount)),
                min(255, int(g + (rgb[1] - g) * amount)),
                min(255, int(b + (rgb[2] - b) * amount)),
                a
            )
    return out


def brighten(img, factor):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (min(255, int(r * factor)), min(255, int(g * factor)), min(255, int(b * factor)), a)
    return out


PALETTE = {
    'void': (7, 10, 15),
    'stone': (58, 82, 90),
    'stone_lit': (108, 138, 146),
    'stone_dark': (30, 44, 51),
    'mortar': (22, 32, 38),
    'wood': (124, 92, 48),
    'wood_lit': (168, 130, 72),
    'bone': (222, 214, 190),
    'gold': (214, 172, 74),
    'gold_lit': (246, 214, 122),
    'ember': (226, 96, 52),
    'ember_lit': (252, 166, 84),
    'moss': (86, 168, 118),
    'moss_lit': (140, 214, 158),
    'frost': (128, 200, 226),
    'violet': (146, 106, 190),
    'blood': (154, 52, 52),
    'ink': (12, 14, 20)
}
