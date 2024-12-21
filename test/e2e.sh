#!/usr/bin/env bash
set -e

BRANCHES=(main test-env-1 test-env-2)

# Run the server in production mode
cp test/env .env
pnpm run build

# Root is required to be able to delete data dir files, which are owned by root
sudo node dist/main.js &

# Wait for the server to start
sleep 5

# Run the tests by starting a container host, and then simulating a request to the server
# The request resolves as son as the container is up and running (accepting requests on port 80)
for branch in "${BRANCHES[@]}"; do
  curl -skH "X-Admin-Request: true" "http://localhost:3000/run?branch=$branch"
  curl -sk --resolve "$branch.localhost.local:3000:127.0.0.1" "http://$branch.localhost.local:3000" -L
done

# Test retrieving the status
curl -skH "X-Admin-Request: true" "http://localhost:3000/status"

# Test retrieving the health
curl -skH "X-Admin-Request: true" "http://localhost:3000/health"

# And finally, delete the deployment
for branch in "${BRANCHES[@]}"; do
  curl -skH "X-Admin-Request: true" "http://localhost:3000/delete?branch=$branch"
done
