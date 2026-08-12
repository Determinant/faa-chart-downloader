import { FAR_NARROW_BREAKPOINT } from './config.ts';
import { seqnumIdFromSectno } from './xml-index.ts';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function inlineScript(code) {
    return `<script type="text/javascript">\n${String(code || '').replace(/<\/script/gi, '<\\/script')}\n</script>`;
}

function renderNavSectionLink(href, section, className = '') {
    const subjectTail = section.subject ? ` ${section.subject}` : '';
    return `<li${className ? ` class="${className}"` : ''}><a href="${escapeHtml(href)}#seqnum${escapeHtml(seqnumIdFromSectno(section.sectno))}" target="partView">${escapeHtml(section.sectno + subjectTail)}</a></li>`;
}
const SHELL_LAYOUT_CSS = `    :root { color-scheme: light; --far-ink: #172033; --far-blue: #0f4f9b; --far-border: #d0d7de; --far-panel: #f8fafc; --far-accent: #0b3954; }
    html, body { margin: 0; padding: 0; height: 100%; font-family: Georgia, "Times New Roman", serif; font-size: 1.05rem; color: var(--far-ink); }
    body { overflow: hidden; }
    button, input { font: inherit; }
    button { -webkit-tap-highlight-color: transparent; }
    #layout { display: grid; grid-template-columns: minmax(260px, clamp(260px, 28vw, 390px)) minmax(0, 1fr); height: 100vh; height: 100dvh; width: 100%; overflow: hidden; }
    #sidebar { position: relative; z-index: 30; min-width: 0; border-right: 1px solid var(--far-border); background: var(--far-panel); overflow-y: auto; padding: 0.9rem 1rem 1.4rem; box-sizing: border-box; overscroll-behavior: contain; }
    .sidebar-head { display: flex; align-items: flex-start; gap: 0.55rem; }
    #meta { flex: 1; min-width: 0; font-size: 0.95rem; color: #334155; margin-bottom: 0.8rem; line-height: 1.4; }
    .sidebar-close { display: none; }
    #mobilebar { display: none; }
    #sidebarBackdrop { display: none; }
    #searchPanel { margin: 0 0 1rem; }
    .search-label { display: block; margin: 0 0 0.35rem; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.02em; color: #475569; }
    .search-field { display: flex; align-items: center; gap: 0.3rem; border: 1px solid #b9c5d3; border-radius: 0.45rem; background: #fff; padding: 0.15rem 0.25rem 0.15rem 0.6rem; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    #searchInput { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--far-ink); background: transparent; font-size: 0.98rem; }
    #searchInput::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
    #searchInput::-ms-clear { display: none; }
    #searchInput::placeholder { color: #8793a3; }
    #searchInput:focus-visible { outline: 2px solid #7bb4dd; outline-offset: 2px; border-radius: 0.2rem; }
    .search-clear { flex: 0 0 auto; min-width: 2.75rem; min-height: 2.75rem; border: 0; background: transparent; color: #64748b; border-radius: 0.25rem; cursor: pointer; padding: 0.12rem 0.32rem; line-height: 1; }
    .search-clear:hover, .search-clear:focus-visible { background: #e8eef5; color: var(--far-ink); }
    #searchStatus { min-height: 1.15rem; margin: 0.38rem 0 0; color: #64748b; font-size: 0.82rem; }
    #searchResults { display: none; list-style: none; margin: 0; padding: 0; }
    #sidebar.searching #toc { display: none; }
    #sidebar.searching #searchResults { display: block; }
    .search-result { display: block; width: 100%; text-align: left; border: 1px solid #dbe3ed; border-radius: 0.45rem; background: #fff; color: var(--far-ink); cursor: pointer; padding: 0.55rem 0.6rem; margin: 0 0 0.45rem; }
    .search-result:hover, .search-result:focus-visible { border-color: #87a9c6; background: #f5faff; }
    .search-result-title { display: block; color: var(--far-blue); font-weight: 700; line-height: 1.25; }
    .search-result-context { display: block; margin-top: 0.2rem; color: #64748b; font-size: 0.8rem; line-height: 1.3; }
    .search-result-snippet { display: block; margin-top: 0.28rem; color: #334155; font-size: 0.84rem; line-height: 1.4; }
    #sidebar ul { list-style: none; margin: 0; padding: 0; }
    #sidebar li { margin: 0.32rem 0; }
    #sidebar li.toc-part-block { margin-top: 0.75rem; }
    #sidebar li.toc-subpart-block, #sidebar li.toc-subjgrp-block { margin-left: 0.6rem; }
    #sidebar .toc-part-title { font-weight: 700; }
    #sidebar .toc-subpart-title { margin-top: 0.45rem; font-weight: 600; color: #334155; }
    #sidebar .toc-subjgrp-title { margin-top: 0.25rem; font-style: italic; color: #475569; }
    #sidebar li.toc-subpart-section { margin-left: 1.2rem; }
    #sidebar li.toc-subjgrp-section { margin-left: 1.8rem; }
    #sidebar ul.toc-sublist { margin: 0; padding: 0; list-style: none; }
    #sidebar a { text-decoration: none; color: var(--far-blue); }
    #sidebar a:hover { text-decoration: underline; }
    #main { position: relative; min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
    #main iframe { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
    @media (max-width: ${FAR_NARROW_BREAKPOINT}px) {
      #layout { display: block; }
      body.toc-open { overflow: hidden; }
      #mobilebar { position: fixed; inset: 0 0 auto; z-index: 10; display: flex; align-items: center; gap: 0.5rem; height: calc(3.25rem + env(safe-area-inset-top)); padding: calc(0.45rem + env(safe-area-inset-top)) 0.65rem 0.45rem; box-sizing: border-box; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid var(--far-border); box-shadow: 0 1px 8px rgba(15, 23, 42, 0.08); }
      .mobilebar-button { min-height: 2.75rem; border: 1px solid #b9c5d3; border-radius: 0.42rem; background: #fff; color: var(--far-accent); cursor: pointer; padding: 0.42rem 0.65rem; line-height: 1; }
      .mobilebar-button:hover, .mobilebar-button:focus-visible { background: #eef6fb; border-color: #7eaac8; }
      .mobilebar-title { overflow: hidden; flex: 1; color: #475569; font-size: 0.9rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
      #sidebar { position: fixed; inset: 0 auto 0 0; width: min(88vw, 370px); padding-bottom: calc(1.4rem + env(safe-area-inset-bottom)); transform: translateX(-105%); visibility: hidden; border-right: 1px solid var(--far-border); box-shadow: 12px 0 30px rgba(15, 23, 42, 0.18); transition: transform 180ms ease, visibility 180ms ease; }
      body.toc-open #sidebar { transform: translateX(0); visibility: visible; }
      .sidebar-close { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 2.75rem; height: 2.75rem; border: 1px solid #b9c5d3; border-radius: 0.4rem; background: #fff; color: #334155; cursor: pointer; font-size: 1.2rem; line-height: 1; }
      .sidebar-close:hover, .sidebar-close:focus-visible { background: #eef6fb; }
      #sidebarBackdrop { position: fixed; inset: 0; z-index: 20; display: block; background: rgba(15, 23, 42, 0.38); opacity: 0; pointer-events: none; transition: opacity 180ms ease; }
      body.toc-open #sidebarBackdrop { opacity: 1; pointer-events: auto; }
      #main { height: 100%; padding-top: calc(3.25rem + env(safe-area-inset-top)); box-sizing: border-box; }
    }
    @media (prefers-reduced-motion: reduce) { #sidebar, #sidebarBackdrop { transition: none; } }`;

function buildShellSidebarHtml({ title, chapter, sourceDescription, scopeDescription, itemHtml }) {
    return `
      <div id="mobilebar">
        <div class="mobilebar-title">Federal Aviation Regulations</div>
        <button id="mobileTocToggle" class="mobilebar-button" type="button" aria-label="Open table of contents and search" aria-controls="sidebar" aria-expanded="false">☰</button>
      </div>
      <div id="sidebarBackdrop" aria-hidden="true"></div>
      <aside id="sidebar">
        <div class="sidebar-head">
          <div id="meta">
            <div><strong>Title ${escapeHtml(title)}</strong>, Chapter ${escapeHtml(chapter)}</div>
            <div>Source: ${escapeHtml(sourceDescription)}</div>
            <div>Scope: ${escapeHtml(scopeDescription)}</div>
          </div>
          <button id="sidebarClose" class="sidebar-close" type="button" aria-label="Close table of contents">×</button>
        </div>
        <div id="searchPanel" role="search">
          <label class="search-label" for="searchInput">Search FAR</label>
          <div class="search-field">
            <input id="searchInput" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Section, topic, or phrase…" aria-controls="searchResults" aria-describedby="searchStatus">
            <button id="searchClear" class="search-clear" type="button" aria-label="Clear search" hidden>×</button>
          </div>
          <div id="searchStatus" aria-live="polite"></div>
        </div>
        <ol id="searchResults"></ol>
        <ul id="toc">
${itemHtml}
        </ul>
      </aside>`;
}

const SHELL_SEARCH_SCRIPT = `  <script>
    (function () {
      var sidebar = document.getElementById('sidebar');
      var backdrop = document.getElementById('sidebarBackdrop');
      var tocToggle = document.getElementById('mobileTocToggle');
      var closeButton = document.getElementById('sidebarClose');
      var input = document.getElementById('searchInput');
      var clearButton = document.getElementById('searchClear');
      var status = document.getElementById('searchStatus');
      var resultsList = document.getElementById('searchResults');
      var payloadNode = document.getElementById('partPayload');
      if (!sidebar || !input || !resultsList) return;

      var payload = {};
      try {
        payload = JSON.parse(payloadNode ? payloadNode.textContent : '{}');
      } catch (err) {
        payload = {};
      }

      var documents = (payload && Array.isArray(payload.search)) ? payload.search : [];
      var docsByPath = (payload && payload.parts) ? payload.parts : {};
      var narrowQuery = window.matchMedia ? window.matchMedia('(max-width: ${FAR_NARROW_BREAKPOINT}px)') : null;
      var searchTimer = null;
      var hydrated = false;
      var hydrationPromise = null;
      var searchEngine = null;
      var searchContentAvailable = documents.some(function (entry) { return String(entry.text || '').trim().length > 0; });
      var lastDrawerTrigger = null;

      function normalizeSearchText(value) {
        return String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\\s+/g, ' ').trim();
      }

      function queryTokens(value) {
        return normalizeSearchText(value).split(' ').filter(Boolean);
      }

      function targetPath(target) {
        return String(target || '').split('#')[0];
      }

      function sourceForPath(path) {
        if (Object.prototype.hasOwnProperty.call(docsByPath, path)) {
          return Promise.resolve(docsByPath[path]);
        }

        var keys = Object.keys(docsByPath);
        for (var i = 0; i < keys.length; i += 1) {
          if (targetPath(keys[i]) === path) return Promise.resolve(docsByPath[keys[i]]);
        }

        if (typeof window.fetch !== 'function') return Promise.resolve('');
        return window.fetch(path).then(function (response) {
          return response.ok ? response.text() : '';
        }).catch(function () {
          return '';
        });
      }

      function buildSearchEngine() {
        if (typeof MiniSearch !== 'function') return;

        searchEngine = new MiniSearch({
          fields: ['title', 'context', 'text'],
          storeFields: ['target', 'sectno', 'subject', 'partHeading', 'subpart', 'subjectGroup', 'title', 'context', 'text'],
          tokenize: queryTokens,
          searchOptions: {
            combineWith: 'AND',
            prefix: true,
            fuzzy: 0.2,
            boost: { title: 3, context: 1.5 }
          }
        });

        searchEngine.addAll(documents.map(function (entry, index) {
          return {
            id: index,
            target: entry.target,
            sectno: entry.sectno,
            subject: entry.subject,
            partHeading: entry.partHeading,
            subpart: entry.subpart,
            subjectGroup: entry.subjectGroup,
            title: [entry.sectno, entry.subject].filter(Boolean).join(' '),
            context: [entry.partHeading, entry.subpart, entry.subjectGroup].filter(Boolean).join(' · '),
            text: entry.text || ''
          };
        }));
      }

      function hydrateFromPartPages() {
        var paths = Object.create(null);
        documents.forEach(function (entry) {
          var path = targetPath(entry.target);
          if (path) paths[path] = true;
        });

        var parser = typeof window.DOMParser === 'function' ? new DOMParser() : null;
        return Promise.all(Object.keys(paths).map(function (path) {
          return sourceForPath(path).then(function (source) {
            if (!parser || !source) return { path: path, document: null };
            try {
              return { path: path, document: parser.parseFromString(source, 'text/html') };
            } catch (err) {
              return { path: path, document: null };
            }
          });
        })).then(function (parsedParts) {
          var documentsByPath = Object.create(null);
          parsedParts.forEach(function (item) { documentsByPath[item.path] = item.document; });

          documents.forEach(function (entry) {
            var partDocument = documentsByPath[targetPath(entry.target)];
            var hash = String(entry.target || '').split('#')[1] || '';
            var section = partDocument && hash ? partDocument.getElementById(hash) : null;
            entry.text = section ? section.textContent : '';
          });
          return documents.some(function (entry) { return String(entry.text || '').trim().length > 0; });
        });
      }

      function hydrateDocuments() {
        if (searchContentAvailable) {
          return Promise.resolve().then(function () {
            buildSearchEngine();
            hydrated = true;
          });
        }

        return hydrateFromPartPages().then(function (loadedFromParts) {
          searchContentAvailable = loadedFromParts;
          buildSearchEngine();
          hydrated = true;
        });
      }

      function ensureHydrated() {
        if (hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          status.textContent = 'Preparing local search…';
          hydrationPromise = hydrateDocuments().catch(function () {
            hydrated = true;
          });
        }
        return hydrationPromise;
      }

      function isNarrow() {
        return narrowQuery ? narrowQuery.matches : window.innerWidth <= ${FAR_NARROW_BREAKPOINT};
      }

      function setDrawer(open) {
        if (!isNarrow()) return;
        if (open) lastDrawerTrigger = tocToggle;
        document.body.classList.toggle('toc-open', open);
        tocToggle && tocToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (!open && lastDrawerTrigger && typeof lastDrawerTrigger.focus === 'function') {
          var trigger = lastDrawerTrigger;
          lastDrawerTrigger = null;
          window.setTimeout(function () { trigger.focus(); }, 0);
        }
      }

      function closeDrawer() {
        setDrawer(false);
      }

      function openDrawer() {
        setDrawer(true);
      }

      window.__FAR_CLOSE_DRAWER = closeDrawer;
      window.__FAR_OPEN_DRAWER = openDrawer;
      if (isNarrow()) sidebar.setAttribute('aria-hidden', 'true');

      tocToggle && tocToggle.addEventListener('click', openDrawer);
      closeButton && closeButton.addEventListener('click', closeDrawer);
      backdrop && backdrop.addEventListener('click', closeDrawer);
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeDrawer();
      });
      window.addEventListener('resize', function () {
        if (!isNarrow()) {
          document.body.classList.remove('toc-open');
          sidebar.setAttribute('aria-hidden', 'false');
        }
      });

      function snippet(text, tokens) {
        var value = String(text || '').replace(/\\s+/g, ' ').trim();
        if (!value) return '';
        var lower = value.toLocaleLowerCase();
        var hit = -1;
        tokens.some(function (token) {
          var candidate = lower.indexOf(token);
          if (candidate !== -1 && (hit === -1 || candidate < hit)) hit = candidate;
          return candidate === 0;
        });
        if (hit < 0) hit = 0;
        var start = Math.max(0, hit - 62);
        var end = Math.min(value.length, start + 190);
        var result = value.slice(start, end);
        if (start > 0) result = '…' + result;
        if (end < value.length) result += '…';
        return result;
      }

      function search(value) {
        var raw = String(value || '').trim();
        clearButton.hidden = !raw;
        if (!raw) {
          sidebar.classList.remove('searching');
          status.textContent = '';
          resultsList.replaceChildren();
          return;
        }

        sidebar.classList.add('searching');
        var tokens = queryTokens(raw);
        if (tokens.length === 0) {
          status.textContent = 'Keep typing to search.';
          resultsList.replaceChildren();
          return;
        }

        if (!hydrated) {
          ensureHydrated().then(function () {
            if (input.value.trim() === raw) search(input.value);
          });
          return;
        }

        if (!searchEngine) {
          status.textContent = 'Search is unavailable.';
          resultsList.replaceChildren();
          return;
        }

        var rawSearch = normalizeSearchText(raw);
        var matches = searchEngine.search(raw).map(function (result) {
          var titleSearch = normalizeSearchText([result.title, result.context].filter(Boolean).join(' '));
          var score = result.score + (titleSearch.indexOf(rawSearch) !== -1 ? 100 : 0);
          return { result: result, score: score };
        });
        matches.sort(function (left, right) { return right.score - left.score; });
        matches = matches.slice(0, 50);
        status.textContent = searchContentAvailable
          ? matches.length + (matches.length === 1 ? ' result' : ' results')
          : 'Full-text search data is unavailable. Rebuild the FAR site.';
        resultsList.replaceChildren();

        matches.forEach(function (match) {
          var result = match.result;
          var item = document.createElement('li');
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'search-result';

          var title = document.createElement('span');
          title.className = 'search-result-title';
          title.textContent = result.title;
          button.appendChild(title);

          var context = document.createElement('span');
          context.className = 'search-result-context';
          context.textContent = result.context;
          button.appendChild(context);

          var excerpt = document.createElement('span');
          excerpt.className = 'search-result-snippet';
          excerpt.textContent = snippet(result.text, tokens);
          button.appendChild(excerpt);

          button.addEventListener('click', function () {
            if (typeof window.__FAR_NAVIGATE === 'function') window.__FAR_NAVIGATE(result.target);
            closeDrawer();
          });
          item.appendChild(button);
          resultsList.appendChild(item);
        });
      }

      input.addEventListener('input', function () {
        if (searchTimer) window.clearTimeout(searchTimer);
        var value = input.value;
        searchTimer = window.setTimeout(function () { search(value); }, 90);
      });
      input.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        var first = resultsList.querySelector('.search-result');
        if (first) {
          event.preventDefault();
          first.click();
        }
      });
      clearButton && clearButton.addEventListener('click', function () {
        input.value = '';
        input.focus();
        search('');
      });
    }());
  </script>`;

function buildSidebarItemsHtml(parts) {
    return parts.map(part => {
        const titleText = part.heading ? `${part.ear} — ${part.heading}` : part.ear;
        const topSectionItems = part.topSections.map(sec => `              ${renderNavSectionLink(part.href, sec)}`).join('\n');
        const topSubjectGroupItems = (part.topSubjectGroups || []).map(group => {
            const groupSections = group.sections.map(sec => `                  ${renderNavSectionLink(part.href, sec, 'toc-subjgrp-section')}`).join('\n');
            return `              <li class="toc-subjgrp-block">\n` +
                `                <div class="toc-subjgrp-title">${escapeHtml(group.title)}</div>\n` +
                `                <ul class="toc-subjgrp-list">\n${groupSections}\n                </ul>\n` +
                `              </li>`;
        }).join('\n');
        const subpartItems = part.subparts.map(subpart => {
            const sections = subpart.sections.map(sec => `                  ${renderNavSectionLink(part.href, sec, 'toc-subpart-section')}`).join('\n');
            const subjgrpItems = subpart.subjgrps.map(group => {
                const groupSections = group.sections.map(sec => `                      ${renderNavSectionLink(part.href, sec, 'toc-subjgrp-section')}`).join('\n');
                return `                  <li class="toc-subjgrp-block">\n` +
                    `                    <div class="toc-subjgrp-title">${escapeHtml(group.title)}</div>\n` +
                    `                    <ul class="toc-subjgrp-list">\n${groupSections}\n                    </ul>\n` +
                    `                  </li>`;
            }).join('\n');
            return `              <li class="toc-subpart-block">\n` +
                `                <div class="toc-subpart-title">${escapeHtml(subpart.title)}</div>\n` +
                `                <ul class="toc-subpart-list">\n` +
                `${sections}${sections && subjgrpItems ? '\n' : ''}${subjgrpItems}\n` +
                `                </ul>\n` +
                `              </li>`;
        }).join('\n');

        return `          <li class="toc-part-block">\n` +
            `            <div class="toc-part-title"><a href="${escapeHtml(part.href)}" target="partView">${escapeHtml(titleText)}</a></div>\n` +
            `            <ul class="toc-sublist">\n` +
            `${topSectionItems}${topSectionItems && (topSubjectGroupItems || subpartItems) ? '\n' : ''}${topSubjectGroupItems}${topSubjectGroupItems && subpartItems ? '\n' : ''}${subpartItems}\n` +
            `            </ul>\n` +
            `          </li>`;
    }).join('\n');
}

function buildSplitIndexHtml({ title, chapter, sourceDescription, scopeDescription, parts, defaultSrc, searchEntries = [], searchVendorJs = '' }) {
    const itemHtml = buildSidebarItemsHtml(parts);
    const payloadJson = JSON.stringify({ search: searchEntries }).replace(/<\/script/gi, '<\\/script');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FAR by Part</title>
  <style>
${SHELL_LAYOUT_CSS}
  </style>
</head>
<body>
  <div id="layout">
${buildShellSidebarHtml({ title, chapter, sourceDescription, scopeDescription, itemHtml })}
    <main id="main">
      <iframe name="partView" src="${escapeHtml(defaultSrc)}" loading="eager"></iframe>
    </main>
  </div>
  <script id="partPayload" type="application/json">${payloadJson}</script>
  ${inlineScript(searchVendorJs)}
  <script>
    (function () {
      var iframe = document.querySelector('iframe[name="partView"]');
      if (!iframe) return;

      var navLinks = Array.prototype.slice.call(
        document.querySelectorAll('#sidebar a[target="partView"]')
      );
      var HASH_PREFIX = '#target=';
      var allowedTargets = Object.create(null);
      var currentTarget = '';

      function canonicalizeTarget(target) {
        var value = String(target || '').trim();
        if (!value) return '';
        while (value.indexOf('./') === 0) value = value.slice(2);
        while (value.charAt(0) === '/') value = value.slice(1);
        return value;
      }

      function splitTarget(target) {
        var canonical = canonicalizeTarget(target);
        if (!canonical) return { target: '', path: '', hash: '' };
        var hashIndex = canonical.indexOf('#');
        if (hashIndex === -1) return { target: canonical, path: canonical, hash: '' };
        return {
          target: canonical,
          path: canonical.slice(0, hashIndex),
          hash: canonical.slice(hashIndex)
        };
      }

      navLinks.forEach(function (link) {
        var href = canonicalizeTarget(link.getAttribute('href') || '');
        if (href) allowedTargets[href] = true;
      });

      function isAllowedTarget(target) {
        var parsed = splitTarget(target);
        if (!parsed.target) return false;
        if (allowedTargets[parsed.target] !== true) return false;
        return true;
      }

      function buildHash(target) {
        return HASH_PREFIX + encodeURIComponent(canonicalizeTarget(target));
      }

      function parseHashTarget(hash) {
        if (!hash) return null;
        if (hash.indexOf(HASH_PREFIX) === 0) {
          try {
            var decoded = canonicalizeTarget(decodeURIComponent(hash.slice(HASH_PREFIX.length)));
            return isAllowedTarget(decoded) ? decoded : null;
          } catch (err) {
            return null;
          }
        }

        // Backward compatibility: allow direct section hash like #seqnum61.57
        if (hash.indexOf('#seqnum') === 0) {
          for (var i = 0; i < navLinks.length; i += 1) {
            var href = canonicalizeTarget(navLinks[i].getAttribute('href') || '');
            if (!href) continue;
            var hashIndex = href.indexOf('#');
            if (hashIndex === -1) continue;
            if (href.slice(hashIndex) === hash) return href;
          }
        }
        return null;
      }

      function setShellHash(target, replaceOnly) {
        var canonical = canonicalizeTarget(target);
        if (!canonical) return;
        if (!isAllowedTarget(canonical)) return;
        var wanted = buildHash(canonical);
        if (window.location.hash === wanted) return;
        if (replaceOnly && window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', wanted);
          return;
        }
        window.location.hash = wanted;
      }

      function setFrameHash(hash) {
        try {
          if (!iframe.contentWindow || !iframe.contentWindow.location) return;
          if (!hash) {
            iframe.contentWindow.location.hash = '';
            if (typeof iframe.contentWindow.scrollTo === 'function') {
              iframe.contentWindow.scrollTo(0, 0);
            }
            return;
          }
          iframe.contentWindow.location.hash = hash;
        } catch (err) {
          // Ignore cross-context issues.
        }
      }

      function loadTarget(target) {
        var parsed = splitTarget(target);
        if (!parsed.target) return false;
        if (!isAllowedTarget(parsed.target)) return false;

        currentTarget = parsed.target;
        if (canonicalizeTarget(iframe.getAttribute('src') || '') !== parsed.target) {
          iframe.setAttribute('src', parsed.target);
        }
        return true;
      }

      function loadFromHash() {
        var target = parseHashTarget(window.location.hash);
        if (!target) return false;
        return loadTarget(target);
      }

      function relativeTargetFromIframeLocation() {
        try {
          var frameUrl = new URL(iframe.contentWindow.location.href, window.location.href);
          var shellUrl = new URL(window.location.href);
          var baseDir = shellUrl.pathname.replace(/[^/]*$/, '/');
          var relPath = frameUrl.pathname;
          if (relPath.indexOf(baseDir) === 0) {
            relPath = relPath.slice(baseDir.length);
          } else if (relPath.charAt(0) === '/') {
            relPath = relPath.slice(1);
          }
          var candidate = canonicalizeTarget(relPath + (frameUrl.search || '') + (frameUrl.hash || ''));
          return isAllowedTarget(candidate) ? candidate : '';
        } catch (err) {
          var fallback = canonicalizeTarget(iframe.getAttribute('src') || '');
          return isAllowedTarget(fallback) ? fallback : '';
        }
      }

      navLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
          event.preventDefault();
          var href = canonicalizeTarget(link.getAttribute('href') || '');
          if (!href) return;
          if (!loadTarget(href)) return;
          setShellHash(href, false);
          if (typeof window.__FAR_CLOSE_DRAWER === 'function') window.__FAR_CLOSE_DRAWER();
        });
      });

      window.__FAR_NAVIGATE = function (target) {
        var href = canonicalizeTarget(target);
        if (!href || !loadTarget(href)) return false;
        setShellHash(href, false);
        return true;
      };

      window.addEventListener('hashchange', function () {
        loadFromHash();
      });

      iframe.addEventListener('load', function () {
        var target = relativeTargetFromIframeLocation();
        if (target) setShellHash(target, true);
      });

      if (!loadFromHash()) {
        var initial = canonicalizeTarget(iframe.getAttribute('src') || '');
        if (initial && loadTarget(initial)) {
          setShellHash(initial, true);
        }
      }
    }());
  </script>
${SHELL_SEARCH_SCRIPT}
</body>
</html>`;
}

export {
    buildSplitIndexHtml
};
