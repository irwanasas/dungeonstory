from PIL import Image, ImageDraw
from tiles import OUT, PALETTE, save, tile


def stone_wash(size):
    src = tile('brick_moss')
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    y = 0
    while y < size[1]:
        x = 0
        while x < size[0]:
            canvas.alpha_composite(src, (x, y))
            x += src.width
        y += src.height
    faded = canvas.copy()
    px = faded.load()
    for yy in range(size[1]):
        for xx in range(size[0]):
            r, g, b, a = px[xx, yy]
            px[xx, yy] = (r, g, b, int(a * 0.3))
    return faded


def bevel(size, fill, light, dark, edge, inset=False, trim=None):
    w, h = size
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], fill=fill + (255,))
    img.alpha_composite(stone_wash(size))
    d = ImageDraw.Draw(img)
    hi, lo = (dark, light) if inset else (light, dark)
    d.rectangle([1, 1, w - 2, 2], fill=hi + (255,))
    d.rectangle([1, 1, 2, h - 2], fill=hi + (255,))
    d.rectangle([1, h - 3, w - 2, h - 2], fill=lo + (255,))
    d.rectangle([w - 3, 1, w - 2, h - 2], fill=lo + (255,))
    d.rectangle([0, 0, w - 1, h - 1], outline=edge + (255,))
    if trim:
        d.rectangle([3, 3, w - 4, h - 4], outline=trim + (255,))
    return img


def main():
    P = PALETTE
    save(bevel((24, 24), P['stone_dark'], P['stone'], P['mortar'], P['ink']), 'frame-panel.png')
    save(bevel((24, 24), (16, 22, 28), P['stone'], P['mortar'], P['ink'], inset=True), 'frame-inset.png')
    save(bevel((24, 24), P['stone'], P['stone_lit'], P['stone_dark'], P['ink']), 'frame-button.png')
    save(bevel((24, 24), P['stone_dark'], P['stone_lit'], P['stone_dark'], P['ink'], inset=True), 'frame-button-down.png')
    save(bevel((24, 24), (18, 16, 12), P['gold'], (72, 54, 20), P['ink'], trim=(96, 74, 28)), 'frame-plate.png')
    save(bevel((24, 24), (26, 14, 12), P['ember'], (84, 32, 20), P['ink'], trim=(120, 48, 30)), 'frame-danger.png')
    print('->', OUT)


if __name__ == '__main__':
    main()
