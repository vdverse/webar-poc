"""Generate a feature-rich, asymmetric target image for MindAR image tracking.

Good targets have: high texture density, many corners, asymmetry, and
non-repeating patterns. This produces target.jpg plus a raw grayscale dump
(target.gray + target.size) consumed by scripts/compile-target.mjs.
"""
import json
import random

from PIL import Image, ImageDraw

random.seed(42)  # deterministic output

W, H = 800, 800
img = Image.new("RGB", (W, H), (245, 242, 235))
d = ImageDraw.Draw(img)

palette = [
    (30, 41, 59), (185, 28, 28), (21, 128, 61),
    (161, 98, 7), (29, 78, 216), (91, 33, 182),
]

# Irregular grid of high-contrast shapes -> dense, non-repeating corners.
cell = 80
for gy in range(0, H, cell):
    for gx in range(0, W, cell):
        jx, jy = random.randint(-18, 18), random.randint(-18, 18)
        x, y = gx + jx, gy + jy
        s = random.randint(22, 56)
        c = random.choice(palette)
        kind = random.random()
        if kind < 0.3:
            d.rectangle([x, y, x + s, y + s], fill=c)
        elif kind < 0.55:
            d.ellipse([x, y, x + s, y + s], fill=c)
        elif kind < 0.8:
            d.polygon([(x, y + s), (x + s // 2, y), (x + s, y + s)], fill=c)
        else:
            d.line([x, y, x + s, y + s], fill=c, width=6)
            d.line([x, y + s, x + s, y], fill=c, width=6)

# Asymmetric anchor marks so orientation is unambiguous.
d.rectangle([20, 20, 120, 120], fill=(15, 23, 42))
d.ellipse([40, 40, 100, 100], fill=(245, 242, 235))
d.polygon([(W - 130, H - 30), (W - 30, H - 30), (W - 80, H - 130)],
          fill=(185, 28, 28))

# Text adds strong, unique features.
d.text((150, 40), "AR PROOF OF CONCEPT", fill=(15, 23, 42))
d.text((150, 60), "MindAR target v1", fill=(15, 23, 42))

img.save("public/ar-demo/target.jpg", quality=92)

gray = img.convert("L")
with open("scripts/target.gray", "wb") as f:
    f.write(gray.tobytes())
with open("scripts/target.size", "w") as f:
    json.dump({"width": W, "height": H}, f)
print("wrote target.jpg and grayscale dump", W, "x", H)
