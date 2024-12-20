#!/usr/bin/env bash
set -e

# Run the server in production mode
cp test/env .env
pnpm run build

# Root is required to be able to delete data dir files, which are owned by root
sudo node dist/main.js &

# Wait for the server to start
sleep 5

# Run the tests by starting a container host, and then simulating a request to the server
# The request resolves as son as the container is up and running (accepting requests on port 80)
curl --header "x-admin: true" http://localhost:3000/run?branch=main
curl -svk --resolve main.localhost.local:3000:127.0.0.1 http://main.localhost.local:3000 -L

# Test retrieving the status
curl --header "x-admin: true" "http://localhost:3000/status"

# And finally, delete the deployment
curl --header "x-admin: true" "http://localhost:3000/delete?branch=main"
