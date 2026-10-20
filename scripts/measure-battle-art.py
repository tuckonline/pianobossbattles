"""Measure source PNG alpha only; originals are never modified. Requires Pillow."""
import hashlib
import json
from collections import deque
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = {}
for path in sorted((root / "hosted/public/battle").glob("*.png")):
    image = Image.open(path).convert("RGBA")
    width, height = image.width // 4, image.height // 8
    alpha = image.getchannel("A").tobytes()
    size = len(alpha)
    seen = bytearray(size)
    labels = bytearray(size)
    cores = {}

    def neighbors(p):
        x, y = p % image.width, p // image.width
        if x: yield p - 1
        if x < image.width - 1: yield p + 1
        if y: yield p - image.width
        if y < image.height - 1: yield p + image.width

    # The illustrations are not precisely registered to the nominal grid. Find
    # each complete opaque silhouette across the sheet, including weapons that
    # extend beyond a cell. A higher seed threshold separates adjacent glows.
    for start, value in enumerate(alpha):
        if value <= 96 or seen[start]: continue
        seen[start] = 1
        pixels = [start]
        for p in pixels:
            for n in neighbors(p):
                if not seen[n] and alpha[n] > 96:
                    seen[n] = 1
                    pixels.append(n)
        if len(pixels) < 6000: continue
        cx = sum(p % image.width for p in pixels) / len(pixels)
        cy = sum(p // image.width for p in pixels) / len(pixels)
        index = int(cy // height) * 4 + int(cx // width)
        if index in cores: raise ValueError(f"Ambiguous sprite {path.name}: {index}")
        cores[index] = pixels
    if set(cores) != set(range(32)):
        raise ValueError(f"Expected 32 independent character silhouettes in {path.name}")

    # Grow each seed into its own translucent clothing/energy fringe. Adjacent
    # sprites never share pixels. This is asset analysis, not combat collision.
    queue = deque()
    for index, pixels in cores.items():
        for p in pixels:
            labels[p] = index + 1
            queue.append(p)
    while queue:
        p = queue.popleft()
        for n in neighbors(p):
            if not labels[n] and alpha[n] > 8:
                labels[n] = labels[p]
                queue.append(n)
    # Preserve antialiased edges and small detached details within two pixels.
    for _ in range(2):
        additions = {}
        for p, label in enumerate(labels):
            if label:
                for n in neighbors(p):
                    if not labels[n]: additions.setdefault(n, label)
        for p, label in additions.items(): labels[p] = label

    regions = [[] for _ in range(32)]
    for p, label in enumerate(labels):
        if label: regions[label - 1].append(p)
    frames, masks = [], []
    for index, pixels in enumerate(regions):
        x, y = min(p % image.width for p in pixels), min(p // image.width for p in pixels)
        right, bottom = max(p % image.width for p in pixels) + 1, max(p // image.width for p in pixels) + 1
        frames.append([x - index % 4 * width, y - index // 4 * height, right - x, bottom - y])
        # Row spans make a small, lossless runtime clip mask. Keep source PNGs
        # unchanged; the adapter caches cleaned canvases once during preloading.
        spans = []
        for row in range(y, bottom):
            start = None
            for col in range(x, right + 1):
                included = col < right and labels[row * image.width + col] == index + 1
                if included and start is None: start = col
                if not included and start is not None:
                    spans.extend([row - y, start - x, col - start])
                    start = None
        masks.append(spans)
    assets[f"/battle/{path.name}"] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "frameWidth": width, "frameHeight": height, "imageWidth": image.width, "imageHeight": image.height, "frames": frames, "masks": masks}
(root / "hosted/battle-art-bounds.json").write_text(json.dumps(assets, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Measured {sum(len(asset['frames']) for asset in assets.values())} frames; source PNGs unchanged.")
