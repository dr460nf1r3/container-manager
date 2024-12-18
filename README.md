## Description

This is an application for managing Docker in Docker test environments.
Specifically, it is used to manage the creation and deletion of per-branch Docker container hosts.
Furthermore, it acts as proxy, routing to the correct container based on the subdomain of the request.
If no request comes in for a certain amount of time, the container is automatically paused to save resources.
Once it receives a request again, it is resumed.

## Features

- Create and delete Docker containers (DinD) via GET or POST request
- Automatically pause and resume containers based on request activity
- Pull a specific repository upon container host creation and run a specific build script to set up a Compose file, used
  to set up the test environment
- Proxy requests to the correct container based on the subdomain of the request

## Sample compose.yml for running the application

```yaml
name: container-manager
services:
    container-manager:
        container_name: container-manager
        image: dr460nf1r3/container-manager:main
        ports:
            - "80:3000"
        volumes:
            - "/var/run/docker.sock:/var/run/docker.sock:rw"
        environment:
            CONFIG_CONTAINER_PREFIX: container-host
            CONFIG_CUSTOM_BUILD_SCRIPT: ./ci/build-compose.sh
            CONFIG_CUSTOM_BUILD_SCRIPT_LOCAL: false
            CONFIG_DIR_CONTAINER: /app/config
            CONFIG_DIR_HOST: /var/lib/container-manager
            CONFIG_HOSTNAME: localhost.local
            CONFIG_IDLE_TIMEOUT: 60000
            CONFIG_LOGLEVEL: info
            CONFIG_MASTER_IMAGE: dr460nf1r3/container-manager-dind
            CONFIG_MASTER_IMAGE_TAG: main
            CONFIG_REPO_URL: https://github.com/dr460nf1r3/dind-poc.git
            CONFIG_SUSPEND_MODE: stop
            NODE_ENV: production
```

## Environment variables

- `CONFIG_CONTAINER_PREFIX`: Prefix for container host names, prepended to the branch name
- `CONFIG_CUSTOM_BUILD_SCRIPT`: Path to a custom build script that is executed after the repository is cloned, or the host when CONFIG_CUSTOM_BUILD_SCRIPT_LOCAL is set to true
- `CONFIG_CUSTOM_BUILD_SCRIPT_LOCAL`: If set to true, the custom build script is copied from the host to the container and and executed here
- `CONFIG_DIR_CONTAINER`: Directory in the container where the config files are stored
- `CONFIG_DIR_HOST`: Directory on the host where the per-branch directories are stored
- `CONFIG_HOSTNAME`: Hostname of the container host
- `CONFIG_IDLE_TIMEOUT`: Time in milliseconds after which a container is paused if no requests are received
- `CONFIG_LOGLEVEL`: Log level of the application
- `CONFIG_MASTER_IMAGE`: Image used to create the container hosts
- `CONFIG_MASTER_IMAGE_TAG`: Tag of the image used to create the container hosts
- `CONFIG_REPO_URL`: URL of the repository that is cloned when a container host is created
- `CONFIG_SUSPEND_MODE`: Mode in which the container is paused, either `stop` or `pause`
- `NODE_ENV`: Node environment, either `development` or `production`
- `PORT`: Port on which the application listens

## API documentation

The Swagger API documentation can be found at `/api` when the application is running (e.g. [http://localhost/api](http://localhost/api)).

## Project setup

### Install dependencies

```bash
$ pnpm install
```

### Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

### Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e
```
