import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { relativeOutputReference } from './fs-utils.ts';
import { LOCAL_SEARCH_CLIENT_CORE_JS } from './local-search-client.ts';
import { readMiniSearchVendorAsset } from './site.ts';

type AimSearchEntry = {
    title: string;
    context: string;
    text: string;
    url: string;
};

function collapseWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

export function extractAimSearchEntries(html, filePath): AimSearchEntry[] {
    const dom = new JSDOM(html);
    try {
        const document = dom.window.document;
        const main = document.querySelector('main[role="main"], main');
        if (!main) return [];

        const chapter = collapseWhitespace(
            main.querySelector('.chapter-title, .chapter-link-title')?.textContent
        );
        const section = collapseWhitespace(
            main.querySelector('.section-title, h1.title.topictitle1')?.textContent
        );
        const context = [...new Set([chapter, section].filter(Boolean))].join(' · ');
        const paragraphHeadings = [...main.querySelectorAll('h4.paragraph-title[id]')];

        if (paragraphHeadings.length > 0) {
            return paragraphHeadings.map((heading) => {
                const parts = [heading.textContent || ''];
                let sibling = heading.nextElementSibling;
                while (sibling && !sibling.matches('h4.paragraph-title[id]')) {
                    parts.push(sibling.textContent || '');
                    sibling = sibling.nextElementSibling;
                }

                return {
                    title: collapseWhitespace(heading.textContent),
                    context,
                    text: collapseWhitespace(parts.join(' ')),
                    url: `${filePath}#${heading.id}`
                };
            });
        }

        const title = collapseWhitespace(
            main.querySelector('h1')?.textContent || document.title || filePath
        );
        return [{
            title,
            context: context && context !== title ? context : '',
            text: collapseWhitespace(main.textContent),
            url: filePath
        }];
    } finally {
        dom.window.close();
    }
}

export function rewriteAimSearchForm(html, sourceFile) {
    const searchRef = relativeOutputReference(sourceFile, 'search.html');
    return html.replace(
        /<form\b(?=[^>]*\bid=(['"])search_form\1)[^>]*>[\s\S]*?<\/form>/i,
        (formHtml) => {
            const openingEnd = formHtml.indexOf('>');
            const openingTag = formHtml.slice(0, openingEnd + 1)
                .replace(/\s+action=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
                .replace(/\s+method=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
                .replace(/>$/, ` action="${searchRef}" method="get">`);
            const body = formHtml.slice(openingEnd + 1).replace(
                /<input\b[^>]*\bname=['"](?:utf8|affiliate)['"][^>]*>/gi,
                ''
            );
            return openingTag + body;
        }
    );
}

function buildAimSearchPage() {
    return `<!doctype html>
<html lang="en-us">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search the AIM</title>
  <link rel="stylesheet" href="./css/atc-main.css">
  <link rel="stylesheet" href="./commonltr.css">
  <link rel="stylesheet" href="./aim-search.css">
</head>
<body id="aim-body">
  <header class="header">
    <nav class="navbar" role="navigation" aria-label="Main navigation">
      <div class="navbar-brand">
        <a class="navbar-item publication_name" href="./index.html"><span>AIM</span></a>
        <div class="navbar-search">
          <form id="search_form" action="./search.html" method="get" accept-charset="UTF-8" role="search">
            <input id="search-input" name="query" type="search" placeholder="Search the AIM" aria-label="Search the AIM" title="Search field" autocomplete="off">
            <button type="submit" class="search-submit" aria-label="Submit search">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          </form>
        </div>
      </div>
    </nav>
  </header>
  <main class="aim-search-page">
    <p class="aim-search-kicker"><a href="./index.html">Aeronautical Information Manual</a></p>
    <h1>Search the AIM</h1>
    <p id="aim-search-status" class="aim-search-status" aria-live="polite">Preparing local search…</p>
    <ol id="aim-search-results" class="aim-search-results"></ol>
    <noscript><p>Local AIM search requires JavaScript. The rest of the downloaded manual remains available without it.</p></noscript>
  </main>
  <script src="./aim-search-vendor.js"></script>
  <script src="./aim-search-index.js"></script>
  <script src="./aim-search.js"></script>
</body>
</html>
`;
}

const AIM_SEARCH_CSS = `/* Generated by download-aim.ts. */
.aim-search-page {
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 58rem;
  min-height: calc(100vh - var(--navbar-height));
  padding: 2.5rem 1.25rem 4rem;
}
.aim-search-page h1 { margin: 0 0 0.5rem; }
.aim-search-kicker { margin: 0 0 0.5rem; }
.aim-search-status { color: #565c65; margin: 0.5rem 0 1.5rem; }
.aim-search-results { list-style: none; margin: 0; padding: 0; }
.aim-search-result { border-top: 1px solid #dfe1e2; padding: 1.25rem 0; }
.aim-search-result:first-child { border-top: 0; }
.aim-search-result > a { display: block; color: #005ea2; font-family: 'Roboto Condensed', sans-serif; font-size: 1.3rem; font-weight: 700; line-height: 1.3; }
.aim-search-result > .aim-search-context { display: block; color: #565c65; font-size: 0.9rem; line-height: 1.35; margin: 0.35rem 0 0; }
.aim-search-result > .aim-search-snippet { display: block; line-height: 1.5; margin: 0.45rem 0 0; }
@media screen and (max-width: 520px) {
  .navbar-brand { gap: 0.65rem; }
  .navbar-brand .navbar-item { margin-left: 0.5rem; }
  #search-input { width: min(58vw, 200px); }
  .aim-search-page { padding-left: 0.9rem; padding-right: 0.9rem; }
}
`;

const AIM_SEARCH_JS = `/* Generated by download-aim.ts. */
!function () {
  'use strict';

  var input = document.getElementById('search-input');
  var status = document.getElementById('aim-search-status');
  var results = document.getElementById('aim-search-results');
  var documents = Array.isArray(globalThis.AIM_SEARCH_DOCUMENTS)
    ? globalThis.AIM_SEARCH_DOCUMENTS
    : [];

${LOCAL_SEARCH_CLIENT_CORE_JS}

  var searchEngine = buildLocalSearchEngine(documents.map(function (entry, index) {
    return {
      id: index,
      url: entry.url,
      title: entry.title,
      context: entry.context,
      text: entry.text || ''
    };
  }), ['url', 'title', 'context', 'text']);

  function render(query) {
    var tokens = queryTokens(query);
    results.replaceChildren();

    if (tokens.length === 0) {
      status.textContent = query
        ? 'Keep typing to search.'
        : 'Enter a section number, topic, abbreviation, or phrase.';
      return;
    }

    if (!searchEngine) {
      status.textContent = 'Local search is unavailable.';
      return;
    }

    var matches = rankLocalSearchResults(searchEngine, query);
    status.textContent = matches.length
      ? matches.length + ' local result' + (matches.length === 1 ? '' : 's') + ' for “' + query + '”.'
      : 'No local AIM results for “' + query + '”.';

    matches.slice(0, LOCAL_SEARCH_RESULT_LIMIT).forEach(function (match) {
      var result = match.result;
      var item = document.createElement('li');
      item.className = 'aim-search-result';

      var link = document.createElement('a');
      link.href = result.url;
      link.textContent = result.title;
      item.appendChild(link);

      if (result.context) {
        var context = document.createElement('p');
        context.className = 'aim-search-context';
        context.textContent = result.context;
        item.appendChild(context);
      }

      var excerpt = document.createElement('p');
      excerpt.className = 'aim-search-snippet';
      excerpt.textContent = searchResultSnippet(result.text, tokens);
      item.appendChild(excerpt);
      results.appendChild(item);
    });

    if (matches.length > LOCAL_SEARCH_RESULT_LIMIT) {
      status.textContent += ' Showing the ' + LOCAL_SEARCH_RESULT_LIMIT + ' best matches.';
    }
  }

  var query = new URLSearchParams(window.location.search).get('query') || '';
  input.value = query;
  render(query.trim());
  input.focus();
}();
`;

export async function addLocalSearchSupport(stagingDir, downloadedFiles) {
    const htmlFiles = downloadedFiles
        .filter((candidate) => candidate.endsWith('.html') && candidate !== 'search.html')
        .sort();
    const searchEntries: AimSearchEntry[] = [];

    for (const file of htmlFiles) {
        const filePath = path.join(stagingDir, file);
        const html = await fs.readFile(filePath, 'utf8');
        const isNavigationPage = file === 'index.html' || /^chap_\d+\.html$/.test(file);
        if (!isNavigationPage) searchEntries.push(...extractAimSearchEntries(html, file));

        const rewritten = rewriteAimSearchForm(html, file);
        if (/\bsearch\.usa\.gov\b/i.test(rewritten)) {
            throw new Error(`Could not replace remote AIM search form in ${file}`);
        }
        await fs.writeFile(filePath, rewritten);
    }

    if (searchEntries.length === 0) {
        throw new Error('Cannot build local AIM search: no searchable entries were found');
    }

    const searchVendorJs = await readMiniSearchVendorAsset();
    const searchFiles = [
        'search.html',
        'aim-search.css',
        'aim-search-vendor.js',
        'aim-search-index.js',
        'aim-search.js'
    ];
    await Promise.all([
        fs.writeFile(path.join(stagingDir, 'search.html'), buildAimSearchPage()),
        fs.writeFile(path.join(stagingDir, 'aim-search.css'), AIM_SEARCH_CSS),
        fs.writeFile(path.join(stagingDir, 'aim-search-vendor.js'), searchVendorJs),
        fs.writeFile(
            path.join(stagingDir, 'aim-search-index.js'),
            `/* Generated by download-aim.ts. */\nglobalThis.AIM_SEARCH_DOCUMENTS = ${JSON.stringify(searchEntries)};\n`
        ),
        fs.writeFile(path.join(stagingDir, 'aim-search.js'), AIM_SEARCH_JS)
    ]);

    return { searchFiles, entryCount: searchEntries.length };
}
