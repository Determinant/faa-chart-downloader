import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import {
    addLocalSearchSupport,
    extractAimSearchEntries,
    rewriteAimSearchForm
} from '../lib/aim-search.ts';
import { readMiniSearchVendorAsset } from '../lib/site.ts';
import { buildSplitIndexHtml } from '../lib/site-shell.ts';

test('FAR local search executes the shared MiniSearch client and ranks exact citations first', async () => {
    const searchVendorJs = await readMiniSearchVendorAsset();
    const html = buildSplitIndexHtml({
        title: '14',
        chapter: 'I',
        sourceDescription: 'fixture',
        scopeDescription: 'fixture',
        parts: [{
            href: 'far-parts/part-61.html',
            ear: 'Pt. 61',
            heading: 'Certification',
            topSections: [],
            topSubjectGroups: [],
            subparts: []
        }],
        defaultSrc: 'far-parts/part-61.html',
        searchVendorJs,
        searchEntries: [
            {
                target: 'far-parts/part-61.html#seqnum61.57',
                sectno: '§ 61.57',
                subject: 'Recent flight experience.',
                partHeading: 'Part 61—Certification',
                subpart: '',
                subjectGroup: '',
                text: 'Recent flight experience requirements.'
            },
            {
                target: 'far-parts/part-61.html#seqnum61.5',
                sectno: '§ 61.5',
                subject: 'Certificates and ratings issued.',
                partHeading: 'Part 61—Certification',
                subpart: '',
                subjectGroup: '',
                text: 'Pilot certificates and ratings.'
            }
        ]
    });
    const dom = new JSDOM(html, {
        url: 'https://example.test/index.html',
        runScripts: 'dangerously'
    });
    try {
        const input = dom.window.document.getElementById('searchInput') as HTMLInputElement;
        input.value = '61.5';
        input.dispatchEvent(new dom.window.Event('input'));
        await new Promise((resolve) => dom.window.setTimeout(resolve, 150));

        assert.equal(
            dom.window.document.querySelector('.search-result-title')?.textContent,
            '§ 61.5 Certificates and ratings issued.'
        );
    } finally {
        dom.window.close();
    }
});

test('AIM mirror replaces FAA search with the local results page', () => {
    const source = `<form id="search_form" action="https://search.usa.gov/search" method="get">
        <input name="utf8" value="yes"><input name="affiliate" value="aim__content">
        <input id="search-input" name="query"><button>Search</button>
    </form><input id="outside-affiliate" name="affiliate" value="keep-me">`;
    const rewritten = rewriteAimSearchForm(source, 'chap1_section_1.html');
    const dom = new JSDOM(rewritten);

    assert.match(rewritten, /action="\.\/search\.html"/);
    assert.doesNotMatch(rewritten, /search\.usa\.gov|name="utf8"/);
    assert.match(rewritten, /name="query"/);
    assert.equal(dom.window.document.querySelector('#search_form input[name="affiliate"]'), null);
    assert.ok(dom.window.document.getElementById('outside-affiliate'));
    dom.window.close();
});

test('AIM local search entries link paragraph text to its original anchor', () => {
    const entries = extractAimSearchEntries(`<!doctype html><title>Navigation Aids</title>
        <main role="main">
          <h1 class="chapter-title">Chapter 1. Air Navigation</h1>
          <h2 class="section-title">Section 1. Navigation Aids</h2>
          <div class="body conbody">
            <h4 class="paragraph-title" id="1-1-1">1-1-1. General</h4>
            <p>Navigation systems include GPS equipment.</p>
            <h4 class="paragraph-title" id="1-1-2">1-1-2. VOR</h4>
            <p>A VOR receiver provides course guidance.</p>
          </div>
        </main>`, 'chap1_section_1.html');

    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0], {
        title: '1-1-1. General',
        context: 'Chapter 1. Air Navigation · Section 1. Navigation Aids',
        text: '1-1-1. General Navigation systems include GPS equipment.',
        url: 'chap1_section_1.html#1-1-1'
    });
    assert.doesNotMatch(entries[0].text, /VOR receiver/);
});

test('AIM local search uses the bundled MiniSearch engine', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aim-search-test-'));
    try {
        await fs.writeFile(path.join(directory, 'index.html'), `<main role="main">
            <h1>AIM</h1>
            <form id="search_form" action="https://search.usa.gov/search" method="get">
              <input name="query">
            </form>
        </main>`);
        await fs.writeFile(path.join(directory, 'chap1_section_1.html'), `<main role="main">
            <h1 class="chapter-title">Chapter 1. Air Navigation</h1>
            <h2 class="section-title">Section 1. Navigation Aids</h2>
            <div class="body conbody">
              <h4 class="paragraph-title" id="1-1-1">1-1-1. GPS</h4>
              <p>Satellite navigation guidance.</p>
              <h4 class="paragraph-title" id="1-1-10">1-1-10. GPS Backup</h4>
              <p>Conventional navigation equipment.</p>
            </div>
        </main>`);

        const generated = await addLocalSearchSupport(directory, [
            'index.html',
            'chap1_section_1.html'
        ]);
        const page = await fs.readFile(path.join(directory, 'search.html'), 'utf8');
        const css = await fs.readFile(path.join(directory, 'aim-search.css'), 'utf8');
        const client = await fs.readFile(path.join(directory, 'aim-search.js'), 'utf8');
        const vendor = await fs.readFile(path.join(directory, 'aim-search-vendor.js'), 'utf8');
        const index = await fs.readFile(path.join(directory, 'aim-search-index.js'), 'utf8');

        assert.ok(generated.searchFiles.includes('aim-search-vendor.js'));
        assert.ok(page.indexOf('aim-search-vendor.js') < page.indexOf('aim-search-index.js'));
        assert.ok(page.indexOf('aim-search-index.js') < page.indexOf('aim-search.js'));

        const runSearch = (query) => {
            const dom = new JSDOM(page, {
                url: `file://${path.join(directory, 'search.html')}?query=${encodeURIComponent(query)}`,
                runScripts: 'outside-only'
            });
            dom.window.eval(vendor);
            dom.window.eval(index);
            dom.window.eval(client);
            const style = dom.window.document.createElement('style');
            style.textContent = `li > p:first-of-type { display: inline; }\n${css}`;
            dom.window.document.head.appendChild(style);

            const firstResult = dom.window.document.querySelector('.aim-search-result');
            const result = {
                status: dom.window.document.getElementById('aim-search-status')?.textContent,
                title: firstResult?.querySelector('a')?.textContent,
                href: firstResult?.querySelector('a')?.getAttribute('href'),
                contextDisplay: dom.window.getComputedStyle(
                    firstResult?.querySelector('.aim-search-context')
                ).display,
                mainPaddingTop: dom.window.getComputedStyle(
                    dom.window.document.querySelector('.aim-search-page')
                ).paddingTop
            };
            dom.window.close();
            return result;
        };

        const fuzzy = runSearch('satellit navigaton');
        assert.match(fuzzy.status, /local result/);
        assert.equal(fuzzy.title, '1-1-1. GPS');
        assert.equal(fuzzy.href, 'chap1_section_1.html#1-1-1');
        assert.equal(fuzzy.contextDisplay, 'block');
        assert.equal(fuzzy.mainPaddingTop, '2.5rem');

        const citation = runSearch('1-1-1');
        assert.equal(citation.title, '1-1-1. GPS');

        const repeated = await addLocalSearchSupport(directory, [
            'index.html',
            'chap1_section_1.html',
            'search.html'
        ]);
        assert.equal(repeated.entryCount, 2);

        await fs.writeFile(path.join(directory, 'changed-form.html'), `<main>
            <h1>Changed FAA markup</h1>
            <form action="https://search.usa.gov/search"><input name="query"></form>
        </main>`);
        await assert.rejects(
            addLocalSearchSupport(directory, ['changed-form.html']),
            /Could not replace remote AIM search form/
        );

        await fs.writeFile(path.join(directory, 'empty.html'), '<html><body>No AIM content</body></html>');
        await assert.rejects(
            addLocalSearchSupport(directory, ['empty.html']),
            /no searchable entries were found/
        );
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});
