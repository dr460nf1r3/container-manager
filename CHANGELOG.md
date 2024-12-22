## 1.1.0 (2024-12-22)

### Feat

- **Dockerfile**: update and adapt compose.yaml for current state
- improve readability and misc enhancements
- **submodule**: add dind-image

### Fix

- **tests**: use sudo in e2e.sh where required
- **tests**: fixup Jest tests and improve real world test
- **flake.nix**: don't pollute nix develop -c output with pnpm messages

### Refactor

- **global**: real proxy; solve a few edge cases and improve robustness

## 1.0.0 (2024-12-20)

### Feat

- **container-manager**: allow keeping containers active
- **container-manager**: more container states, cache Docker dir on host, fix routes not sending replies
- **controller**: allow protecting admin routes, prevent conflict with proxyied routes
- **container-manager**: add route for deleting a deploymet
- **container-manager**: support both pausing/stopping containers
- many enhancements, DTO, minor testing, README
- initial commit

### Fix

- **controller**: catch-all requests properly
- **test**: set required env vars for Github Actions
- **test**: explicitly set DOCKER_SOCKET var for Github Actions
- **Dockerfile**: pin package version
