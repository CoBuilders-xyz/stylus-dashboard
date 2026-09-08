const repository = 'https://github.com/CoBuilders-xyz/stylus-dashboard';
const colorPreference = matchMedia('(prefers-color-scheme: dark)');
const wideScreen = matchMedia('(min-width: 1280px)');
let theme = 'system';
try {
  const saved = localStorage.getItem('stylus-docs-theme');
  if (['system', 'light', 'dark'].includes(saved)) theme = saved;
} catch {
  // The system preference still works when browser storage is unavailable.
}

function applyTheme() {
  const dark = theme === 'dark' || (theme === 'system' && colorPreference.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.getElementById('dark-theme').media = dark ? 'all' : 'not all';
}
applyTheme();

let diagramWork = Promise.resolve();
function renderDiagrams() {
  diagramWork = diagramWork
    .then(async () => {
      const nodes = [...document.querySelectorAll('.mermaid')];
      if (!nodes.length) return;
      const { default: mermaid } =
        await import('https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral',
      });
      const connected = nodes.filter((node) => node.isConnected);
      for (const node of connected) {
        node.removeAttribute('data-processed');
        node.textContent = node.dataset.source;
      }
      if (connected.length) await mermaid.run({ nodes: connected });
    })
    .catch((error) => console.error('Could not render architecture diagram', error));
}

colorPreference.addEventListener('change', () => {
  if (theme !== 'system') return;
  applyTheme();
  renderDiagrams();
});
wideScreen.addEventListener('change', () => {
  const toc = document.querySelector('.page-toc');
  if (toc) toc.open = wideScreen.matches;
});

window.$docsify = {
  name: 'Stylus Dashboard',
  repo: repository,
  loadSidebar: true,
  subMaxLevel: 0,
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
    namespace: 'stylus-dashboard-docs-v2',
    depth: 3,
  },
  plugins: [
    function (hook, vm) {
      hook.ready(function () {
        const label = document.createElement('label');
        label.className = 'theme-control';
        label.textContent = 'Appearance';
        const select = document.createElement('select');
        for (const [value, text] of [
          ['system', 'System'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ]) {
          select.add(new Option(text, value));
        }
        select.value = theme;
        select.addEventListener('change', () => {
          theme = select.value;
          try {
            localStorage.setItem('stylus-docs-theme', theme);
          } catch {
            /* Optional storage. */
          }
          applyTheme();
          renderDiagrams();
        });
        label.append(select);
        document.querySelector('.app-name').after(label);
      });
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
        const headings = [...page.querySelectorAll('h2, h3')];
        if (headings.length > 1) {
          const toc = page.createElement('details');
          toc.className = 'page-toc';
          const summary = page.createElement('summary');
          summary.textContent = 'On this page';
          const nav = page.createElement('nav');
          nav.setAttribute('aria-label', 'On this page');
          const list = page.createElement('ul');
          for (const heading of headings) {
            const anchor = heading.querySelector('a.anchor');
            if (!anchor) continue;
            const item = page.createElement('li');
            item.className = heading.tagName.toLowerCase();
            const link = page.createElement('a');
            link.href = anchor.getAttribute('href');
            link.textContent = heading.textContent;
            item.append(link);
            list.append(item);
          }
          nav.append(list);
          toc.append(summary, nav);
          page.querySelector('h1')?.after(toc);
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
      hook.doneEach(function () {
        const toc = document.querySelector('.page-toc');
        if (toc) toc.open = wideScreen.matches;
        for (const block of document.querySelectorAll('pre[data-lang="mermaid"]')) {
          const diagram = document.createElement('div');
          diagram.className = 'mermaid';
          diagram.dataset.source = block.textContent;
          diagram.textContent = block.textContent;
          block.replaceWith(diagram);
        }
        renderDiagrams();
      });
    },
  ],
};
