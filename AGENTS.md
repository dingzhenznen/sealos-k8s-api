# Repository Guidelines

## Project Structure & Module Organization
This repository is a Bun + TypeScript API for managing Sealos Kubernetes resources with Elysia. The entrypoint is `src/index.ts`, which wires Swagger, auth, and all route groups.

- `src/controllers/`: HTTP route handlers such as `pod.controller.ts`, `deployment.controller.ts`, and `devbox.controller.ts`
- `src/services/`: business logic and Kubernetes access, including shared helpers in `src/services/common/`, K8s-specific services in `src/services/k8s/`, and DevBox logic in `src/services/devbox/`
- `src/middleware/`: request guards such as `auth.guard.ts`
- `src/templates/`: reusable resource templates
- Root files: `README.md`, `Dockerfile`, `entrypoint.sh`, `tsconfig.json`, `package.json`

## Build, Test, and Development Commands
- `bun install`: install dependencies
- `bun run dev`: start the API with watch mode from `src/index.ts`
- `bun run build`: bundle the service to `dist/` for Bun runtime deployment

The service defaults to port `8080`. After startup, verify `GET /health` and open `/docs` for Swagger.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode compatibility; `tsconfig.json` enables `strict`, `esModuleInterop`, and Bun types. Follow the existing code style:

- 2-space indentation
- `camelCase` for variables/functions, `PascalCase` for classes/types
- kebab-like filenames by feature, e.g. `deployment.controller.ts`, `base.service.ts`
- keep controllers thin; move Kubernetes calls and resource logic into `src/services/`

Prefer small, explicit response objects and reuse validation helpers from `src/controllers/common/`.

## Testing Guidelines
There is currently no automated test suite: `bun test` is not configured, and `npm test` intentionally exits with an error. For every change, provide manual verification steps:

- confirm `/health` returns `status: ok`
- validate the affected endpoint under `/api/v1/*`
- check Swagger at `/docs` for request schema or route regressions

If you add tests, keep them close to the changed module or under a dedicated `__tests__` folder and name them after the feature being exercised.

## Commit & Pull Request Guidelines
Recent history uses short conventional prefixes such as `feat:` and `fix:`; keep that format, for example `feat: add ingress update endpoint` or `fix: handle missing namespace`. Keep commits focused.

For pull requests, include:

- a concise description of the API or behavior change
- linked issue numbers when applicable
- changed env vars or deployment impact
- example request/response payloads, or Swagger screenshots for API-visible changes

## Security & Configuration Tips
Do not commit real cluster credentials. Configure `APISERVER`, `USER_TOKEN`, `NAMESPACE`, `USER_NAME`, and `AUTH_TOKEN` through local environment files or deployment secrets.
