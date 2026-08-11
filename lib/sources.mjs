import fs from 'fs/promises';

async function resolveLatestDateForTitle(titleNumber) {
    const url = 'https://www.ecfr.gov/api/versioner/v1/titles.json';
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }
    const payload = await res.json();
    const titles = payload?.titles || [];
    const title = titles.find(item => Number(item.number) === Number(titleNumber));
    if (!title?.up_to_date_as_of) {
        throw new Error(`Could not resolve up_to_date_as_of for title ${titleNumber}`);
    }
    return title.up_to_date_as_of;
}

function looksLikeEcfrXml(payload) {
    return /<ECFR[\s>]/.test(payload) || /<DIV[0-9][\s>]/.test(payload);
}

function looksLikeAnnualCfrXml(payload) {
    return /<(?:CFRGRANULE|ROOT|PART|CHAPTER|SUBCHAP)\b/.test(payload);
}

async function fetchEcfrChapterXml({ date, title, chapter }) {
    const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${title}.xml?chapter=${chapter}`;
    const res = await fetch(url);
    const body = await res.text();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }
    if (/text\/html/.test(contentType)) {
        throw new Error(`Unexpected HTML payload from ${url}`);
    }
    if (!looksLikeEcfrXml(body)) {
        const preview = body.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(`Unexpected payload from ${url}: ${preview}`);
    }

    return body;
}

function stripGovInfoGranuleRoots(xml) {
    return String(xml || '')
        .replace(/<\?xml[\s\S]*?\?>\s*/g, '')
        .replace(/<CFRGRANULE[^>]*>\s*/g, '')
        .replace(/<\/CFRGRANULE>\s*/g, '');
}

function buildAnnualCfrVolumeUrl({ year, title, chapter, volume }) {
    const chapterCode = String(chapter || '').trim();
    return `https://www.govinfo.gov/content/pkg/CFR-${year}-title${title}-vol${volume}/xml/CFR-${year}-title${title}-vol${volume}-chap${chapterCode}.xml`;
}

async function fetchAnnualCfrVolumeXml({ year, title, chapter, volume }) {
    const url = buildAnnualCfrVolumeUrl({ year, title, chapter, volume });
    const res = await fetch(url);
    const body = await res.text();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }
    if (/text\/html/.test(contentType)) {
        throw new Error(`Unexpected HTML payload from ${url}`);
    }
    if (!looksLikeAnnualCfrXml(body)) {
        const preview = body.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(`Unexpected payload from ${url}: ${preview}`);
    }

    return body;
}

async function fetchAnnualCfrCombinedXml({ year, title, chapter, volumeSet }) {
    const xmls = [];
    const volumes = Array.from(volumeSet).sort((a, b) => Number(a) - Number(b));
    for (const volume of volumes) {
        console.log(`📥 Fetching annual CFR vol ${volume}...`);
        const xml = await fetchAnnualCfrVolumeXml({ year, title, chapter, volume });
        xmls.push(xml);
    }
    return `<ROOT>\n${xmls.map(stripGovInfoGranuleRoots).join('\n')}\n</ROOT>`;
}

async function loadEcfrSourceXml({ sourceXmlPath, date, title, chapter }) {
    if (!sourceXmlPath) {
        return fetchEcfrChapterXml({ date, title, chapter });
    }
    const chapterXml = await fs.readFile(sourceXmlPath, 'utf8');
    if (!looksLikeEcfrXml(chapterXml)) {
        throw new Error(`--source-xml does not look like eCFR XML: ${sourceXmlPath}`);
    }
    console.log(`📦 Source XML: ${sourceXmlPath}`);
    return chapterXml;
}

async function loadAnnualSourceXml({ sourceXmlPath, year, title, chapter, volumeSet }) {
    if (sourceXmlPath) {
        const annualXml = await fs.readFile(sourceXmlPath, 'utf8');
        if (!looksLikeAnnualCfrXml(annualXml)) {
            throw new Error(`--source-xml does not look like annual CFR XML: ${sourceXmlPath}`);
        }
        console.log(`📦 Source XML: ${sourceXmlPath}`);
        return annualXml;
    }
    if (!year) {
        throw new Error('--year is required with --source=annual unless --source-xml is provided.');
    }
    return fetchAnnualCfrCombinedXml({ year, title, chapter, volumeSet });
}

export {
    resolveLatestDateForTitle,
    looksLikeEcfrXml,
    looksLikeAnnualCfrXml,
    fetchEcfrChapterXml,
    buildAnnualCfrVolumeUrl,
    fetchAnnualCfrVolumeXml,
    fetchAnnualCfrCombinedXml,
    loadEcfrSourceXml,
    loadAnnualSourceXml
};
