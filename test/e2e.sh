#!/usr/bin/env bash
ALL_BRANCHES=(main test-env-1 test-env-2)
BRANCHES_GET=(test-env-1 main)
BRANCHES_POST=(main test-env-2)
BRANCH_RESUME=test-env-1
FAILURES=()
SUCCESS=()

prepare-env() {
  echo "Setting up test environment..."
  if [[ -n $GITHUB_ACTIONS ]]; then
    sudo apt-get install -y jq &>/dev/null || true
    sudo docker network create container-manager
  fi

  sudo mkdir -p /var/lib/container-manager
  sudo cp -r ./test /var/lib/container-manager

  # Set the timeout low enough that test-env-1 will get shut down during the other tests
  sed -i 's/60000/10000/' compose.yaml
}

build-container() {
  # Run the server in production mode
  docker build . -t dr460nf1r3/container-manager:main || exit 1
  sudo docker compose up &

  # Wait for the server to start
  sleep 5
}

test-get() {
  # Run the tests by starting a container host, and then simulating a request to the server
  # The request resolves as son as the container is up and running (accepting requests on port 80)
  for branch in "${BRANCHES_GET[@]}"; do
    echo "Testing creation via GET:  branch $branch"
    local _test_name="$branch, GET creation"
    curl -skH "X-Admin-Request: true" "http://localhost/container?branch=$branch" &>/dev/null || FAILURES+=("$branch, GET creation")

    _test_name="$branch, access"
    curl -sk "http://$branch.localhost" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")
  done
}

test-post() {
  # Test the post endpoint, also testing recreating the main container at the same time
  for branch in "${BRANCHES_POST[@]}"; do
    echo "Testing creation via POST: branch $branch"
    local _test_name="$branch, POST creation"
    curl -skH "X-Admin-Request: true" -X POST "http://localhost/container?branch=$branch" -H "Content-Type: application/json" -d "{\"branch\": \"$branch\"}" &>/dev/null || FAILURES+=("$branch, POST creation")

    _test_name="$branch, access"
    curl -sk "http://$branch.localhost" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")
  done
}

test-endpoints() {
  # Test retrieving the status
  echo "Testing status endpoint"
  local _test_name="status"
  curl -skH "X-Admin-Request: true" "http://localhost/status" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")

  # Test retrieving the health
  echo "Testing health endpoint"
  _test_name="health"
  curl -skH "X-Admin-Request: true" "http://localhost/health" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")
}

test-suspend() {
  # Test whether suspending worked
  echo "Testing suspension and resumption"
  local _test_name="$BRANCH_RESUME, suspension"

  # In case we were too fast, try again after waiting for the timeout
  if ! sudo docker inspect container-host-test-env-1 | jq '.[0].State.Status' | grep -q "exited" &>/dev/null; then
    echo "Container not yet suspended, waiting 30 seconds to be sure..."
    sleep 30
  fi
  sudo docker inspect container-host-test-env-1 | jq '.[0].State.Status' | grep -q "exited" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")

  # Test whether resuming works
  _test_name="$BRANCH_RESUME, resumption"
  curl -sk "http://$BRANCH_RESUME.localhost" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")
}

test-delete() {
  # And finally, delete the deployments
  for branch in "${ALL_BRANCHES[@]}"; do
    local _test_name="$branch, deletion"
    echo "Testing deletion of container with branch $branch"
    curl -skH "X-Admin-Request: true" -X DELETE "http://localhost/container?branch=$branch" &>/dev/null && SUCCESS+=("$_test_name") || FAILURES+=("$_test_name")
  done

  # Test whether the containers are actually gone
  _test_name="verification, deletion"
  echo "Testing whether the containers are actually gone"
  sudo docker ps -a | grep -qE '(test-env-1)|(test-env-2)|(container-host-main)' && FAILURES+=("$_test_name") || SUCCESS+=("$_test_name")
}

cleanup() {
  # Clean up
  sudo docker compose down

  if [[ -n $GITHUB_ACTIONS ]]; then
    sudo rm -rf /var/lib/container-manager
    sudo docker network rm container-manager &>/dev/null
  else
    sed -i 's/10000/60000/' compose.yaml
  fi
}

summary() {
  # If any of the tests failed, exit with a non-zero status
  if [ ${#SUCCESS[@]} -gt 0 ]; then
    echo "Tests succeeded:"
    for succeeded in "${SUCCESS[@]}"; do
      echo "  - $succeeded"
    done
  fi
  if [ ${#FAILURES[@]} -gt 0 ]; then
    echo "Tests failed:"
    for failure in "${FAILURES[@]}"; do
      echo "  - $failure"
    done
    exit 1
  fi
}

main() {
  prepare-env
  build-container
  test-get
  test-post
  test-endpoints
  test-suspend
  test-delete
  cleanup
  summary
}

main
