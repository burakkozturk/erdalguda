from pathlib import Path
from PIL import Image
import numpy as np
import fabric_generator

ASSETS = Path("public/assets")

# No standalone swatch exists for 2191.  Use the blazer espalda interior
# layer — it has the largest continuous fabric area and has already had the
# Karels material applied.  We alpha-composite it onto white so transparent
# pixels don't skew the colour extraction in preprocess_fabric.
TEMPLATE = (
    ASSETS
    / "blazer/sb-2b-blazer"
    / "3d__new_man__jacket__STD__2191_fabric__front__interior+espalda_abajo+length_long.png"
)
rgba = Image.open(TEMPLATE).convert("RGBA")
bg   = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
bg.paste(rgba, mask=rgba.split()[3])
fabric_pil = bg.convert("RGB")
fabric_id  = "2191"

# Generate VEST layers
count = fabric_generator.generate_vest_layers(
    fabric_pil=fabric_pil,
    fabric_id=fabric_id,
    vest_root=ASSETS / "vest",
)
print(f"Vest layers generated: {count}")

# Generate PANT layers
count = fabric_generator.generate_pant_layers(
    fabric_pil=fabric_pil,
    fabric_id=fabric_id,
    pant_root=ASSETS / "pant",
)
print(f"Pant layers generated: {count}")
