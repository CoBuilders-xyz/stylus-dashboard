# Maintaining this documentation site

The documentation is served by **Docsify 5** on **GitHub Pages**. Docsify renders the existing Markdown files directly in the browser. Publishing requires no build or package installation.

## Edit a page

Edit its `.md` file under `docs/` and commit it. To add a page, add its link to `_sidebar.md` and its route to the `search.paths` list in `site.js`. The homepage is `docs/README.md`.

Internal Markdown links remain relative so they work on GitHub and in the site. Links to repository source code point to GitHub. JSON evidence and downloadable figures are served as files; they are not documentation pages. Mermaid architecture diagrams render when their page opens.

Second- and third-level headings automatically populate **On this page**: a right sidebar on wide screens and a collapsible index with a visible arrow on smaller screens. The left sidebar contains page links.

The **Appearance** selector in the sidebar offers System, Light and Dark. It defaults to the device preference and saves an explicit choice in local browser storage. Diagrams follow the selected theme; report figures and dashboard screenshots retain their original colors.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8042 --directory docs
```

Open `http://localhost:8042`. Check page navigation, the section index, search, downloads and each theme at desktop and mobile widths.

## GitHub Pages settings

Public URL: <https://cobuilders-xyz.github.io/stylus-dashboard/>

The publishing source is the **`/docs` folder on `release`**, selected in repository **Settings → Pages → Deploy from a branch**. GitHub's built-in Pages deployment serves it automatically. `.nojekyll` ensures underscore-prefixed assets such as `_sidebar.md` are published.

When the release is merged, change the publishing source to **`main` / `/docs`** before deleting the `release` branch. Update the source/edit links from `release` to `main` in `site.js` and the Markdown files at the same time.

## Dependencies and behavior

`index.html` pins Docsify and its search plugin to 5.0.0; `site.js` pins Mermaid to 11.17.2. They load from jsDelivr. No analytics, cookies for tracking, account or API credential is configured. Search builds its index in the visitor's browser. JavaScript is required for the viewer; the same Markdown remains readable directly on GitHub.

Sources: [Docsify quick start](https://github.com/docsifyjs/docsify/blob/v5.0.0/docs/quickstart.md), [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
