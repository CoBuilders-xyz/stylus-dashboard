const repository = 'https://github.com/CoBuilders-xyz/stylus-dashboard';

window.$docsify = {
  name: 'Stylus Dashboard',
  repo: repository,
  loadSidebar: true,
  subMaxLevel: 2,
  relativePath: true,
  auto2top: true,
  alias: { '/.*/_sidebar.md': '/_sidebar.md' },
  search: {
    paths: [
      '/',
      '/usage',
      '/methodology',
      '/architecture',
      '/deployment',
      '/reports/2026-09-08/README',
      '/fellowship-outcomes',
      '/release',
      '/release-notes',
      '/validation',
      '/publishing',
    ],
    placeholder: 'Search documentation',
    noData: 'No matching pages. Try another term.',
    namespace: 'stylus-dashboard-docs-v1',
    depth: 3,
  },
  plugins: [
    function (hook, vm) {
      // Keep the original Markdown links valid both in GitHub and this viewer.
      // Evidence files are downloads, not Markdown routes.
      hook.afterEach(function (html) {
        const page = new DOMParser().parseFromString(html, 'text/html');
        for (const link of page.querySelectorAll('a[href]')) {
          const href = link.getAttribute('href');
          if (/^#\/.*\.(json|png|svg|gz)(?:$|\?)/.test(href)) {
            link.href = new URL(href.slice(2), new URL('.', location.href)).href;
            link.target = '_blank';
            link.rel = 'noopener';
          }
        }
        const footer = page.createElement('footer');
        footer.className = 'docs-footer';
        const source =
          vm.route.path === '/'
            ? 'README.md'
            : vm.route.path.replace(/^\//, '').replace(/\.md$/, '') + '.md';
        const edit = page.createElement('a');
        edit.href = `${repository}/blob/release/docs/${source}`;
        edit.textContent = 'View this page on GitHub';
        footer.append(edit, ' · Stylus Ecosystem Dashboard · MIT');
        page.body.append(footer);
        return page.body.innerHTML;
      });
      // Only load the diagram renderer on pages that actually contain a diagram.
      hook.doneEach(async function () {
        const blocks = [...document.querySelectorAll('pre[data-lang="mermaid"]')];
        if (!blocks.length) return;
        try {
          const { default: mermaid } =
            await import('https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs');
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
          const nodes = blocks.map((block) => {
            const diagram = document.createElement('div');
            diagram.className = 'mermaid';
            diagram.textContent = block.textContent;
            block.replaceWith(diagram);
            return diagram;
          });
          await mermaid.run({ nodes });
        } catch (error) {
          console.error('Could not render architecture diagram', error);
        }
      });
    },
  ],
};
