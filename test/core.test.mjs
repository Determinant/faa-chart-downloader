import test from 'node:test';
import assert from 'node:assert/strict';
import { findReferences, rewriteLocalReferences } from '../download-aim.mjs';
import { addPwaMetadata } from '../lib/pwa.mjs';
import { isStrictChildPath } from '../lib/fs-utils.mjs';
import {
    parseCliArgs,
    parseDate,
    parsePositiveInteger,
    parseVolumes,
    validateCliArgs
} from '../lib/config.mjs';
import { extractSearchEntries } from '../lib/xml-index.mjs';

test('CLI validation rejects malformed values and unknown options', () => {
    assert.deepEqual([...parseVolumes('1,03')], ['1', '3']);
    assert.throws(() => parseVolumes('0'), /positive integers/);
    assert.throws(() => parseVolumes('1,,3'), /empty values/);
    assert.throws(() => parsePositiveInteger('abc', '--title'), /positive integer/);
    assert.equal(parseDate('2026-08-06'), '2026-08-06');
    assert.throws(() => parseDate('2026-02-30'), /real calendar date/);
    assert.throws(
        () => validateCliArgs(parseCliArgs(['--unknown=1'])),
        /Unknown option/
    );
    assert.throws(
        () => validateCliArgs(parseCliArgs(['--portable'])),
        /Unknown option/
    );
});

test('search extraction keeps boundaries between XML fields', () => {
    const xml = `<FAR><PART><EAR>Part 61</EAR><HD>Certification</HD><SECTION>
        <SECTNO>§ 61.57</SECTNO><SUBJECT>Recent flight experience.</SUBJECT>
        <P>A pilot must meet the night currency requirement.</P>
    </SECTION></PART></FAR>`;
    const [entry] = extractSearchEntries(xml);
    assert.equal(entry.sectno, '§ 61.57');
    assert.match(entry.text, /§ 61\.57 Recent flight experience\. A pilot/);
    assert.match(entry.text, /night currency requirement/);
});

test('output path and PWA metadata helpers enforce safe output', () => {
    assert.equal(isStrictChildPath('/tmp/site', '/tmp/site/far-parts'), true);
    assert.equal(isStrictChildPath('/tmp/site', '/tmp/far-parts'), false);
    const html = addPwaMetadata('<html><head></head><body></body></html>');
    assert.match(html, /manifest\.webmanifest/);
    assert.equal(addPwaMetadata(html), html);
});

test('AIM crawler follows srcset and quoted CSS imports', () => {
    const baseUrl = new URL('https://example.test/aim_html/');
    const sourceUrl = new URL('css/main.css', baseUrl);
    const sourceFile = 'css/main.css';
    const source = `@import "theme.css"; .hero { background: url("../img/hero.png"); }`;
    const rewritten = rewriteLocalReferences(source, sourceUrl, sourceFile, baseUrl);
    assert.match(rewritten, /@import "\.\/theme\.css"/);
    assert.match(rewritten, /url\("\.\.\/img\/hero\.png"\)/);

    const html = '<img srcset="/aim_html/img/hero-1x.png 1x, /aim_html/img/hero-2x.png 2x">';
    const refs = findReferences(html, new URL('index.html', baseUrl), baseUrl);
    assert.deepEqual([...refs].sort(), [
        'https://example.test/aim_html/img/hero-1x.png',
        'https://example.test/aim_html/img/hero-2x.png'
    ]);
});
