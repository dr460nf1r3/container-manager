#!/usr/bin/env bash
set -eu

BRANCHES=(main test-env-1 test-env-2)
FAILURES=()

# Prepare the environment
echo "Setting up test environment..."
mkdir -p /var/lib/container-manager
cp -r ./test /var/lib/container-manager

# Run the server in production mode
docker build . -t dr460nf1r3/container-manager:main
docker compose up &

# Wait for the server to start
sleep 5

# Run the tests by starting a container host, and then simulating a request to the server
# The request resolves as son as the container is up and running (accepting requests on port 80)
for branch in "${BRANCHES[@]}"; do
  echo "Testing creation of container with branch $branch"
  curl -skH "X-Admin-Request: true" "http://localhost/run?branch=$branch" &> /dev/null || FAILURES+=("$branch, creation")
  curl -sk "http://$branch.localhost" &> /dev/null || FAILURES+=("$branch, access")
done

# Test retrieving the status
echo "Testing status endpoint"
curl -skH "X-Admin-Request: true" "http://localhost/status" &>/dev/null || FAILURES+=("status")

# Test retrieving the health
echo "Testing health endpoint"
curl -skH "X-Admin-Request: true" "http://localhost/health" &>/dev/null || FAILURES+=("health")

# And finally, delete the deployment
for branch in "${BRANCHES[@]}"; do
  echo "Testing deletion of container with branch $branch"
  curl -skH "X-Admin-Request: true" "http://localhost/delete?branch=$branch" &>/dev/null || FAILURES+=("$branch, deletion")
done

# Stop the server
docker compose down

# If any of the tests failed, exit with a non-zero status
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Tests failed:"
  for failure in "${FAILURES[@]}"; do
    echo "  - $failure"
  done
  exit 1
else
  echo "All tests passed successfully"
fi
