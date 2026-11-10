FROM ghcr.io/meta/threatexchange/hma:1.2.2@sha256:9975bd6b4d57de0da776de8ea07fdddeb22cd0515c64c9301cc176836da514cf

WORKDIR /app

COPY omm_config.py /app/omm_config.py
COPY local-entrypoint.sh /app/entrypoint.sh

# Make the entrypoint script executable
RUN chmod +x /app/entrypoint.sh

ENV OMM_CONFIG=/app/omm_config.py

ENTRYPOINT ["/app/entrypoint.sh"]
