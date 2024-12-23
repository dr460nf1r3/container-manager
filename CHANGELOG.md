## [2.0.0](https://github.com/dr460nf1r3/container-manager/compare/1.2.0..2.0.0) - 2024-12-23

### ⛰️  Features

- *(controller)* Replace GET routes with REST standard, throw method not allowed on admin header and non-matching route - ([d1513d6](https://github.com/dr460nf1r3/container-manager/commit/d1513d69f91cea357c62fd83619204d57a0e0fb6))

### 🐛 Bug Fixes

- *(app)* Don't init if we just need the OpenAPI JSON - ([23368f9](https://github.com/dr460nf1r3/container-manager/commit/23368f984a264bd504c5885d1c5c754cf04b5a63))
- *(test)* Update e2e real world test with current state, massively improve it - ([36a7e26](https://github.com/dr460nf1r3/container-manager/commit/36a7e263f8a018044d461c1c566082d81245351a))

### 📚 Documentation

- *(CHANGELOG.md)* Update - ([2fe28a3](https://github.com/dr460nf1r3/container-manager/commit/2fe28a3a94a70835f44eeb1a72c4cfcda9f047ce))
- *(README)* Update route table and make it a details section - ([d8305ed](https://github.com/dr460nf1r3/container-manager/commit/d8305ed2d556264374f841cdbcfc300b10ce5f84))
- *(README.md)* Include OpenAPI specification - ([f70390a](https://github.com/dr460nf1r3/container-manager/commit/f70390a061e275b15d27bcff45d75ecdcf759423))
- *(compodoc)* Add documentation website - ([9fe563f](https://github.com/dr460nf1r3/container-manager/commit/9fe563fe33fb669aef4fe6e79e71b5fb5af5f98d))

### ⚙️ Miscellaneous Tasks

- *(postman)* Update collection - ([cfb39af](https://github.com/dr460nf1r3/container-manager/commit/cfb39af86adf87c22f6f38d886e1d5589c0330af))
- *(tooling)* Generate nicer changelogs via git-cliff - ([0132dba](https://github.com/dr460nf1r3/container-manager/commit/0132dbafe3fe601d7a5782091e8682fa7dbf4c02))
- Run changelog generation only on tag, fix no deploy run on tag - ([5b04746](https://github.com/dr460nf1r3/container-manager/commit/5b0474693ce3bc8d9ea9fee110fbba85249d570b))


## [1.2.0](https://github.com/dr460nf1r3/container-manager/compare/1.1.0..1.2.0) - 2024-12-22

### 🐛 Bug Fixes

- Handle sigterm nicely in container hosts, create network manually, restore missing containers - ([2838c7c](https://github.com/dr460nf1r3/container-manager/commit/2838c7c71965041a92ea45a0f36a6a375366b1ef))

### 📚 Documentation

- *(CHANGELOG.md)* Update - ([d9d0a56](https://github.com/dr460nf1r3/container-manager/commit/d9d0a56b0ed44070ac6fd556b19937c6ee376ca3))
- *(CHANGELOG.md)* Update - ([f221908](https://github.com/dr460nf1r3/container-manager/commit/f2219082c6c491d426edc2364b61cfbcf7765fea))
- *(CHANGELOG.md)* Update - ([610bf18](https://github.com/dr460nf1r3/container-manager/commit/610bf18cbd4f3f41e0b6436499a42dc597c68abd))

### ⚙️ Miscellaneous Tasks

- *(changelog)* Provide only the latest release in release notes - ([38b7edd](https://github.com/dr460nf1r3/container-manager/commit/38b7eddd92020b8043754e12ea778b3a953b267d))
- Create network in e2e.sh, pull eventual changes if pushing fails - ([608b340](https://github.com/dr460nf1r3/container-manager/commit/608b3404dccc44940f6d1ada3db07a8f48bb76ba))


## [1.1.0](https://github.com/dr460nf1r3/container-manager/compare/1.0.0..1.1.0) - 2024-12-22

### ⛰️  Features

- *(Dockerfile)* Update and adapt compose.yaml for current state - ([29978dd](https://github.com/dr460nf1r3/container-manager/commit/29978dd944876f910eda3a99a741a16dcacdbdaf))
- *(submodule)* Add dind-image - ([dd2c821](https://github.com/dr460nf1r3/container-manager/commit/dd2c8216ea931f7de887f254256be5045446916d))
- Improve readability and misc enhancements - ([3ca1d75](https://github.com/dr460nf1r3/container-manager/commit/3ca1d75421fb053660080d1dd7ed725eb50d4464))

### 🐛 Bug Fixes

- *(flake.nix)* Don't pollute nix develop -c output with pnpm messages - ([3bc6ac3](https://github.com/dr460nf1r3/container-manager/commit/3bc6ac391fe40f94b24c3e40f53c152828df6684))
- *(tests)* Use sudo in e2e.sh where required - ([6cc9bef](https://github.com/dr460nf1r3/container-manager/commit/6cc9bef6a339af661e548ec4cba49106262502eb))
- *(tests)* Fixup Jest tests and improve real world test - ([bdaea66](https://github.com/dr460nf1r3/container-manager/commit/bdaea66f2a0d1227299508b71397fb6d0fa75ce9))

### 🚜 Refactor

- *(global)* Real proxy; solve a few edge cases and improve robustness - ([01428fc](https://github.com/dr460nf1r3/container-manager/commit/01428fc66c0f0392e1b93689ccd362bcab337875))

### 📚 Documentation

- *(CHANGELOG.md)* Update - ([3fb8a29](https://github.com/dr460nf1r3/container-manager/commit/3fb8a29762267bde655712afddd5b21721de0509))
- *(CHANGELOG.md)* Update - ([7fa83c5](https://github.com/dr460nf1r3/container-manager/commit/7fa83c576144b76bc43b051145c32376bb9fc3e2))
- *(README.md)* Update to current state - ([103959d](https://github.com/dr460nf1r3/container-manager/commit/103959dc549fadfe053f60e82a256b2bfb5dd751))

### ⚙️ Miscellaneous Tasks

- *(cache)* Add Nix magic cache - ([0069919](https://github.com/dr460nf1r3/container-manager/commit/0069919b813d8a9f63eee9331e58d59347aeb3d9))
- *(deploy)* Don't run deployment on pull request and only run once on PR - ([7072008](https://github.com/dr460nf1r3/container-manager/commit/7072008477419738c898c4b5828be28d9dde872b))

## New Contributors ❤️

* @temeraire-cx made their first contribution

## [1.0.0](https://github.com/dr460nf1r3/container-manager/compare/0.0.1..1.0.0) - 2024-12-20

### ⛰️  Features

- *(container-manager)* Allow keeping containers active - ([4ca7085](https://github.com/dr460nf1r3/container-manager/commit/4ca7085b31f236775ed9767e1714a7c025054db4))
- *(container-manager)* More container states, cache Docker dir on host, fix routes not sending replies - ([02e0d2a](https://github.com/dr460nf1r3/container-manager/commit/02e0d2a08431a68c51d49b9e2bc66bd51ddab7fb))
- *(container-manager)* Add route for deleting a deploymet - ([dffdfb0](https://github.com/dr460nf1r3/container-manager/commit/dffdfb08a0aaf18c4c83b1d405b6aee410a28cb5))
- *(container-manager)* Support both pausing/stopping containers - ([fe68bad](https://github.com/dr460nf1r3/container-manager/commit/fe68badb7ee5bb4e482ceb263f88f33500d8c9f2))
- *(controller)* Allow protecting admin routes, prevent conflict with proxyied routes - ([f45145e](https://github.com/dr460nf1r3/container-manager/commit/f45145e8d73ff56d7da493dbf6a9f8f2b817dd18))
- Many enhancements, DTO, minor testing, README - ([652ea08](https://github.com/dr460nf1r3/container-manager/commit/652ea0828bf84e2435034d75256e06e40f471a35))
- Initial commit - ([2155c65](https://github.com/dr460nf1r3/container-manager/commit/2155c6596a1db3b67d55cfec0c845b89c9f6480d))

### 🐛 Bug Fixes

- *(Dockerfile)* Pin package version - ([f8edecc](https://github.com/dr460nf1r3/container-manager/commit/f8edeccc3c68a8ab6a6182cf029984b55023c259))
- *(controller)* Catch-all requests properly - ([1df1b9c](https://github.com/dr460nf1r3/container-manager/commit/1df1b9ceda1b5e5f2710dffdae310ac8bc10b7af))
- *(test)* Set required env vars for Github Actions - ([9f5e710](https://github.com/dr460nf1r3/container-manager/commit/9f5e710e648a2a49e09ddafdbc7f23933efbca62))
- *(test)* Explicitly set DOCKER_SOCKET var for Github Actions - ([d07c1f0](https://github.com/dr460nf1r3/container-manager/commit/d07c1f0fa53bf3e39a037e3143ec1a7a30e2513c))

### 📚 Documentation

- *(API)* Add more API documentation - ([54f70f5](https://github.com/dr460nf1r3/container-manager/commit/54f70f588052cc50f010ac5db882cfbdbd463ff2))
- *(README)* Update, add some badges - ([5a9e36d](https://github.com/dr460nf1r3/container-manager/commit/5a9e36db8d151b3f2f2fc2a6b45fa7ec234ff9f5))

### 🎨 Styling

- *(editorconfig)* Set intent to 2; reformat all - ([688b29c](https://github.com/dr460nf1r3/container-manager/commit/688b29c32eb0d9c7996f00dbfab59951becc710f))

### ⚙️ Miscellaneous Tasks

- *(test)* Fix test not being able to delete host dir, files being passed to pnpm-lint check - ([ab08c47](https://github.com/dr460nf1r3/container-manager/commit/ab08c47c681257962243abba714a04953c4eb8a8))
- *(test)* Add a test simulating real work loads - ([f79d2ab](https://github.com/dr460nf1r3/container-manager/commit/f79d2ab47b4de3d27736b674f38deb1f2e7fdf87))
- Auto-generate and push CHANGELOG.md based on commits - ([6f50e8d](https://github.com/dr460nf1r3/container-manager/commit/6f50e8da27a00d199a1a3b6b22facfa4f79ce375))
- Don't fail on detected vulnerability for now - ([6a36476](https://github.com/dr460nf1r3/container-manager/commit/6a3647657b229f101cd07f9d45d11e9f5b0b8376))
- Split scan into own job - ([4e10300](https://github.com/dr460nf1r3/container-manager/commit/4e10300d457224d5907ec77d5305d1bf7e70186c))
- Scan Docker image with Trivy - ([48ad3a9](https://github.com/dr460nf1r3/container-manager/commit/48ad3a97d0ca7c31f419f89414789351a33fab59))
- Cache pnpm install and fix non-available pnpm when running the app via sudo - ([e587ff5](https://github.com/dr460nf1r3/container-manager/commit/e587ff53ddff8845d52190f3713f268fad47b4c3))
- Separate steps and fix pre-commit check - ([90307e9](https://github.com/dr460nf1r3/container-manager/commit/90307e90f4cefd169a2e446edf04c86fc08133ad))
- Add nix flake with linters; add pre-commit hooks - ([e4b608f](https://github.com/dr460nf1r3/container-manager/commit/e4b608f4f1ee4713e09e262ad459a5c28d71b0d3))
- Add linting and tests before publishing - ([20e38d8](https://github.com/dr460nf1r3/container-manager/commit/20e38d88a91759d7f0e878ca408901d2b7a7616a))
- Add workflows for building images - ([a748c2f](https://github.com/dr460nf1r3/container-manager/commit/a748c2f19ae6b0e1d9cd06e68a984d1809563af5))

## New Contributors ❤️

* @dr460nf1r3 made their first contribution

