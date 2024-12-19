#!/usr/bin/env bash
set -e

# Run the server in production mode
cp test/env .env
pnpm run build
pnpm run start:prod &

# Wait for the server to start
sleep 5

# Run the tests by starting a container host, and then simulating a request to the server
curl --header "x-admin: true" http://localhost:3000/run?branch=main
curl -svk --resolve main.localhost.local:3000:127.0.0.1 http://main.localhost.local:3000 -L

# Test retrieving the status
curl --header "x-admin: true" "http://localhost:3000/status"

# And finally, delete the deployment
curl --header "x-admin: true" "http://localhost:3000/delete?branch=main"
