# Try Coop in GitHub Codespaces

Run Coop in your web browser, with nothing to install. GitHub Codespaces gives you a temporary cloud machine running the whole Coop stack, with a demo login and sample data already set up. You won't need to type any commands.

Use it to look around the UI, show Coop to someone, or check a UI change on a branch.

## What you need

- A GitHub account. Codespaces are billed to whoever creates them; see [Costs](#costs-and-time-limits).
- A recent desktop browser: Chrome, Edge, Firefox or Safari.

## 1. Open it

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/roostorg/coop?quickstart=1)

Click the button above (it's also on the [README](https://github.com/roostorg/coop#readme)). On the next page:

- **Branch**: leave it on `main` for the latest version, or pick a branch to try someone's change. The codespace builds Coop from the branch you pick.
- **Machine type**: keep **4-core**. The 2-core machine doesn't have enough memory for Coop.
- Click **Create codespace**.

If you've opened one before, GitHub offers to **resume** it instead of making a new one. That's quicker, and keeps your earlier data.

## 2. Wait

A code editor opens in your browser tab, showing this guide. You can ignore the code. In the bottom half of the window, a terminal shows progress:

1. **Preparing**: the first time, the codespace downloads Coop's databases and builds Coop. This takes about 10 minutes, or under a minute if the repository has a prebuild ready.
2. **Starting the Coop demo**: Coop and its databases start, then the demo data is added, with a green ✓ beside each step. This takes 1–3 minutes. The Coop UI may open in a new browser tab during this step, before the demo data is there.
3. **Coop is ready**: the terminal prints the address of the UI and the demo login.

If the new tab doesn't appear (browsers sometimes block it), open the **Ports** tab next to the terminal, find **Coop UI (3000)**, and click the globe icon.

## 3. Log in

| Email             | Password    |
| ----------------- | ----------- |
| `demo@coop.local` | `coop-demo` |

This login only exists inside your codespace.

## 4. Use it

You're an admin of **Demo Org**, which has sample posts, policies and actions, a spam rule that has already acted on some posts, and user reports waiting in a review queue. The demo isn't connected to a real platform, so actions don't take anything down.

Things to try:

- **Review reports**: open **Review Console** in the left-hand menu, then **Start Reviewing** on **Reported posts**. Each job shows the reported post, why it was reported, and what the spam rule already did to it. Pick a decision on the right, choose a policy, and click **Submit**; the next job opens. Your decisions then appear under **Recent Decisions**.
- **Look at the rule**: open **Automated Enforcement** → **Proactive Rules** → **Remove obvious spam** to see its conditions and what it matched.
- **Browse the setup**: **Policies**, **Actions** and **Item Types** show the demo org's configuration. Change anything you like; it's your copy.

The **Overview** page counts actions up to the start of the current hour, so the rule's removals show up there within an hour of the codespace starting.

The [User Guide](../user/) covers the rest of the UI.

The UI's address is private to your GitHub account by default, so sharing the link doesn't let anyone else in. Keep it that way: if you change the port's visibility to public in the **Ports** tab, anyone with the link can log in with the demo password above.

## 5. Stop it

A codespace stops by itself after a period without activity: 30 minutes, unless you've changed your [Codespaces settings](https://github.com/settings/codespaces). Typing in the editor or terminal counts as activity; using the Coop UI tab alone may not. If you're presenting from the Coop UI tab for a long time, click into the editor tab now and then, or raise the idle timeout in your settings.

To stop it yourself, go to [github.com/codespaces](https://github.com/codespaces), click **⋯** next to the codespace, and choose **Stop codespace**.

## 6. Come back

Open [github.com/codespaces](https://github.com/codespaces) and click the codespace's name. The demo starts again on its own, in a minute or two, and keeps your data from last time.

## 7. Delete it

When you're done with it, delete it so it stops using your storage: at [github.com/codespaces](https://github.com/codespaces), click **⋯** → **Delete**. By default, GitHub also deletes codespaces that have been stopped for 30 days.

## Costs and time limits

Codespaces are billed to the person who creates them, unless an organization pays for its members' codespaces (ask your admin).

- **Personal GitHub accounts** include a free monthly allowance: at least 120 core-hours, which is 30 hours on the 4-core machine Coop uses, and 15 GB of storage. Above that, the 4-core machine costs $0.36 an hour while running.
- A **stopped** codespace costs nothing per hour but counts towards storage until you delete it.
- Check what you've used at [github.com/settings/billing](https://github.com/settings/billing).

GitHub's [Codespaces billing page](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-codespaces/about-billing-for-github-codespaces) has current prices and limits.

## Troubleshooting

**The UI tab never opened.** Check the terminal: until it says **Coop is ready**, the UI isn't up yet. Once it is, open the **Ports** tab and click the globe icon next to **Coop UI (3000)**. If you see a GitHub sign-in page, sign in with the account that created the codespace.

**The login page says the email or password is wrong.** Check the terminal said **Coop is ready**: the demo login is created after Coop starts. If it did, [start over](#start-over).

**The review queue or rules are empty.** The terminal says **Couldn't add the demo data** if that step failed. Open a new terminal (**☰** menu → **Terminal** → **New Terminal**) and run `bash .devcontainer/scripts/start.sh` to try again.

**The UI shows red error messages.** A service may have stopped. Press **Ctrl+Shift+P** (**Cmd+Shift+P** on a Mac), type **Rebuild Container**, and choose **Codespaces: Rebuild Container**. This restarts the demo and keeps its data.

**"This codespace requires a machine with at least 4 cores and 16 GB of RAM"**, or no 4-core option. Your account or organization may limit machine types. Ask your organization admin, or create the codespace from a personal account.

**The terminal mentions "rate limit" or "toomanyrequests".** Docker Hub, where Coop's databases come from, limits how often one network address can download without signing in. Wait an hour and rebuild the container (as above), or, if you have a Docker Hub account, add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (an [access token](https://docs.docker.com/security/for-developers/access-tokens/)) as [Codespaces secrets](https://github.com/settings/codespaces) for the `roostorg/coop` repository, then rebuild.

**The terminal said "The Coop demo didn't start cleanly".** Rebuild the container as above. If it happens again, [start over](#start-over). If that fails too, run `docker compose ps -a` in the terminal and share the output with the Coop maintainers in a [GitHub issue](https://github.com/roostorg/coop/issues) or on [Discord](https://discord.gg/5Csqnw2FSQ).

**A message says the codespace is running in recovery mode.** Setting up the codespace failed, often because of a temporary network problem, so it started without Coop. Rebuild the container as above.

<a id="start-over"></a>**I want to start over with fresh demo data.** Rebuilding the container keeps the demo's data. To delete it, open a new terminal (**☰** menu → **Terminal** → **New Terminal**) and run `docker compose down -v && bash .devcontainer/scripts/start.sh`.

**I closed the progress terminal.** Open a new one from the **☰** menu → **Terminal** → **New Terminal**, and run `bash .devcontainer/scripts/status.sh` to see whether the demo is ready.

## For engineers

The configuration lives in [`.devcontainer/`](https://github.com/roostorg/coop/tree/main/.devcontainer): Docker-in-Docker on a 4-core / 16 GB machine, running [`docker-compose.images.yaml`](https://github.com/roostorg/coop/blob/main/docker-compose.images.yaml) with the [`docker-compose.codespaces.yaml`](https://github.com/roostorg/coop/blob/main/.devcontainer/docker-compose.codespaces.yaml) override, which builds the server, client and migrations images from the checkout. The client's nginx proxies `/api/` to the server, so the browser only talks to the forwarded port 3000. [`seed-demo.mjs`](https://github.com/roostorg/coop/blob/main/.devcontainer/scripts/seed-demo.mjs) creates the demo login and adds the demo data through Coop's GraphQL and REST APIs.

- `updateContentCommand` (`prepare.sh`) pulls and builds the images; a prebuild runs it ahead of time.
- `postStartCommand` (`start.sh`) runs on every start or resume: `docker compose up`, then the demo data.
- `docker compose` in the terminal already targets the demo stack, e.g. `docker compose ps` or `docker compose logs -f server`.
- To try a code change, rebuild and restart the changed service, e.g. `docker compose up -d --build client`.

The same configuration works locally with any [devcontainer](https://containers.dev/)-capable tool, such as VS Code's Dev Containers extension or the devcontainer CLI:

```sh
npx @devcontainers/cli up --workspace-folder .
```

Running it locally on a host whose kernel lacks legacy iptables support (seen on Linux 7.0), Docker inside the container fails to start with `can't initialize iptables table 'nat'`. Codespaces machines aren't affected. To work around it, run `sudo update-alternatives --set iptables /usr/sbin/iptables-nft && sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-nft && sudo /usr/local/share/docker-init.sh true` in the container, then `bash .devcontainer/scripts/start.sh`.

The container doesn't include Node.js or pnpm. For a development setup with hot reload, see [Local Development](local.md).
