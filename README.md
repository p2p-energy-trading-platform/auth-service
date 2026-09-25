# Auth Service

The **GridX Auth Service** is the identity and authentication service for the P2P Energy Trading Platform.

It is responsible for:

- User registration and account management
- Email/password authentication
- SSO identity linking
- Session and refresh-token management
- Password reset and password changes
- JWT access-token signing
- JWKS publication and Ed25519 key rotation
- Roles, permissions, and authorization checks
- KYC state and identity-verification data
- Authentication-related audit and security controls

## 1. Architecture

```text
                         ┌──────────────────────┐
                         │   Web / Mobile App   │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │     API Gateway      │
                         │ Fastify / TypeScript │
                         └───────┬───────┬──────┘
                                 │       │
                    HTTP health/JWKS     │ gRPC
                                 │       │
                                 ▼       ▼
                         ┌──────────────────────┐
                         │     Auth Service     │
                         │ Fastify / TypeScript │
                         └────┬──────┬──────┬───┘
                              │      │      │
                           Postgres Redis  Ed25519
                                       signing keys

                         ┌──────────────────────┐
                         │    Other GridX       │
                         │      Services        │
                         └──────────────────────┘
```

The API Gateway communicates with Auth Service over gRPC and retrieves JWKS over the internal network.

NOTE: The Gateway verifies access-token signatures locally. It does **not** send every incoming request to Auth Service just to verify a JWT.

## 2. Repository structure

The service follows a feature/infrastructure/transport split:

```text
auth-service/
├── src/
│   ├── app.ts
│   ├── main.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── schema.ts
│   │   └── types.ts
│   │
│   ├── plugins/
│   │   ├── database.ts
│   │   ├── grpc.ts
│   │   ├── observability.ts
│   │   ├── redis.ts
│   │   └── security.ts
│   │
│   ├── transport/
│   │   ├── grpc/
│   │   │   ├── server.ts
│   │   │   ├── credentials.ts
│   │   │   ├── metadata.ts
│   │   │   ├── deadlines.ts
│   │   │   ├── errors.ts
│   │   │   └── services/
│   │   │       ├── auth.service.ts
│   │   │       └── authorization.service.ts
│   │   │
│   │   └── http/
│   │       ├── routes.ts
│   │       ├── health/
│   │       │   ├── routes.ts
│   │       │   ├── liveness.ts
│   │       │   └── readiness.ts
│   │       └── jwks.ts
│   │
│   ├── features/
│   │   ├── authentication/
│   │   │   ├── register.ts
│   │   │   ├── login.ts
│   │   │   ├── refresh.ts
│   │   │   ├── logout.ts
│   │   │   └── logout-all.ts
│   │   │
│   │   ├── users/
│   │   │   ├── service.ts
│   │   │   ├── repository.ts
│   │   │   └── mapper.ts
│   │   │
│   │   ├── sessions/
│   │   │   ├── service.ts
│   │   │   ├── repository.ts
│   │   │   └── mapper.ts
│   │   │
│   │   ├── authorization/
│   │   │   ├── service.ts
│   │   │   ├── permissions.ts
│   │   │   └── roles.ts
│   │   │
│   │   ├── password/
│   │   │   ├── forgot-password.ts
│   │   │   ├── reset-password.ts
│   │   │   └── change-password.ts
│   │   │
│   │   └── keys/
│   │       ├── service.ts
│   │       └── jwks.ts
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── client.ts
│   │   │   ├── migrations/
│   │   │   └── repositories/
│   │   │       ├── user.repository.ts
│   │   │       └── session.repository.ts
│   │   │
│   │   ├── redis/
│   │   │   ├── client.ts
│   │   │   ├── keys.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── session-cache.ts
│   │   │
│   │   ├── crypto/
│   │   │   ├── password-hasher.ts
│   │   │   ├── jwt-signer.ts
│   │   │   ├── token-hasher.ts
│   │   │   └── key-provider.ts
│   │   │
│   │   └── email/
│   │       └── provider.ts
│   │
│   ├── observability/
│   │   ├── logging.ts
│   │   ├── metrics.ts
│   │   ├── tracing.ts
│   │   └── redaction.ts
│   │
│   ├── errors/
│   │   ├── app-error.ts
│   │   ├── codes.ts
│   │   ├── error-handler.ts
│   │   └── grpc-errors.ts
│   │
│   ├── common/
│   │   ├── request-context.ts
│   │   ├── validation.ts
│   │   ├── constants.ts
│   │   └── types.ts
│   │
│   └── types/
│       └── fastify.d.ts
│
├── test/
│   ├── integration/
│   ├── contract/
│   ├── security/
│   ├── load/
│   ├── fixtures/
│   ├── helpers/
│   └── setup.ts
│
├── scripts/
│   └── check-config.ts
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── eslint.config.js
├── package.json
├── tsconfig.json
└── README.md
```

The exact folder contents can grow as implementation continues. New code should preserve the existing separation:

- `features/` contains business/application logic.
- `transport/` contains gRPC/HTTP transport concerns.
- `infrastructure/` contains database, Redis, crypto, and external integrations.
- `plugins/` wires infrastructure into Fastify.
- `observability/` contains logs, metrics, tracing, and redaction.
- `errors/` centralizes application and transport error handling.

## 3. Prerequisites

Install these before starting development:

### Required

- Git
- Node.js **24 or newer**
- npm
- Docker Engine
- Docker Compose
- `goose` for local database migration commands
- `gridx-workspace` setup (configure the gridx-workspace repo before running the project)

## 4. Clone and install

Make sure the gridx-workspace is set up with latest changes from main branch and all repos have been pulled locally. If you want to pull all latest changes or missing repos, run the following from `gridx-workspace`.

```bash
go-task setup
```

or

```bash
task setup
```

Install dependencies:

```bash
npm install
```

## 5. Generate development JWT keys

The Auth Service signs access tokens with **Ed25519**.

The private key must remain inside Auth Service.

Generate a development key pair:

```bash
mkdir -p secrets

npm run keys:generate
```

Verify the files exist:

```bash
ls -l secrets/
```

Expected:

```text
auth-private.pem
auth-public.pem
```

## 6. Configure the environment

Create your local environment file:

```bash
cp .env.example .env
```

Review every value before starting the service. You must first check that the postgres url for both localhost and docker container are correct. `DATABASE_URL` is used during localhost execution and `DOCKER_POSTGRES_URL` is used during execution inside docker environment.

## 7. Running the project

To run the project, you can run the following commands.

In `gridx-workspace` directory, run the following to start the entire project along with auth-service.

```bash
go-task up
```

or

```bash
task up
```

To rebuild the `auth-service` only while it is still running in docker, you can use the following command:

```bash
go-task build -- auth-service
```

or

```bash
task build -- auth-service
```

You can also run the project locally but make sure it is not running as a docker container under `gridx-workspace` directory (there can be some unintended side effects or race conditions - unsure but technically it should work as expected). You can run the project locally by running the following commands

```bash
npm run build
```

```bash
npm run start
```

## 8. Prepare the database

The migration directory is the repository-root `migrations/` directory:

```text
migrations/
```

The project uses Goose for schema migrations. Keep Goose migrations in this migrations directory.

### Create a migration

**NOTE**: Atleast the `gridx-infra` containers must be running or the following commands will throw an error. I recommend having the whole `gridx-workspace` containers running! 

The script is:

```bash
npm run db:create -- <migration-name>
```

For example:

```bash
npm run db:create -- create_users_table
```

Goose will create a timestamped migration file.

Always inspect the generated file before writing SQL.

### Check migration status

```bash
npm run db:status
```

### Apply migrations

```bash
npm run db:up
```

### Roll back the latest migration

```bash
npm run db:down
```

### Reset all migrations

```bash
npm run db:reset
```

Use `db:reset` only when you want to reset everything and start clean. But changing existing migration files must be discussed with the team.

## 9. Database workflow for new developers

When switching to a branch containing new migrations:

```bash
npm run db:status
npm run db:up
```

When creating schema changes:

```text
1. Create migration
2. Write forward migration
3. Write rollback migration
4. Run migration locally
5. Test the resulting schema
6. Run the affected application tests
7. Commit the migration with the feature
```

Do not manually edit an already-applied migration to change the schema history. Create a new migration instead.

## 10. Development checks before opening a PR

Run the configuration check:

```bash
npm run check-config
```

Run type checking:

```bash
npm run typecheck
```

Run lint:

```bash
npm run lint
```

Run formatting:

```bash
npm run format:check
```

Build the application:

```bash
npm run build
```

Run the test suite:

```bash
npx vitest run
```

A useful local validation sequence is:

```bash
npm run check-config
npm run typecheck
npm run lint
npm run format:check
npx vitest run
npm run build
```

Do this before submitting substantial Auth Service changes.

## 11. Formatting and linting

Automatically fix lint findings:

```bash
npm run lint:fix
```

Format source and tests:

```bash
npm run format
```

Check formatting without changing files:

```bash
npm run format:check
```
