#!/bin/bash

# Run database migrations
MIGRATION_COMMAND=1 flask --app OpenMediaMatch.app db upgrade --directory OpenMediaMatch/migrations

# Start the Flask application
MIGRATION_COMMAND=0 flask --app OpenMediaMatch.app run --host=0.0.0.0 --debug
