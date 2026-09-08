from PIL import Image
from tiles import OUT, PALETTE, brighten, paste, save, tile, tile_area, tint

W = 256
H = 464
FLOOR = 364
CEIL = 30
LEDGE = 214


def tall(name, height):
    src = tile(name)
    cap = src.crop((0, 0, src.width, 26))
    base = src.crop((0, src.height - 30, src.width, src.height))
    shaft = src.crop((0, 40, src.width, 40 + 24))
    col = Image.new('RGBA', (src.width, height), (0, 0, 0, 0))
    y = height - base.height
    col.alpha_composite(base, (0, y))
    while y > cap.height:
        y -= shaft.height
        col.alpha_composite(shaft, (0, max(cap.height, y)))
    col.alpha_composite(cap, (0, 0))
    return col


def band(c, name, y, x0=0, x1=W, flip=False):
    src = tile(name)
    if flip:
        src = src.transpose(Image.FLIP_TOP_BOTTOM)
    x = x0
    while x < x1:
        paste(c, src, x, y)
        x += src.width


def shell(floor_tile='brick_moss'):
    c = Image.new('RGBA', (W, H), PALETTE['void'] + (255,))
    tile_area(c, tile('brick_dark'), 0, -60, W, FLOOR)
    tile_area(c, tile(floor_tile), 0, FLOOR, W, H)
    band(c, 'cornice', 0, flip=True)
    band(c, 'crenel', FLOOR - 24)
    return c


def on_floor(c, name, x, sink=0):
    src = tile(name)
    paste(c, src, x, FLOOR - src.height + sink)


def on_ledge(c, name, x, y):
    src = tile(name)
    paste(c, src, x, y - src.height)


def pillar(c, name, x):
    col = tall(name, FLOOR - CEIL + 6)
    paste(c, col, x, CEIL - 4)


def vignette(c, top=0.45, bottom=1.0, left=1.0, right=1.0):
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = g.load()
    for y in range(H):
        fy = top + (bottom - top) * (y / (H - 1))
        for x in range(W):
            fx = left + (right - left) * (x / (W - 1))
            a = max(0, min(255, int(255 - 255 * fy * fx)))
            px[x, y] = (2, 4, 8, a)
    c.alpha_composite(g)
    return c


def entrance():
    c = shell()
    band(c, 'bush', 2, 0, W)
    on_floor(c, 'crate_big', 176)
    on_floor(c, 'urn_tall', 146)
    on_floor(c, 'pot', 24)
    paste(c, tile('rubble_grey'), 6, 96)
    c = brighten(c, 1.35)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = glow.load()
    for x in range(W):
        f = max(0.0, 1.0 - x / (W * 0.8))
        for y in range(H):
            px[x, y] = (255, 234, 190, int(215 * f * f * (1.0 - 0.3 * y / H)))
    c.alpha_composite(glow)
    dark = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = dark.load()
    for x in range(W):
        f = max(0.0, (x - W * 0.5) / (W * 0.5))
        for y in range(H):
            px[x, y] = (3, 5, 10, int(190 * f * f))
    c.alpha_composite(dark)
    return c


def hall_pillars():
    c = shell()
    pillar(c, 'pillar_stone_a', 16)
    pillar(c, 'pillar_stone_b', W - 48)
    paste(c, tile('banner_red'), 100, CEIL + 6)
    on_floor(c, 'crate_big', 66)
    on_floor(c, 'urn_lid', 160)
    return vignette(c, 0.5, 1.0)


def hall_ledge():
    c = shell('brick_moss_dim')
    band(c, 'crenel', LEDGE, 40, W - 30)
    on_ledge(c, 'urn_tall', 70, LEDGE + 4)
    on_ledge(c, 'pot', 130, LEDGE + 4)
    paste(c, tile('banner_gold'), 12, CEIL)
    paste(c, tile('banner_gold'), W - 42, CEIL)
    pillar(c, 'pillar_wood_a', 190)
    on_floor(c, 'crate_small', 46)
    on_floor(c, 'urn_lid', 96)
    return vignette(c, 0.55, 1.0)


def hall_arch():
    c = shell()
    arch = tile('arch_open')
    paste(c, arch, 46, FLOOR - arch.height - 20)
    band(c, 'crenel', FLOOR - 24, 20, 140)
    pillar(c, 'pillar_stone_b', W - 52)
    paste(c, tile('niche'), 152, 78)
    on_floor(c, 'urn_tall', 158)
    on_floor(c, 'crate_small', 200)
    return vignette(c, 0.42, 0.95)


def hall_ruin():
    c = shell('brick_moss_dim')
    paste(c, tile('rubble_brown'), 24, 120)
    paste(c, tile('rubble_grey'), W - 74, 64)
    paste(c, tile('banner_tattered'), 110, CEIL + 10)
    pillar(c, 'pillar_wood_b', 88)
    on_floor(c, 'crate_big', 150)
    on_floor(c, 'pot', 26)
    return vignette(c, 0.4, 0.92)


def hall_deep():
    c = shell()
    pillar(c, 'pillar_wood_a', 24)
    pillar(c, 'pillar_wood_b', 116)
    pillar(c, 'pillar_stone_a', W - 44)
    paste(c, tile('banner_red'), 70, CEIL + 4)
    paste(c, tile('banner_red'), 168, CEIL + 4)
    on_floor(c, 'urn_lid', 66)
    on_floor(c, 'urn_tall', 190)
    return vignette(c, 0.3, 0.85)


def throne():
    c = shell()
    v = tile('vault')
    paste(c, v, (W - v.width) // 2, 6)
    pillar(c, 'pillar_stone_a', 14)
    pillar(c, 'pillar_stone_b', W - 46)
    pillar(c, 'pillar_stone_a', 66)
    pillar(c, 'pillar_stone_b', W - 98)
    paste(c, tile('banner_gold'), 104, CEIL + 30)
    paste(c, tile('banner_gold'), 136, CEIL + 30)
    band(c, 'crenel', FLOOR - 60, 96, 164)
    on_floor(c, 'urn_lid', 108)
    on_floor(c, 'urn_lid', 136)
    on_floor(c, 'pot', 22)
    on_floor(c, 'pot', W - 52)
    c = tint(c, PALETTE['gold'], 0.14)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = glow.load()
    cx, cy = W / 2, FLOOR - 90
    for y in range(H):
        for x in range(W):
            d = ((x - cx) / (W * 0.6)) ** 2 + ((y - cy) / (H * 0.5)) ** 2
            a = max(0.0, 1.0 - d)
            px[x, y] = (255, 212, 130, int(120 * a * a))
    c.alpha_composite(glow)
    return c


ROOMS = {
    'room-entrance': entrance,
    'room-a': hall_pillars,
    'room-b': hall_ledge,
    'room-c': hall_arch,
    'room-d': hall_ruin,
    'room-e': hall_deep,
    'room-throne': throne
}


def main():
    for name, fn in ROOMS.items():
        img = save(fn(), name + '.png')
        print(name, img.size)
    src = tile('brick_dark')
    base = Image.new('RGBA', (src.width, src.height), (11, 15, 21, 255))
    base.alpha_composite(src)
    fill = base.crop((10, 10, src.width - 10, src.height - 10))
    px = fill.load()
    for y in range(fill.height):
        for x in range(fill.width):
            r, g, b, _ = px[x, y]
            px[x, y] = (int(r * 0.62), int(g * 0.62), int(b * 0.68), 255)
    save(fill, 'wall-fill.png')
    print('wall-fill', fill.size)
    save(tile('door_wood'), 'door-closed.png')
    save(tile('arch_open'), 'door-open.png')
    from tiles import TORCH
    save(TORCH, 'torch.png')
    print('->', OUT)


if __name__ == '__main__':
    main()
