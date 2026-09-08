# Maintaining this documentation site

The documentation is served by **Docsify 5** on **GitHub Pages**. Docsify renders the existing Markdown files directly in the browser. There is no build command, package installation, generated HTML tree or custom Actions workflow to maintain.

## Edit a page

Edit its `.md` file under `docs/` and commit it. To add a page, add its link to `_sidebar.md` and its route to the `search.paths` list in `site.js`. The homepage is `docs/README.md`.

Internal Markdown links remain relative so they work on GitHub and in the site. Links to repository source code point to GitHub. JSON evidence and downloadable figures are served as files; they are not documentation pages. Mermaid architecture diagrams render when their page opens.

The deployment guide is maintained in `docs/deployment.md`, alongside the other documentation.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8042 --directory docs
```

Open `http://localhost:8042`. Check the sidebar, search, internal links, report downloads and narrow-screen navigation. Preview uses the same static files as GitHub Pages; it does not start or change the dashboard application.

## GitHub Pages settings

Public URL: <https://cobuilders-xyz.github.io/stylus-dashboard/>

The publishing source is the **`/docs` folder on `release`**, selected in repository **Settings → Pages → Deploy from a branch**. GitHub's built-in Pages deployment serves it automatically. `.nojekyll` ensures underscore-prefixed assets such as `_sidebar.md` are published.

When the release is merged, change the publishing source to **`main` / `/docs`** before deleting the `release` branch. Update the source/edit links from `release` to `main` in `site.js` and the Markdown files at the same time. Until then the site serves the reviewed release documentation without changing the existing application deployment.

## Dependencies and behavior

`index.html` pins Docsify and its search plugin to 5.0.0; `site.js` pins Mermaid to 11.17.2. They load from jsDelivr. No analytics, cookies for tracking, account or API credential is configured. Search builds its index in the visitor's browser. JavaScript is required for the viewer; the same Markdown remains readable directly on GitHub.

This is intentionally a small documentation viewer. If server-rendered content or more advanced versioned docs become necessary, these Markdown sources can be migrated later.

Sources: [Docsify quick start](https://github.com/docsifyjs/docsify/blob/v5.0.0/docs/quickstart.md), [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
