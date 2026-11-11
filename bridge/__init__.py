"""
Anki Studio — Bridge Package
Provides seamless IPC communication between the React/Tailwind Modern UI and Anki 26.x Python backend.
"""

from .router import BridgeRouter

__all__ = ["BridgeRouter"]
