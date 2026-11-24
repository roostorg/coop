# Optional HMA image with the CLIP signal, for semantic image matching.
#
# This is the stock HMA image (../Dockerfile) plus PyTorch, the tx-extension-clip
# signal, and a config (omm_config.py) that enables clip_float next to PDQ and
# MD5. It is not built by default and nothing in Coop's compose file uses it;
# see docs/integrations/hma-clip.md for how to build and run it.
#
# Build from the repository root:
#   docker build -f hma/clip/Dockerfile -t hma-clip hma
#
# CPU by default. For GPU, build with PYTORCH_CUDA, TORCH_VERSION and
# TORCHVISION_VERSION for your CUDA version; see the guide.
#
# Keep the FROM line the same as ../Dockerfile so both run one HMA release.
FROM ghcr.io/meta/threatexchange/hma:1.2.2@sha256:9975bd6b4d57de0da776de8ea07fdddeb22cd0515c64c9301cc176836da514cf

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

# The CLIP model weights and tokenizer config are fetched here at pinned
# revisions, so every build gets the same model and nothing is downloaded when
# the container runs. The weights add about 1.4 GB to the image.
ENV HF_HOME=/root/.cache/huggingface
RUN python - <<'EOF'
from pathlib import Path
from huggingface_hub import snapshot_download

for repo, revision, patterns in [
    (
        "laion/CLIP-ViT-B-32-xlm-roberta-base-laion5B-s13B-b90k",
        "506d40eb551f4801a1c27fc20a31c7b8f590deda",
        ["open_clip_pytorch_model.bin", "*.json"],
    ),
    (
        "xlm-roberta-base",
        "e73636d4f797dec63c3081bb6ed5c7b0bb3f2089",
        ["*.json", "*.model"],
    ),
]:
    snapshot_download(repo, revision=revision, allow_patterns=patterns)
    # open_clip asks for the "main" revision; point it at the pinned one.
    refs = Path(f"/root/.cache/huggingface/hub/models--{repo.replace('/', '--')}/refs")
    refs.mkdir(parents=True, exist_ok=True)
    (refs / "main").write_text(revision)
EOF
ENV HF_HUB_OFFLINE=1

# The stock config is kept as a module that the CLIP config extends.
COPY omm_config.py /app/omm_base/omm_config_base.py
COPY clip/omm_config.py /app/omm_config.py
COPY local-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV PYTHONPATH=/app/omm_base
ENV OMM_CONFIG=/app/omm_config.py

ENTRYPOINT ["/app/entrypoint.sh"]
