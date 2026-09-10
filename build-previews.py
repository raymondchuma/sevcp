#!/usr/bin/env python3
"""Generate a branded 1200x630 social-share card per company into og/<slug>.jpg.
Reads og-data.json (produced by build-previews.mjs). Run: python3 build-previews.py"""
import json, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG    = (28, 63, 57)     # #1C3F39 brand dark green
CREAM = (252, 255, 238)  # #FCFFEE
LIME  = (202, 252, 68)   # #CAFC44
MUTE  = (176, 197, 191)  # tagline
FOOT  = (143, 167, 159)  # footer text
BARS  = [(106,205,221),(232,102,66),(202,252,68),(106,205,221),(35,121,34)]

GS   = os.path.expanduser('~/Library/Fonts/GoogleSans-VariableFont_GRAD,opsz,wght.ttf')
HELV = '/System/Library/Fonts/Helvetica.ttc'

def font(size):
    try:
        return ImageFont.truetype(GS, size)
    except Exception:
        return ImageFont.truetype(HELV, size)

def wrap(draw, text, fnt, maxw):
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

os.makedirs('og', exist_ok=True)
data = json.load(open('og-data.json'))
PAD = 84
for c in data:
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    seg = W // 5
    for i, col in enumerate(BARS):
        d.rectangle([i*seg, 0, (i+1)*seg, 12], fill=col)

    d.text((PAD, 92), 'SEVCP PORTFOLIO  ·  2026', font=font(26), fill=LIME)

    nf = font(78)
    y = 168
    for ln in wrap(d, c['name'], nf, W - 2*PAD)[:2]:
        d.text((PAD, y), ln, font=nf, fill=CREAM, stroke_width=1, stroke_fill=CREAM)
        y += 92
    y += 14

    tf = font(33)
    for ln in wrap(d, c['tagline'], tf, W - 2*PAD)[:3]:
        d.text((PAD, y), ln, font=tf, fill=MUTE)
        y += 46

    bf = font(26)
    d.text((PAD, H - 72), f"{c['sector']}   ·   {c['state']} State", font=bf, fill=FOOT)
    dom = 'sevcp.sedc.gov.ng'
    d.text((W - PAD - d.textlength(dom, font=bf), H - 72), dom, font=bf, fill=FOOT)

    img.save(f"og/{c['slug']}.jpg", quality=82, optimize=True)

print(f"Wrote {len(data)} og/*.jpg cards")
