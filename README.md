#  Welcome to Coop!

![Coop overview with key operational metrics such as total actions taken, jobs pending review, percentage breakdown of automated vs manual actions, and top policy violations](./docs/images/coop-overview.png) 

## What is Coop?

This repository is home to one of ROOST’s tools; the Coop review tool. Coop originated as a SaaS company called Cove, and has been given a new open source software life by ROOST as Coop. 

Coop provides a comprehensive solution for online safety that includes:
* **Review Console**: Human review interface for complex moderation decisions  
* **Content Processing**: Support for posts, comments, media, and custom content types  
* **Analytics**: Detailed insights into moderation effectiveness and trends  
* **Rules Engine**: Automated content evaluation against customizable policies  
* **API Integration**: Simple REST and GraphQL APIs for seamless platform integration

### v0 Release
This is an early v0 release of Coop. We've focused on getting core review capabilities and child safety workflows into a usable state, but there's still active development ahead. You can expect features and documentation that will evolve based on community feedback.

We're developing Coop in the open and want to hear from you! Whether you're testing it out, running into issues, or have ideas for improvements, please open an [issue](https://github.com/roostorg/coop/issues/new/choose) or join our [Discord](https://discord.gg/5Csqnw2FSQ). Your feedback directly shapes the [roadmap](https://github.com/roostorg/community/blob/main/roadmap.md).

## Technology Stack

 Coop includes:

* **API Server:** Node.js/TypeScript-based REST and GraphQL APIs.  
* **Frontend**: React-based client application, AntDesign, GraphQL, TailwindCSS  
* **Infrastructure**: Docker, Kubernetes  
* **Model Service:** Python-based machine learning services.  
* **Databases**: PostgreSQL, Snowflake, Scylla  
* **Caching**: Redis  
* **Utility Services**: Database migrators, instrumentation, and proxy layers.  

## Getting Started
For development on Coop it is recommended to:

- use a machine with 16 GiB RAM or more
- use Node 24 (run `nvm install && nvm use` so local matches `.nvmrc`)

and then follow the steps below:

1. On the root directory run command `npm run up` afterwards you want to have 3 different terminals open. 

   Make sure all backing services (`postgres`, `clickhouse`, `scylla`, etc.) are up and running. (Scylla is needed for user data.)

2. Install dependencies for the root, `client`, `server`, and `.devops/migrator` packages:
   ```bash
   npm install
   (cd client && npm install)
   (cd server && npm install)
   (cd .devops/migrator && npm install)
   ```
3. Make sure the `.env` files for `/server` and `.devops/migrator` are populated (including ClickHouse credentials). Run database migrations:
   ```bash
   npm run db:update -- --env staging --db api-server-pg
   npm run db:update -- --env staging --db scylla
   npm run db:update -- --env staging --db clickhouse
   ```
### Alternative: Single Command for Steps 2-3

You can combine the dependency installation and database migrations into a single command:

```bash
npm install \
  && (cd client && npm install) \
  && (cd server && npm install) \
  && (cd .devops/migrator && npm install) \
  && npm run db:update -- --env staging --db api-server-pg \
  && npm run db:update -- --env staging --db clickhouse
```

4. On the terminals you want to run on each the following commands:
   1. `npm run client:start`  
   2. `npm run server:start`  
   3. `npm run generate:watch` — Optional for GraphQL changes, but good to keep track as you make them  
   This will help keep the logs for each of them separate for easy debugging.

5. Create an organization and admin user:
```bash
   npm run create-org
```
   
   Use the credentials provided to log in at `http://localhost:3000`.


### **Database Structure and Migrations**

All of the data around the database tables ( SQL/Schema ) exist under the `.devops/migrator/src/scripts` folder where there is a folder for each service. ( api, scylla, snowflake, model service )

### **Management Scripts**

The `server/bin` folder contains utility scripts for managing the Coop server:

- **Create Organization**: Use `npm run create-org` to create a new organization with an admin user and API key.
- **Get Invite Token**: Use `npm run get-invite` to retrieve the signup link for a user invited from the UI.

See `server/bin/README.md` for detailed usage instructions and examples.

# Code Structure

Server Code ( `/server` ):

Contains all of the back-end service that powers the API server this is divided in 3 parts:

* REST API: Handles most of Customers (Users) requests for content moderation.  
* GraphQL API: This is the API endpoints powering the front-end app and it is called by customers when interacting with the front-end.  
* Static Assets: Serves static assets that powers part of the front-end ( JS Bundle, Images, etc.. )

Backend primarily works using dependency injection using [BottleJS](https://github.com/young-steveo/bottlejs) as a way to power lazy loading, middleware hooks, and decorators. This is all declared on the `/iocContainer` [folder](https://github.com/roostorg/coop/blob/main/server/iocContainer/index.ts) When declaring a new service this is where you start to build it and make it available where needed.

`/routes` Contains the API routes that power user submissions and actions.

## GraphQL

GraphQL is used for communication between front-end and back-end services. The code is generated in both places as changes to mutations, resolvers, and types are done. To ensure the code is generated you want to run `npm run generate` on the root of the repository or keep the watch option running.

> [!NOTE]
> Careful around this as each change will generate code for both which will in turn trigger the recompile of both front-end and back-end.

Most back-end defined GraphQL can be found by searching the annotation `/* GraphQL */` which is added at the beginning of each GraphQL block, and most likely in the `/server/graphql` directory

Front-end on the other hand is defined across different places where it may be used, but by nature that also means a file may use GraphQL that is not defined inside it.

Considerations: Consolidate GraphQL code on a better folder structure.


## Key Features
### Manual Review Interface
Intuitive moderator console with queue management, dynamic content rendering, and comprehensive review tools.

### Automated Moderation
Powerful rules engine that evaluates content against customizable policies using signals like toxicity detection, keyword matching, and custom logic.

### Easy Integration
Simple REST and GraphQL APIs that integrate seamlessly with existing platforms and applications.
### Analytics & Insights
Detailed analytics on moderation effectiveness, rule performance, and content trends.

### Scalable Architecture
Built on modern cloud infrastructure with horizontal scaling, caching, and performance optimization.

## Documentation

The `/docs` folder includes detailed guides on the UI, architecture, key concepts, how signals in Coop work, and how to get started. 

### Contributors

We welcome contributions from the community\! Coop benefits from diverse perspectives and expertise in building safer online spaces.

### **How to Contribute**

Please read our [Contributing Guide](https://github.com/roostorg/.github/blob/main/CONTRIBUTING.md) for details on:

* Ways to contribute (code, documentation, testing, rules)  
* Development workflow and setup  
* Code review process and timeline  
* Community guidelines


### Join Us

Writing code is not the only way to help the project. Reviewing pull requests, answering questions to help others on mailing lists or issues, providing feedback from a domain expert perspective, organizing and teaching tutorials, working on the website, improving the documentation, are all priceless contributions.

* Join us on [Discord](https://discord.gg/HJevKCEN)  
  * General discussion channel \#general  
  * Development discussions \#coop  
* Join our [newsletter](https://roost.tools/#get-started) for more announcements and information  
* Follow us on [LinkedIn](https://www.linkedin.com/company/roost-tools/) or [Bluesky](https://bsky.app/profile/roost.tools) 