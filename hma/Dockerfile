FROM ghcr.io/facebook/threatexchange/hma:1.1.1

WORKDIR /app

COPY omm_config.py /app/omm_config.py
COPY local-entrypoint.sh /app/entrypoint.sh

# Make the entrypoint script executable
RUN chmod +x /app/entrypoint.sh

ENV OMM_CONFIG=/app/omm_config.py

ENTRYPOINT ["/app/entrypoint.sh"]
