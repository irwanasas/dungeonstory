from PIL import Image, ImageDraw
from tiles import OUT, PALETTE, save

P = PALETTE
INK = P['ink'] + (255,)
S = 24


def canvas():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def rgba(name, a=255):
    c = P[name]
    return (c[0], c[1], c[2], a)


def outline(img):
    px = img.load()
    edge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ep = edge.load()
    for y in range(S):
        for x in range(S):
            if px[x, y][3] > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < S and 0 <= ny < S and px[nx, ny][3] > 128:
                    ep[x, y] = INK
                    break
    edge.alpha_composite(img)
    return edge


def emit(draw_fn, name):
    img = canvas()
    draw_fn(ImageDraw.Draw(img), img)
    save(outline(img), name + '.png', double=False).resize((S * 4, S * 4), Image.NEAREST).save(f'{OUT}/{name}.png')


def body(d, color, shape):
    if shape == 'broad':
        d.polygon([(4, 22), (4, 12), (12, 8), (20, 12), (20, 22)], fill=color)
    elif shape == 'slim':
        d.polygon([(7, 22), (6, 12), (12, 9), (18, 12), (17, 22)], fill=color)
    elif shape == 'robe':
        d.polygon([(5, 22), (7, 11), (12, 8), (17, 11), (19, 22)], fill=color)


def head(d, skin=(226, 198, 168, 255), cx=12, cy=7, r=4):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=skin)


def hero_paladin(d, im):
    body(d, rgba('stone'), 'broad')
    head(d)
    d.rectangle([9, 2, 15, 6], fill=(126, 160, 210, 255))
    d.rectangle([11, 3, 13, 8], fill=rgba('ink'))
    d.polygon([(14, 11), (21, 13), (21, 20), (17, 23), (14, 20)], fill=(126, 176, 236, 255))
    d.polygon([(16, 14), (19, 15), (19, 19), (17, 21), (16, 19)], fill=rgba('bone'))
    d.rectangle([3, 10, 5, 22], fill=rgba('stone_lit'))


def hero_berserker(d, im):
    body(d, (150, 62, 46, 255), 'broad')
    head(d)
    d.polygon([(6, 5), (3, 1), (8, 3)], fill=rgba('bone'))
    d.polygon([(18, 5), (21, 1), (16, 3)], fill=rgba('bone'))
    d.rectangle([9, 6, 11, 8], fill=rgba('ember_lit'))
    d.rectangle([13, 6, 15, 8], fill=rgba('ember_lit'))
    d.line([2, 20, 6, 11], fill=rgba('wood'), width=2)
    d.polygon([(1, 13), (7, 9), (8, 13), (3, 15)], fill=rgba('stone_lit'))
    d.line([22, 20, 18, 11], fill=rgba('wood'), width=2)
    d.polygon([(23, 13), (17, 9), (16, 13), (21, 15)], fill=rgba('stone_lit'))


def hero_trickster(d, im):
    body(d, (110, 78, 150, 255), 'slim')
    d.polygon([(6, 12), (12, 1), (18, 12), (12, 9)], fill=(138, 100, 186, 255))
    d.ellipse([9, 6, 15, 11], fill=(24, 18, 34, 255))
    d.rectangle([10, 8, 11, 9], fill=rgba('frost'))
    d.rectangle([13, 8, 14, 9], fill=rgba('frost'))
    d.polygon([(18, 14), (23, 11), (22, 15), (18, 17)], fill=rgba('bone'))
    d.polygon([(6, 14), (1, 11), (2, 15), (6, 17)], fill=rgba('bone'))


def hero_assassin(d, im):
    d.polygon([(6, 22), (5, 14), (12, 10), (19, 14), (18, 22)], fill=(46, 34, 52, 255))
    d.polygon([(7, 13), (12, 3), (17, 13), (12, 10)], fill=(76, 46, 74, 255))
    d.rectangle([10, 7, 11, 9], fill=(226, 92, 122, 255))
    d.rectangle([13, 7, 14, 9], fill=(226, 92, 122, 255))
    d.line([19, 9, 22, 20], fill=rgba('bone'), width=2)
    d.polygon([(17, 16), (22, 8), (23, 11), (19, 18)], fill=(240, 240, 244, 255))


def hero_druid(d, im):
    body(d, (58, 110, 78, 255), 'robe')
    head(d, (222, 200, 176, 255))
    d.polygon([(7, 6), (12, 2), (17, 6), (12, 5)], fill=rgba('moss'))
    d.line([19, 3, 19, 22], fill=rgba('wood'), width=2)
    d.ellipse([16, 1, 22, 7], fill=rgba('moss_lit'))
    d.ellipse([18, 3, 20, 5], fill=(230, 255, 236, 255))
    d.polygon([(8, 14), (12, 12), (16, 14), (12, 20)], fill=rgba('moss'))


def hero_elementalist(d, im):
    body(d, (150, 88, 40, 255), 'robe')
    d.polygon([(6, 12), (12, 1), (18, 12), (12, 9)], fill=(190, 116, 52, 255))
    d.ellipse([9, 6, 15, 11], fill=(30, 20, 14, 255))
    d.rectangle([10, 8, 11, 9], fill=rgba('ember_lit'))
    d.rectangle([13, 8, 14, 9], fill=rgba('ember_lit'))
    d.line([19, 5, 19, 22], fill=rgba('wood'), width=2)
    d.ellipse([15, 0, 23, 8], fill=rgba('ember'))
    d.ellipse([17, 2, 21, 6], fill=rgba('ember_lit'))
    d.ellipse([18, 3, 20, 5], fill=(255, 244, 210, 255))


def mon_goblin(d, im):
    d.polygon([(6, 22), (6, 14), (12, 10), (18, 14), (18, 22)], fill=(96, 132, 62, 255))
    d.ellipse([7, 4, 17, 14], fill=(122, 162, 78, 255))
    d.polygon([(7, 9), (1, 4), (6, 12)], fill=(122, 162, 78, 255))
    d.polygon([(17, 9), (23, 4), (18, 12)], fill=(122, 162, 78, 255))
    d.rectangle([9, 8, 11, 10], fill=rgba('ember_lit'))
    d.rectangle([13, 8, 15, 10], fill=rgba('ember_lit'))
    d.rectangle([9, 12, 15, 13], fill=(30, 20, 14, 255))
    d.line([2, 20, 6, 15], fill=rgba('stone_lit'), width=2)


def mon_archer(d, im):
    d.ellipse([8, 3, 17, 12], fill=rgba('bone'))
    d.rectangle([10, 6, 12, 9], fill=rgba('ink'))
    d.rectangle([14, 6, 16, 9], fill=rgba('ink'))
    d.rectangle([11, 11, 15, 12], fill=(160, 156, 138, 255))
    d.rectangle([10, 13, 16, 22], fill=(196, 190, 168, 255))
    for y in (15, 18, 21):
        d.rectangle([10, y, 16, y], fill=(120, 116, 100, 255))
    d.arc([1, 5, 9, 21], 300, 60, fill=rgba('wood'), width=2)
    d.line([5, 6, 5, 20], fill=(210, 206, 190, 255))
    d.line([5, 13, 20, 13], fill=(220, 214, 190, 255))


def mon_slime(d, im):
    d.ellipse([2, 8, 22, 23], fill=(96, 168, 110, 255))
    d.ellipse([5, 5, 19, 18], fill=(122, 200, 128, 255))
    d.ellipse([7, 9, 11, 14], fill=(16, 30, 18, 255))
    d.ellipse([14, 9, 18, 14], fill=(16, 30, 18, 255))
    d.ellipse([8, 10, 10, 12], fill=(240, 255, 240, 255))
    d.ellipse([15, 10, 17, 12], fill=(240, 255, 240, 255))
    d.ellipse([6, 6, 10, 9], fill=(190, 236, 190, 200))


def mon_ogre(d, im):
    d.polygon([(2, 23), (2, 11), (12, 5), (22, 11), (22, 23)], fill=(126, 92, 68, 255))
    d.ellipse([7, 3, 17, 13], fill=(152, 116, 86, 255))
    d.rectangle([9, 7, 11, 9], fill=(240, 210, 120, 255))
    d.rectangle([14, 7, 16, 9], fill=(240, 210, 120, 255))
    d.rectangle([9, 11, 16, 13], fill=(40, 24, 18, 255))
    d.polygon([(10, 11), (11, 13), (12, 11)], fill=rgba('bone'))
    d.polygon([(13, 11), (14, 13), (15, 11)], fill=rgba('bone'))
    d.line([21, 22, 18, 8], fill=rgba('wood'), width=3)
    d.ellipse([16, 1, 23, 8], fill=(96, 72, 52, 255))


def mon_shadow(d, im):
    d.polygon([(12, 1), (20, 10), (21, 22), (16, 18), (12, 23), (8, 18), (3, 22), (4, 10)], fill=(48, 34, 66, 255))
    d.polygon([(12, 4), (17, 11), (17, 19), (12, 16), (7, 19), (7, 11)], fill=(72, 50, 100, 255))
    d.ellipse([8, 8, 11, 12], fill=(196, 132, 240, 255))
    d.ellipse([14, 8, 17, 12], fill=(196, 132, 240, 255))
    d.ellipse([9, 9, 10, 11], fill=(255, 236, 255, 255))
    d.ellipse([15, 9, 16, 11], fill=(255, 236, 255, 255))


def mon_lord(d, im):
    d.polygon([(4, 23), (4, 12), (12, 7), (20, 12), (20, 23)], fill=(64, 48, 92, 255))
    d.polygon([(6, 13), (12, 10), (18, 13), (18, 23), (6, 23)], fill=(92, 68, 130, 255))
    d.ellipse([8, 4, 16, 12], fill=(214, 186, 158, 255))
    d.rectangle([9, 7, 11, 9], fill=rgba('ink'))
    d.rectangle([13, 7, 15, 9], fill=rgba('ink'))
    d.polygon([(6, 5), (6, 1), (9, 3), (12, 0), (15, 3), (18, 1), (18, 5)], fill=rgba('gold'))
    d.rectangle([6, 5, 18, 6], fill=rgba('gold_lit'))
    d.ellipse([11, 2, 13, 4], fill=rgba('ember'))
    d.line([21, 22, 21, 6], fill=rgba('gold'), width=2)
    d.ellipse([18, 2, 24, 8], fill=rgba('gold_lit'))


def trap_spike(d, im):
    d.rectangle([1, 17, 22, 22], fill=rgba('stone_dark'))
    d.rectangle([1, 17, 22, 18], fill=rgba('stone'))
    for x in (2, 7, 12, 17):
        d.polygon([(x, 18), (x + 2, 4), (x + 4, 18)], fill=rgba('bone'))
        d.polygon([(x + 2, 4), (x + 3, 12), (x + 4, 18)], fill=(168, 162, 142, 255))


def trap_poison(d, im):
    d.ellipse([2, 8, 14, 20], fill=(88, 160, 96, 220))
    d.ellipse([10, 4, 22, 17], fill=(112, 190, 112, 220))
    d.ellipse([7, 2, 15, 10], fill=(140, 214, 130, 200))
    d.ellipse([8, 10, 11, 13], fill=(24, 44, 26, 255))
    d.ellipse([14, 8, 17, 11], fill=(24, 44, 26, 255))
    d.rectangle([1, 20, 22, 22], fill=rgba('stone_dark'))


def trap_oil(d, im):
    d.ellipse([1, 13, 22, 22], fill=(26, 22, 30, 255))
    d.ellipse([4, 15, 15, 20], fill=(56, 46, 62, 255))
    d.ellipse([6, 16, 10, 18], fill=(120, 104, 132, 255))
    d.polygon([(14, 3), (18, 3), (19, 12), (13, 12)], fill=(76, 60, 40, 255))
    d.rectangle([13, 2, 19, 4], fill=(112, 88, 56, 255))
    d.ellipse([15, 11, 17, 14], fill=(56, 46, 62, 255))


def trap_fire(d, im):
    d.rectangle([1, 19, 22, 22], fill=rgba('stone_dark'))
    d.polygon([(12, 1), (18, 11), (16, 19), (8, 19), (6, 11)], fill=rgba('ember'))
    d.polygon([(12, 6), (16, 13), (14, 19), (10, 19), (8, 13)], fill=rgba('ember_lit'))
    d.polygon([(12, 11), (14, 16), (12, 19), (10, 16)], fill=(255, 240, 190, 255))


def trap_frost(d, im):
    for ang in range(3):
        import math
        a = ang * math.pi / 3
        x2, y2 = 12 + 10 * math.cos(a), 12 + 10 * math.sin(a)
        x1, y1 = 12 - 10 * math.cos(a), 12 - 10 * math.sin(a)
        d.line([x1, y1, x2, y2], fill=rgba('frost'), width=2)
    d.ellipse([8, 8, 16, 16], fill=(190, 234, 246, 255))
    d.ellipse([10, 10, 14, 14], fill=(240, 252, 255, 255))


def trap_net(d, im):
    for i in range(0, 24, 5):
        d.line([i, 2, i + 10, 22], fill=(178, 164, 130, 255))
        d.line([i, 22, i + 10, 2], fill=(178, 164, 130, 255))
    d.rectangle([0, 1, 23, 2], fill=rgba('wood'))
    for x in (2, 11, 20):
        d.ellipse([x, 19, x + 3, 22], fill=rgba('stone'))


def treasure_hoard(d, im):
    d.ellipse([1, 14, 23, 23], fill=(150, 116, 44, 255))
    d.ellipse([3, 12, 21, 20], fill=rgba('gold'))
    for cx, cy in ((7, 12), (12, 10), (17, 13), (10, 15), (15, 16)):
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=rgba('gold_lit'))
        d.ellipse([cx - 1, cy - 2, cx + 1, cy], fill=(255, 246, 200, 255))
    d.polygon([(11, 3), (13, 3), (14, 8), (10, 8)], fill=rgba('gold_lit'))


def treasure_relic(d, im):
    d.line([12, 1, 12, 8], fill=rgba('gold'), width=2)
    d.polygon([(12, 5), (20, 13), (12, 22), (4, 13)], fill=(74, 48, 108, 255))
    d.polygon([(12, 8), (17, 13), (12, 19), (7, 13)], fill=(150, 100, 210, 255))
    d.ellipse([10, 11, 14, 15], fill=(232, 196, 255, 255))
    d.arc([2, 3, 22, 12], 200, 340, fill=rgba('gold'), width=2)


def icon_gold(d, im):
    d.ellipse([2, 2, 21, 21], fill=(150, 116, 44, 255))
    d.ellipse([4, 4, 19, 19], fill=rgba('gold'))
    d.ellipse([7, 7, 16, 16], fill=rgba('gold_lit'))
    d.rectangle([11, 7, 13, 17], fill=(150, 116, 44, 255))


def icon_soul(d, im):
    d.polygon([(12, 1), (21, 9), (17, 22), (7, 22), (3, 9)], fill=(70, 130, 158, 255))
    d.polygon([(12, 5), (17, 10), (15, 19), (9, 19), (7, 10)], fill=rgba('frost'))
    d.ellipse([10, 9, 14, 14], fill=(232, 252, 255, 255))


def icon_raid(d, im):
    d.polygon([(11, 1), (14, 4), (14, 16), (11, 19)], fill=(214, 220, 228, 255))
    d.rectangle([12, 2, 13, 16], fill=(248, 250, 252, 255))
    d.rectangle([7, 16, 18, 18], fill=rgba('gold'))
    d.rectangle([11, 18, 14, 23], fill=rgba('wood'))
    d.rectangle([9, 22, 16, 23], fill=rgba('gold_lit'))


def icon_build(d, im):
    d.rectangle([10, 8, 14, 23], fill=rgba('wood'))
    d.polygon([(3, 2), (21, 2), (21, 9), (3, 9)], fill=rgba('stone_lit'))
    d.polygon([(3, 2), (21, 2), (21, 4), (3, 4)], fill=(160, 190, 196, 255))
    d.rectangle([10, 4, 14, 9], fill=rgba('stone_dark'))


def icon_upgrade(d, im):
    d.polygon([(12, 1), (22, 12), (16, 12), (16, 22), (8, 22), (8, 12), (2, 12)], fill=rgba('moss'))
    d.polygon([(12, 4), (18, 11), (14, 11), (14, 20), (10, 20), (10, 11), (6, 11)], fill=rgba('moss_lit'))


def icon_codex(d, im):
    d.rectangle([2, 3, 21, 21], fill=(84, 48, 40, 255))
    d.rectangle([4, 5, 19, 19], fill=(214, 202, 172, 255))
    d.rectangle([11, 3, 13, 21], fill=(64, 36, 30, 255))
    for y in (8, 11, 14):
        d.rectangle([6, y, 10, y], fill=(120, 108, 88, 255))
        d.rectangle([14, y, 18, y], fill=(120, 108, 88, 255))


def icon_lord(d, im):
    d.polygon([(3, 19), (3, 6), (8, 11), (12, 3), (16, 11), (21, 6), (21, 19)], fill=rgba('gold'))
    d.rectangle([3, 19, 21, 22], fill=rgba('gold_lit'))
    d.ellipse([10, 7, 14, 11], fill=rgba('ember'))
    d.ellipse([4, 8, 7, 11], fill=rgba('frost'))
    d.ellipse([17, 8, 20, 11], fill=rgba('frost'))


def icon_clear(d, im):
    d.line([5, 5, 18, 18], fill=rgba('stone_lit'), width=3)
    d.line([18, 5, 5, 18], fill=rgba('stone_lit'), width=3)


def icon_world(d, im):
    d.polygon([(3, 9), (17, 3), (17, 15), (3, 13)], fill=rgba('gold'))
    d.polygon([(5, 9), (15, 5), (15, 13), (5, 12)], fill=rgba('gold_lit'))
    d.ellipse([15, 2, 22, 16], fill=rgba('gold'))
    d.ellipse([17, 5, 21, 13], fill=(30, 22, 10, 255))
    d.rectangle([2, 8, 4, 14], fill=rgba('stone_lit'))
    d.rectangle([2, 13, 4, 22], fill=rgba('wood'))
    d.rectangle([6, 16, 8, 18], fill=rgba('ember_lit'))
    d.rectangle([9, 18, 11, 20], fill=rgba('ember'))


def icon_settings(d, im):
    import math
    for i in range(8):
        a = i * math.pi / 4
        cx, cy = 12 + 9 * math.cos(a), 12 + 9 * math.sin(a)
        d.rectangle([cx - 2.5, cy - 2.5, cx + 2.5, cy + 2.5], fill=rgba('stone_lit'))
    d.ellipse([3, 3, 20, 20], fill=rgba('stone_lit'))
    d.ellipse([5, 5, 18, 18], fill=rgba('stone'))
    d.ellipse([8, 8, 15, 15], fill=rgba('ink'))
    d.ellipse([9, 9, 14, 14], fill=rgba('gold'))


def icon_lock(d, im):
    d.arc([6, 3, 17, 15], 180, 360, fill=rgba('stone_lit'), width=3)
    d.rectangle([4, 11, 19, 21], fill=rgba('stone'))
    d.rectangle([4, 11, 19, 12], fill=rgba('stone_lit'))
    d.ellipse([10, 14, 13, 18], fill=rgba('ink'))


SPRITES = {
    'hero-paladin': hero_paladin,
    'hero-berserker': hero_berserker,
    'hero-trickster': hero_trickster,
    'hero-assassin': hero_assassin,
    'hero-druid': hero_druid,
    'hero-elementalist': hero_elementalist,
    'monster-goblin': mon_goblin,
    'monster-archer': mon_archer,
    'monster-slime': mon_slime,
    'monster-ogre': mon_ogre,
    'monster-shadow': mon_shadow,
    'monster-lord': mon_lord,
    'trap-spike': trap_spike,
    'trap-poison': trap_poison,
    'trap-oil': trap_oil,
    'trap-fire': trap_fire,
    'trap-frost': trap_frost,
    'trap-net': trap_net,
    'treasure-hoard': treasure_hoard,
    'treasure-relic': treasure_relic,
    'icon-gold': icon_gold,
    'icon-soul': icon_soul,
    'icon-raid': icon_raid,
    'icon-build': icon_build,
    'icon-upgrade': icon_upgrade,
    'icon-codex': icon_codex,
    'icon-lord': icon_lord,
    'icon-clear': icon_clear,
    'icon-lock': icon_lock,
    'icon-settings': icon_settings,
    'icon-world': icon_world
}


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SPRITES.items():
        img = canvas()
        fn(ImageDraw.Draw(img), img)
        outline(img).resize((S * 4, S * 4), Image.NEAREST).save(os.path.join(OUT, name + '.png'))
    print(len(SPRITES), 'sprites ->', OUT)


if __name__ == '__main__':
    main()
