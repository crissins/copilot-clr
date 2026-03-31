from enum import Enum


class AccessibilityPresetName(str, Enum):
    default = "default"
    dyslexia = "dyslexia"
    adhd = "adhd"
    autism = "autism"