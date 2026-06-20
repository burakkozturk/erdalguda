# Zone config for centered__z35__fastening_center+visible_button.png
# Paste into LAYER_CONFIGS in shirtfabricblending.py
#
# Zone polygons are in pixel coordinates (x, y), origin top-left.
# Set 'rotation' for each zone to the desired fabric angle (degrees).

ZONES_CENTERED__Z35__FASTENING_CENTER_VISIBLE_BUTTON = [
    {
        "polygon": [(245, 99), (245, 131), (299, 133), (298, 104)],
        "rotation": 0,  # TODO: set angle for zone 0
    },
    {
        "polygon": [(299, 103), (362, 102), (362, 132), (299, 133)],
        "rotation": 0,  # TODO: set angle for zone 1
    },
]