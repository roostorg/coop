FROM ghcr.io/facebook/threatexchange/hma:1.0.16

WORKDIR /build

COPY omm_config.py /build/omm_config.py
COPY local-entrypoint.sh /build/entrypoint.sh

# Make the entrypoint script executable
RUN chmod +x /build/entrypoint.sh

ENV OMM_CONFIG=/build/omm_config.py

ENTRYPOINT ["/build/entrypoint.sh"]
