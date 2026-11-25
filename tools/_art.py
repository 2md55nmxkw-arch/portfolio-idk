"""Shared helpers for the build-*-art.py scripts (cutting art out of the mockups and upscaling it).
Needs: Pillow, numpy, waifu2x-ncnn-vulkan (4x upscale; falls back to Lanczos if missing)."""
import math, os, shutil, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = f"{ROOT}/assets/source", f"{ROOT}/assets/img"
TMP = tempfile.mkdtemp()
K = 4  # upscale factor

def mockup(name):
    return Image.open(f"{SRC}/{name}.webp").convert("RGB")

def upscale(im, name):
    a, b = f"{TMP}/{name}.png", f"{TMP}/{name}-4x.png"
    im.save(a)
    if shutil.which("waifu2x-ncnn-vulkan"):
        subprocess.run(["waifu2x-ncnn-vulkan", "-i", a, "-o", b, "-n", "2", "-s", str(K)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return Image.open(b).convert("RGB")
    return im.resize((im.width * K, im.height * K), Image.LANCZOS)

def ramp(n, a, b):
    """0 before a, 1 after b (indices along an axis of length n)."""
    return np.clip((np.arange(n) - a) / max(b - a, 1), 0, 1)

def poly(size, pts, x0, y0, fill=255):
    """Mask (PIL 'L', upscaled size) of a polygon given in section coordinates."""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon([((x - x0) * K, (y - y0) * K) for x, y in pts], fill=fill)
    return m

def red_key(im, lo=0.42, soft=0.12, dark=0.17):
    """Alpha of the saturated-red pixels (brush strokes, pen lines)."""
    a = np.asarray(im).astype(float) / 255
    r, gb = a[..., 0], a[..., 1:].max(-1)
    return np.clip(((r - gb) / np.maximum(r, 1e-3) - lo) / soft, 0, 1) * np.clip((r - dark) / 0.1, 0, 1)

def key_dark(im, bg=(0.094, 0.078, 0.078), floor=0.03, fill=(0.92, 0.8, 0.74)):
    """Colour-to-alpha against the dark page: returns (rgb 0..1, alpha 0..1) such that
    rgb*alpha + bg*(1-alpha) gives back the picture. Lets the page texture show through the dark areas."""
    a = np.asarray(im).astype(float) / 255
    bgc = np.array(bg)
    al = np.clip(((a - bgc) / (1 - bgc)).max(-1), 0, 1)
    al = np.clip((al - floor) / (1 - floor), 0, 1)
    rgb = np.clip(bgc + (a - bgc) / np.maximum(al, 1e-3)[..., None], 0, 1)
    rgb[al < 0.01] = fill          # keep the invisible pixels a neutral paper colour (cleaner edges after compression)
    return rgb, al

def save(rgb, alpha, name, scale=0.75, q=84, trim=True, flatten=None):
    rgb = np.asarray(rgb)
    if rgb.dtype != np.uint8:      # float 0..1
        rgb = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    im = Image.fromarray(np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]), "RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox() if trim else (0, 0, *im.size)
    im = im.crop(box)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if flatten is not None:        # no transparency: lay the picture on a flat colour (much smaller file)
        bg = Image.new("RGB", im.size, flatten)
        bg.paste(im, mask=im.getchannel("A"))
        im = bg
    path = f"{OUT}/{name}.webp"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, quality=q, method=6)
    print(f"{name}.webp {im.size}  bbox(4x)={box}  {os.path.getsize(path)//1024}KB")
    return im.size, box

def cutout(mock, top, pts, name, shrink=5, q=84, scale=0.75):
    """Cut a polygon (section coordinates) out of a mockup, upscale it and save it with the outline as alpha.
    Returns ((x, y, w, h) in reference px, (width, height) of the saved file)."""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, y0, x1, y1 = math.floor(min(xs)) - 1, math.floor(min(ys)) - 1, math.ceil(max(xs)) + 1, math.ceil(max(ys)) + 1
    im = upscale(mock.crop((x0, top + y0, x1, top + y1)), name.replace("/", "-"))
    m = poly(im.size, pts, x0, y0).filter(ImageFilter.MinFilter(shrink)).filter(ImageFilter.GaussianBlur(0.9))
    size, _ = save(im, np.asarray(m) / 255, name, trim=False, q=q, scale=scale)
    return (x0, y0, x1 - x0, y1 - y0), size

def scene(mock, top, y0, y1, name, knock=(), under=(), opaque=(), q=76, x0=0, x1=667, fade_top=0, fade_bottom=5, scale=0.75, flatten=None):
    """Strip of a mockup (section y0..y1, full width unless x0/x1 are given) with the dark background keyed out.
    knock  - outlines of live elements: cut away, a little generously
    under  - outlines of things redrawn on top as separate images: cut away, but keep a margin under their edge
    opaque - outlines that must stay solid (they sit in front of a live element)
    fade_top / fade_bottom - reference px over which the strip fades in / out (where it meets the next strip)"""
    im = upscale(mock.crop((x0, top + y0, x1, top + y1)), name)
    rgb, al = key_dark(im)
    orig = np.asarray(im).astype(float) / 255
    for pts in knock:
        m = poly(im.size, pts, x0, y0).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(1.5))
        al *= 1 - np.asarray(m) / 255
    for pts in under:
        m = poly(im.size, pts, x0, y0).filter(ImageFilter.MinFilter(13)).filter(ImageFilter.GaussianBlur(1.5))
        al *= 1 - np.asarray(m) / 255
    for pts in opaque:
        m = np.asarray(poly(im.size, pts, x0, y0).filter(ImageFilter.GaussianBlur(1.0))) / 255
        rgb = rgb * (1 - m[..., None]) + orig * m[..., None]
        al = np.maximum(al, m)
    h = al.shape[0]
    if fade_bottom:
        al *= (1 - ramp(h, h - fade_bottom * K, h - 1))[:, None]
    if fade_top:
        al *= ramp(h, 0, fade_top * K)[:, None]
    return save(rgb, al, name, trim=False, q=q, scale=scale, flatten=flatten)

def ellipse(cx, cy, rx, ry, n=28):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]

def done():
    shutil.rmtree(TMP, ignore_errors=True)
