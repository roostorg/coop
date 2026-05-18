# AGENTS.md for docs/

Documentation-specific instructions for AI coding agents working on Coop.

See also:

- [org-wide documentation guidelines](https://github.com/roostorg/community/blob/main/documentation.md)

Do not duplicate documentation across multiple pages; instead, link to the relevant page/section as a reference.

## mdBook

Docs use [mdBook](https://rust-lang.github.io/mdBook/) to render Markdown to a documentation website. Follow mdBook conventions.

- file naming: docs paths and pages should be short and kebab-cased (except for the special-case SUMMARY.md and README.md)
- links: links should use a descriptive link name and link directly to the Markdown file or section; e.g. `learn more about [Item Types](concepts.md#item-type)`
  - When linking to a section, link to the directory instead of the README.md; e.g. `See the [API Reference](../api/) for details`

## Docs organization

The docs are split into four sub-sections: User Guide, Development Guide, API Reference, and Integrations.

- **user/**: User Guide with user- and adopter-oriented information. Avoid overly technical information including code snippets and API references.

- **development/**: Development Guide with developer-oriented information for contributors and platform engineers. How to get Coop running, how the code is organized, and how to develop it.

- **api/**: API Reference covering all Coop endpoints, requests, and responses.

- **integrations/**: Integrations documentation for built-in integrations, model card information, and how to add a custom integration.

Special files:

- **SUMMARY.md**: defines which pages show in the docs and how they're organized in the sidebar. All documentation pages must be included here to be readable.

- **README.md**: each docs folder has a README.md at its root which is rendered as the section's index. Introduces the section and optionally links to sub-pages. The root docs/README.md serves as a "Welcome" page with links to each sub-section and basic contributing information.

## Writing style

- Avoid space-separated em-dashes (`—`); instead, use semicolons, colons, or commas where appropriate

- Minimal use of non-space-separated em-dashes is allowed for true asides, e.g. `When Coop triggers an Action—whether through an automated rule or a decision in the Review Console—it sends a POST request to the callback URL`

- Use consistent terminology, favoring what is visible in the Coop UI over technical names found in the code
  - "Review Console", not "Manual Review Tool" or "MRT"
  - "Jobs", not "Tasks"
  - "Proactive Rules", not "Automated Enforcement Rules" or "Automation Rules"

- Use **bold** for user interface strings the user should select in instructions, e.g. `Select **Save Changes**` or `Navigate to **Review Console** → **Routing**`

- Use _italic_ for example strings, e.g. `your Item Types might be _Profile_, _Post_, _Comment_, and _Comment Thread_` or `if you create a _Delete_ Action in Coop, you must provide an API endpoint`
