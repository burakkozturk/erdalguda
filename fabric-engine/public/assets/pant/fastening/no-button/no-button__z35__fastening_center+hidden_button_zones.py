# Zone config for no-button__z35__fastening_center+hidden_button.png
# Paste into LAYER_CONFIGS in shirtfabricblending.py
#
# Zone polygons are in pixel coordinates (x, y), origin top-left.
# Set 'rotation' for each zone to the desired fabric angle (degrees).

ZONES_NO_BUTTON__Z35__FASTENING_CENTER_HIDDEN_BUTTON = [
    {
        "polygon": [(245, 98), (245, 130), (254, 131), (272, 132), (299, 133), (298, 103), (279, 103), (254, 101)],
        "rotation": 0,  # TODO: set angle for zone 0
    },
    {
        "polygon": [(298, 103), (299, 133), (324, 132), (361, 131), (361, 102)],
        "rotation": 0,  # TODO: set angle for zone 1
    },
]