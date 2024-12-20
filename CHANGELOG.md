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
