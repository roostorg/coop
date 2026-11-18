# Copyright (c) Meta Platforms, Inc. and affiliates.

"""
OpenMediaMatch config for HMA with the optional CLIP signal.

This is the stock config (../omm_config.py, installed as omm_config_base) with
the clip_float signal enabled next to PDQ and MD5, plus an optional hostname
allowlist for the image URLs HMA fetches. HMA then hashes every photo
with CLIP as well, and every bank holds both kinds of hash.
"""

import os

from omm_config_base import *  # noqa: F401,F403
from omm_config_base import (
    DefaultOMMStore,
    FBThreatExchangeSignalExchangeAPI,
    NCMECSignalExchangeAPI,
    PdqSignal,
    PhotoContent,
    StopNCIISignalExchangeAPI,
    VideoContent,
    VideoMD5Signal,
)
from tx_extension_clip import CLIPFloatSignal

# HMA fetches any URL it is given. Set HMA_ALLOWED_HOSTNAMES to a
# comma-separated list (subdomains included) to restrict where it may fetch
# from. Empty allows any http(s) URL.
ALLOWED_HOSTNAMES = {
    host.strip()
    for host in os.environ.get("HMA_ALLOWED_HOSTNAMES", "").split(",")
    if host.strip()
}

# Keep this list in step with the stock config, adding only CLIPFloatSignal.
STORAGE_IFACE_INSTANCE = DefaultOMMStore(
    signal_types=[PdqSignal, VideoMD5Signal, CLIPFloatSignal],
    content_types=[PhotoContent, VideoContent],
    exchange_types=[
        FBThreatExchangeSignalExchangeAPI,  # type: ignore
        NCMECSignalExchangeAPI,  # type: ignore
        StopNCIISignalExchangeAPI,
    ],
)
