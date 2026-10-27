# Getting Started

Quickly get set up with Coop for the first time for local development. For testing and demonstration, you may be interested in the [Docker images](docker.md).

> [!NOTE]
> You may also want to familiarize yourself with Coop's [Basic Concepts](../user/concepts.md) for additional context.

Deployments with additional content-access requirements can configure [content access extensions](content-access.md).

This guide assumes some familiarity with the command line, e.g. using a Terminal with `bash` or `zsh`. See [Local Development](local.md) for prerequisites, configuration details, troubleshooting, and more. You may also wish to learn more about Coop's [Architecture](architecture.md).

To get Coop running:

0. **Clone the repository** using `git` and enter the `coop` folder if you haven't already.

   ```sh
   git clone https://github.com/roostorg/coop.git && cd coop
   ```

1. **Ensure you have prerequisites** installed, including `nvm`, `docker`, and the correct version of Node.js.

   ```sh
   # coop/
   nvm --version && nvm install && nvm use
   docker --version
   ```

   You should see output like:

   ```
   0.40.4
   Found '.nvmrc' with version <24.21.0>
   v24.21.0 is already installed.
   Now using node v24.21.0 (npm v11.19.0)
   Docker version 29.4.3, build 055a478
   ```

   If you get an error instead, see [Prerequisites](local.md#prerequisites).

2. **Install dependencies** for every package with one `pnpm install` from the root folder.

   ```sh
   # coop/
   pnpm install
   ```

3. **Copy example environment files** in `db/`, `server/`, and `client/`. The defaults work out of the box for local development and demoing. See [Environment Setup](local.md#environment-setup) for more details.

   ```sh
   # coop/
   cp db/.env.example db/.env
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

4. **Start all backing services**, including databases and queues. See [Docker Services](local.md#docker-services) for ports and more details.

   ```sh
   # coop/
   pnpm run up
   ```

   Wait for PostgreSQL, ClickHouse, ScyllaDB, and Redis to be healthy before continuing; you can check progress with `docker ps`.

5. **Create databases** and run migrations to ensure they're set up correctly:

   ```sh
   # coop/
   pnpm run db:create --env staging --db api-server-pg
   pnpm run db:create --env staging --db scylla
   pnpm run db:create --env staging --db clickhouse

   pnpm run db:update --env staging --db api-server-pg
   pnpm run db:update --env staging --db scylla
   pnpm run db:update --env staging --db clickhouse
   ```

6. **Create an organization and admin user** using the `create-org` script from the `server/` folder, providing the appropriate details.

   For example:

   ```sh
   # coop/server/
   pnpm run create-org \
     --name "Your Organization" \
     --website "https://example.com" \
     --email "email@example.com" \
     --firstName "Jane" \
     --lastName "Doe" \
     --password "correct-horse-battery-staple"
   ```

   This will output your org ID and initial API key; copy them somewhere secure for safe keeping.

7. Finally, **start the application**! See [Running the Application](local.md#running-the-application) for additional options, including how to start different components individually for debugging.

   Switch back to the project root folder if you're still in `server/`, then start the server and client:

   ```sh
   # coop/server
   cd ..

   # coop/
   pnpm run start
   ```

   Log in at [localhost:3000](http://localhost:3000) using the credentials you provided when running `create-org`. The initial page load may take a moment.

## Pull requests and commit messages

Follow the [ROOST contribution guidelines](https://github.com/roostorg/.github/blob/main/CONTRIBUTING.md). For nontrivial changes, start with an issue and link it in your pull request. Keep changes focused and small enough to review.

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope][!]: <description>
```

Use a lowercase type from this list:

| Type       | Purpose                                     |
| ---------- | ------------------------------------------- |
| `feat`     | Add a feature                               |
| `fix`      | Fix a bug                                   |
| `docs`     | Change documentation                        |
| `style`    | Change formatting without changing behavior |
| `refactor` | Restructure code without changing behavior  |
| `perf`     | Improve performance                         |
| `test`     | Add or update tests                         |
| `build`    | Change dependencies or build tooling        |
| `ci`       | Change CI configuration                     |
| `chore`    | Perform other maintenance                   |
| `revert`   | Revert a change                             |

Scopes are optional. Use a component name such as `client`, `server`, or `api`. Write a concise, imperative description after the colon and space. Start the description with a lowercase word and do not end it with a period.

Examples:

```text
feat(client): add review queue filters
fix(server): handle missing item identifiers
docs: explain local development setup
feat(api)!: require a queue identifier
```

For breaking changes, put `!` immediately before the colon and explain the impact and migration steps in the PR description. Preserve that explanation in the squash commit body, preferably with a `BREAKING CHANGE: <explanation>` footer.
