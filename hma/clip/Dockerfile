# Optional HMA image with the CLIP signal, for semantic image matching.
#
# This is the stock HMA image (../Dockerfile) plus PyTorch, the tx-extension-clip
# signal, and a config (omm_config.py) that enables clip_float next to PDQ and
# MD5. It is not built by default and nothing in Coop's compose file uses it;
# see docs/integrations/hma-clip.md for how to build and run it.
#
# Build from the hma/ directory:
#   docker build -f clip/Dockerfile -t hma-clip .
#
# CPU by default. For GPU, build with PYTORCH_CUDA, TORCH_VERSION and
# TORCHVISION_VERSION for your CUDA version; see the guide.
#
# Keep the FROM line the same as ../Dockerfile so both run one HMA release.
FROM ghcr.io/meta/threatexchange/hma:1.2.1@sha256:a89c941da57436bc944abce42d9e6d2d757fcc539118e2f3fcafd24ae1bcc3dd

ARG PYTORCH_CUDA=cpu
# Defaults are the CPU build. Each CUDA index carries different versions.
ARG TORCH_VERSION=2.15.0
ARG TORCHVISION_VERSION=0.29.2
ARG TX_EXTENSION_CLIP_COMMIT=b0ff722d947c52152ae0a1e0f0e56cf2e9ff66ea

WORKDIR /app

RUN pip install --no-cache-dir torch==${TORCH_VERSION} torchvision==${TORCHVISION_VERSION} \
    --index-url https://download.pytorch.org/whl/${PYTORCH_CUDA}

RUN pip install --no-cache-dir "git+https://github.com/UMass-Rescue/tx-extension-clip@${TX_EXTENSION_CLIP_COMMIT}" \
    && python -c "from tx_extension_clip import CLIPFloatSignal"

# The stock config is kept as a module that the CLIP config extends.
COPY omm_config.py /app/omm_base/omm_config_base.py
COPY clip/omm_config.py /app/omm_config.py
COPY local-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV PYTHONPATH=/app/omm_base
ENV OMM_CONFIG=/app/omm_config.py

ENTRYPOINT ["/app/entrypoint.sh"]
