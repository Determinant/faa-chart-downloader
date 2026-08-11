import xpath from 'xpath';
import { parseXml, normalizeWhitespace, getPartNumberFromEar } from './xml-transform.mjs';

function sanitizeFileComponent(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

function extractPartEntries(farXml) {
    const doc = parseXml(farXml);
    const partNodes = xpath.select('//PART', doc);
    const usedBasenames = new Map();

    return partNodes.map((partNode, index) => {
        const ear = normalizeWhitespace(xpath.select1('string(./EAR)', partNode));
        const heading = normalizeWhitespace(xpath.select1('string(./HD)', partNode));
        const partNumber = getPartNumberFromEar(ear) || String(index + 1);

        let basename = `part-${sanitizeFileComponent(partNumber) || String(index + 1)}`;
        const seen = usedBasenames.get(basename) || 0;
        if (seen > 0) basename = `${basename}-${seen + 1}`;
        usedBasenames.set(`part-${sanitizeFileComponent(partNumber) || String(index + 1)}`, seen + 1);

        return {
            index,
            ear: ear || `Pt. ${partNumber}`,
            heading,
            partNumber,
            basename
        };
    });
}

function seqnumIdFromSectno(sectno) {
    return normalizeWhitespace(sectno)
        .replace(/\u2009/g, '')
        .replace(/[§\s]/g, '');
}

function extractSectionsFromContainer(node) {
    return xpath.select('./SECTNO', node).map(sectNode => {
        const sectno = normalizeWhitespace(xpath.select1('string(.)', sectNode));
        const subject = normalizeWhitespace(xpath.select1('string(following-sibling::SUBJECT[1])', sectNode));
        return { sectno, subject };
    }).filter(item => item.sectno);
}

function extractNavigationParts(farXml, partEntries) {
    const doc = parseXml(farXml);
    const partNodes = xpath.select('//PART', doc);

    return partNodes.map((partNode, index) => {
        const entry = partEntries[index];
        const contents = xpath.select1('./CONTENTS', partNode);
        const topSections = contents ? extractSectionsFromContainer(contents) : [];
        const subparts = contents
            ? xpath.select('./SUBPART', contents).map(subpartNode => {
                const title = normalizeWhitespace(xpath.select1('string(./HD)', subpartNode));
                const sections = extractSectionsFromContainer(subpartNode);
                const subjgrps = xpath.select('./SUBJGRP', subpartNode).map(subjNode => ({
                    title: normalizeWhitespace(xpath.select1('string(./HD)', subjNode)),
                    sections: extractSectionsFromContainer(subjNode)
                }));
                return { title, sections, subjgrps };
            })
            : [];

        return {
            ...entry,
            topSections,
            subparts
        };
    });
}

function extractSearchEntries(farXml) {
    const doc = parseXml(farXml);
    const partNodes = xpath.select('//PART', doc);

    return partNodes.flatMap((partNode, partIndex) => {
        const partHeading = normalizeWhitespace(xpath.select1('string(./HD)', partNode));
        return xpath.select('.//SECTION', partNode).map(sectionNode => {
            const sectno = normalizeWhitespace(xpath.select1('string(./SECTNO)', sectionNode));
            if (!sectno) return null;

            const chunks = [];
            const collectText = node => {
                if (!node) return;
                if (node.nodeType === 3 || node.nodeType === 4) {
                    if (node.data) chunks.push(node.data);
                    return;
                }
                let child = node.firstChild;
                while (child) {
                    collectText(child);
                    child = child.nextSibling;
                }
            };
            collectText(sectionNode);

            return {
                partIndex,
                partHeading,
                sectno,
                subject: normalizeWhitespace(xpath.select1('string(./SUBJECT)', sectionNode)),
                subpart: normalizeWhitespace(xpath.select1('string(ancestor::SUBPART[1]/HD)', sectionNode)),
                subjectGroup: normalizeWhitespace(xpath.select1('string(ancestor::SUBJGRP[1]/HD)', sectionNode)),
                text: normalizeWhitespace(chunks.join(' '))
            };
        }).filter(Boolean);
    });
}

export {
    extractPartEntries,
    seqnumIdFromSectno,
    extractNavigationParts,
    extractSearchEntries
};
