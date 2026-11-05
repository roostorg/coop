FROM ghcr.io/meta/threatexchange/hma:1.2.1@sha256:a89c941da57436bc944abce42d9e6d2d757fcc539118e2f3fcafd24ae1bcc3dd

WORKDIR /app

COPY omm_config.py /app/omm_config.py
COPY local-entrypoint.sh /app/entrypoint.sh

# Make the entrypoint script executable
RUN chmod +x /app/entrypoint.sh

ENV OMM_CONFIG=/app/omm_config.py

ENTRYPOINT ["/app/entrypoint.sh"]
