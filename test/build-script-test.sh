#!/usr/bin/env bash

# This script is used to run tests with while developing
echo "Setting up test compose.yaml..."

cat >"$COMPOSE_DIR/compose.yaml" <<EOF
name: test-env
services:
  nginx:
    container_name: nginx
    image: docker.io/nginx:alpine
    ports:
      - "80:80"
EOF

echo "Done."
