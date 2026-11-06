"""Regenerates the fixture images. They are drawn from code, so they carry no
third-party license and are identical on every run:

  python3 hma/clip/fixtures/generate.py

Used by docs/integrations/hma-clip-ui-testing.md.

bank/scene.jpg                image added to the CLIP bank
probe/scene-resized.jpg       the same scene, resized and re-encoded (should match, score ~0.985)
probe/scene-desaturated.jpg   the same scene with its colors drained (should match, ~0.96)
probe/scene-blurred.jpg       the same scene, blurred (should match, ~0.94)
probe/other-building.jpg      a different subject, a lit tower at night (should not match, ~0.79)
probe/other.jpg               an unrelated image (should not match)

hma/clip/smoke-test.sh checks these expectations, so re-measure after changing
an image: scores are 1 minus the CLIP cosine distance, and HMA only reports a
match within distance 0.10 (score 0.90).
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = Path(__file__).parent
BLUR = 3


def scene():
    img = Image.new("RGB", (512, 512), (135, 190, 235))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 340, 512, 512], fill=(70, 150, 70))
    d.ellipse([380, 40, 470, 130], fill=(250, 220, 60))
    d.rectangle([150, 220, 330, 360], fill=(190, 80, 60))
    d.polygon([(130, 220), (240, 130), (350, 220)], fill=(110, 40, 40))
    d.rectangle([220, 280, 260, 360], fill=(80, 50, 30))
    d.rectangle([170, 245, 205, 280], fill=(240, 240, 200))
    return img


def other_building():
    img = Image.new("RGB", (512, 512), (15, 20, 50))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 380, 512, 512], fill=(30, 60, 40))
    d.rectangle([200, 120, 300, 380], fill=(70, 70, 90))
    for y in range(140, 360, 40):
        d.rectangle([225, y, 245, y + 20], fill=(250, 230, 120))
        d.rectangle([260, y, 280, y + 20], fill=(250, 230, 120))
    d.ellipse([60, 50, 110, 100], fill=(240, 240, 230))
    return img


def other():
    rng = random.Random(7)
    img = Image.new("RGB", (512, 512), (20, 20, 30))
    d = ImageDraw.Draw(img)
    for _ in range(120):
        x, y = rng.randrange(512), rng.randrange(512)
        r = rng.randrange(2, 14)
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(rng.randrange(120, 256) for _ in range(3)))
    return img


scene().save(HERE / "bank" / "scene.jpg", quality=92)
scene().resize((448, 448)).save(HERE / "probe" / "scene-resized.jpg", quality=70)
ImageEnhance.Color(scene()).enhance(0.3).save(HERE / "probe" / "scene-desaturated.jpg", quality=90)
scene().filter(ImageFilter.GaussianBlur(BLUR)).save(HERE / "probe" / "scene-blurred.jpg", quality=90)
other_building().save(HERE / "probe" / "other-building.jpg", quality=90)
other().save(HERE / "probe" / "other.jpg", quality=92)
