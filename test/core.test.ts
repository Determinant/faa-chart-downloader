import test from 'node:test';
import assert from 'node:assert/strict';
import xpath from 'xpath';
import { findReferences, rewriteLocalReferences } from '../download-aim.ts';
import { addPwaMetadata } from '../lib/pwa.ts';
import { isStrictChildPath } from '../lib/fs-utils.ts';
import {
    parseCliArgs,
    parseDate,
    parsePositiveInteger,
    parseVolumes,
    validateCliArgs
} from '../lib/config.ts';
import {
    getPartNumberFromHeading,
    getPartNumberFromEar,
    normalizePartNumber,
    parseSectionHead,
    parseXml,
    convertEcfrToGovInfoLikeXml,
    filterFarXmlByKeepParts
} from '../lib/xml-transform.ts';
import { extractPartEntries, extractSearchEntries } from '../lib/xml-index.ts';
import { buildAnnualCfrVolumeUrl, fetchAnnualCfrVolumeXml } from '../lib/sources.ts';
import { buildSplitIndexHtml } from '../lib/site-shell.ts';

const paragraphNodeNames = new Set([
    'P', 'P2', 'FP', 'FP-1', 'FP-2', 'FP-DASH', 'FP1-2', 'PSPACE'
]);

function getParagraphSummary(xml) {
    const doc = parseXml(xml);
    return xpath.select('//SECTION/*', doc)
        .filter(node => paragraphNodeNames.has(node.nodeName))
        .map(node => ({
            tag: node.nodeName,
            level: node.getAttribute('LEVEL'),
            text: xpath.select1('string(.)', node).replace(/\s+/g, ' ').trim()
        }));
}

function buildEcfrFixture(paragraphXml) {
    return `<ROOT>
        <DIV1 TYPE="TITLE"><HEAD>Title 14—Aeronautics and Space</HEAD>
            <DIV3 TYPE="CHAPTER" N="I"><HEAD>CHAPTER I—Federal Aviation Administration</HEAD>
                <DIV5 TYPE="PART" N="61"><HEAD>PART 61—Certification</HEAD>
                    <DIV8 TYPE="SECTION" N="61.1"><HEAD>§ 61.1 Applicability.</HEAD>
                        ${paragraphXml}
                    </DIV8>
                </DIV5>
            </DIV3>
        </DIV1>
    </ROOT>`;
}

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

test('annual CFR source uses GovInfo package URLs for future editions', () => {
    assert.equal(
        buildAnnualCfrVolumeUrl({ year: '2026', title: 14, chapter: 'I', volume: '1' }),
        'https://www.govinfo.gov/content/pkg/CFR-2026-title14-vol1/xml/CFR-2026-title14-vol1-chapI.xml'
    );
});

test('annual CFR source explains a missing GovInfo volume', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('not found', { status: 404 });
    try {
        await assert.rejects(
            fetchAnnualCfrVolumeXml({ year: '2026', title: 14, chapter: 'I', volume: '1' }),
            /GovInfo has no annual CFR file.*annual volume may not have been published yet/
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('search extraction keeps boundaries between XML fields', () => {
    const xml = `<FAR><PART><EAR>Part 61</EAR><HD>Certification</HD><SECTION>
        <SECTNO>§ 61.57</SECTNO><SUBJECT>Recent flight experience.</SUBJECT>
        <P>A pilot must meet the night currency requirement.</P>
    </SECTION></PART></FAR>`;
    const [entry] = extractSearchEntries(parseXml(xml));
    assert.equal(entry.sectno, '§ 61.57');
    assert.match(entry.text, /§ 61\.57 Recent flight experience\. A pilot/);
    assert.match(entry.text, /night currency requirement/);
});

test('XML parsing handles annual headings and section citation variants', () => {
    assert.equal(getPartNumberFromEar('Pt. 61'), '61');
    assert.equal(normalizePartNumber('PART 61.'), '61');
    assert.equal(getPartNumberFromHeading('PART 194—Special Federal Aviation Regulation'), '194');

    assert.deepEqual(parseSectionHead('§§ 13.21 -13.29 [Reserved]', '13.21-13.29'), {
        sectionNumber: '§§ 13.21-13.29',
        contentsNumber: '13.21-13.29',
        subject: '[Reserved]'
    });
    assert.deepEqual(parseSectionHead('Sec. 1-1 Applicability.', '1-1'), {
        sectionNumber: '§ 1-1',
        contentsNumber: '1-1',
        subject: 'Applicability.'
    });
});

test('eCFR paragraph normalization handles compound and ambiguous markers', () => {
    const output = convertEcfrToGovInfoLikeXml(buildEcfrFixture(`
        <P>(a)(1) Combined lead.</P>
        <P>(i) First Roman item.</P>
        <P>(ii) Second Roman item.</P>
        <P>(b) Next top-level item.</P>
        <P>(h) Alphabetic item.</P>
        <P>(i) Next alphabetic item.</P>
        <P>(j) Another alphabetic item.</P>
    `), {
        titleNumber: 14,
        date: '2026-08-06',
        chapterCode: 'I',
        volumeSet: new Set(['1'])
    });

    assert.deepEqual(getParagraphSummary(output).map(({ level }) => level), [
        '2', '3', '3', '1', '1', '1', '1'
    ]);
});

test('inline subparagraphs are split without changing paragraph element types', () => {
    const output = convertEcfrToGovInfoLikeXml(buildEcfrFixture(`
        <FP>(a) Lead clause—(1) Inline numbered clause.</FP>
    `), {
        titleNumber: 14,
        date: '2026-08-06',
        chapterCode: 'I',
        volumeSet: new Set(['1'])
    });

    assert.deepEqual(getParagraphSummary(output), [
        { tag: 'FP', level: '1', text: '(a) Lead clause—' },
        { tag: 'FP', level: '2', text: '(1) Inline numbered clause.' }
    ]);
});

test('annual GovInfo paragraph-like nodes receive the same levels', () => {
    const output = filterFarXmlByKeepParts(`<ROOT>
        <PART><EAR>Pt. 61</EAR>
            <SECTION><SECTNO>§ 61.1</SECTNO>
                <FP>(a) Alphabetic item.</FP>
                <P2>(1) Numbered item.</P2>
                <PSPACE>(i) Roman item.</PSPACE>
            </SECTION>
        </PART>
    </ROOT>`);

    assert.deepEqual(getParagraphSummary(output).map(({ tag, level }) => ({ tag, level })), [
        { tag: 'FP', level: '1' },
        { tag: 'P2', level: '2' },
        { tag: 'PSPACE', level: '3' }
    ]);
});

test('annual part indexing survives omitted EAR and reserved PART nodes', () => {
    const xml = `<ROOT>
        <PART><HD>PART 194—Special Federal Aviation Regulation</HD><SECTION><SECTNO>§ 194.1</SECTNO></SECTION></PART>
        <PART><RESERVED>PART 195—[RESERVED]</RESERVED></PART>
    </ROOT>`;
    assert.deepEqual(extractPartEntries(xml).map(entry => entry.partNumber), ['194']);
});

test('XML parser rejects empty and malformed input', () => {
    assert.throws(() => parseXml(''), /empty XML/i);
    assert.throws(() => parseXml('<FAR><PART></FAR>'), /Invalid XML/i);
});

test('output path and PWA metadata helpers enforce safe output', () => {
    assert.equal(isStrictChildPath('/tmp/site', '/tmp/site/far-parts'), true);
    assert.equal(isStrictChildPath('/tmp/site', '/tmp/far-parts'), false);
    const html = addPwaMetadata('<html><head></head><body></body></html>');
    assert.match(html, /manifest\.webmanifest/);
    assert.equal(addPwaMetadata(html), html);
});

test('mobile FAR shell uses one right-side menu control for TOC and search', () => {
    const html = buildSplitIndexHtml({
        title: '14',
        chapter: 'I',
        sourceDescription: 'eCFR snapshot',
        scopeDescription: 'Volumes 1,2,3',
        parts: [{
            href: 'far-parts/part-1.html',
            ear: 'Pt. 1',
            heading: 'PART 1',
            topSections: [],
            topSubjectGroups: [],
            subparts: []
        }],
        defaultSrc: 'far-parts/part-1.html'
    });

    assert.equal((html.match(/id="mobileTocToggle"/g) || []).length, 1);
    assert.doesNotMatch(html, /mobileSearchToggle/);
    assert.match(html, /aria-label="Open table of contents and search"/);
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
