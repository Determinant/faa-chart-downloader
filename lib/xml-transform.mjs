import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import xpath from 'xpath';
import { KEEP_PART_NUMBERS } from './config.mjs';

const xmlParser = new DOMParser();
const xmlSerializer = new XMLSerializer();

function parseXml(xml) {
    return xmlParser.parseFromString(xml, 'application/xml');
}

function serializeXml(doc) {
    return xmlSerializer.serializeToString(doc);
}
function pruneEmptyContainers(doc) {
    const containers = [
        xpath.select('//DIV4[@TYPE="SUBCHAP"]', doc),
        xpath.select('//DIV3[@TYPE="CHAPTER"]', doc)
    ];
    for (const nodes of containers) {
        for (const node of nodes) {
            const partsInside = xpath.select('.//DIV5[@TYPE="PART"]', node);
            if (partsInside.length === 0) {
                node.parentNode.removeChild(node);
            }
        }
    }
}

function filterByVolumes(xml, volumeSet) {
    const doc = parseXml(xml);
    const parts = xpath.select('//DIV5[@TYPE="PART"]', doc);

    for (const part of parts) {
        const vol = (part.getAttribute('VOLUME') || '').trim();
        if (!volumeSet.has(vol)) {
            part.parentNode.removeChild(part);
        }
    }

    pruneEmptyContainers(doc);
    return serializeXml(doc);
}

function filterByKeepParts(xml) {
    const doc = parseXml(xml);
    const parts = xpath.select('//DIV5[@TYPE="PART"]', doc);

    for (const part of parts) {
        const partNumber = (part.getAttribute('N') || '').trim();
        if (!shouldKeepPartNumber(partNumber)) {
            part.parentNode.removeChild(part);
        }
    }

    pruneEmptyContainers(doc);
    return serializeXml(doc);
}

function normalizeWhitespace(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizePartNumber(value) {
    const text = normalizeWhitespace(value);
    if (!text) return '';

    const fromEar = getPartNumberFromEar(text);
    const candidate = normalizeWhitespace(fromEar || text)
        .replace(/^part\s*/i, '')
        .replace(/^pt\.?\s*/i, '')
        .replace(/[^A-Za-z0-9.\-]+/g, '');

    return candidate.replace(/^0+(?=\d)/, '');
}

function shouldKeepPartNumber(value) {
    const partNumber = normalizePartNumber(value);
    return partNumber ? KEEP_PART_NUMBERS.has(partNumber) : false;
}

function getElementChildren(node) {
    const children = [];
    let child = node.firstChild;
    while (child) {
        if (child.nodeType === 1) children.push(child);
        child = child.nextSibling;
    }
    return children;
}

function appendTextElement(doc, parent, name, text, attrs = null) {
    const el = doc.createElement(name);
    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            if (value !== undefined && value !== null && value !== '') {
                el.setAttribute(key, String(value));
            }
        }
    }
    if (text !== undefined && text !== null && text !== '') {
        el.appendChild(doc.createTextNode(text));
    }
    parent.appendChild(el);
    return el;
}

function parseTitleText(head) {
    const normalized = normalizeWhitespace(head);
    const match = normalized.match(/^Title\s+\d+\s*[—-]\s*(.+)$/i);
    return normalizeWhitespace(match ? match[1] : normalized);
}

function parseChapterTitle(head) {
    const normalized = normalizeWhitespace(head);
    const match = normalized.match(/^CHAPTER\s+[A-Z0-9IVXLCDM]+\s*[—-]\s*(.+)$/i);
    return normalizeWhitespace(match ? match[1] : normalized);
}

function parseSectionHead(headText, fallbackNumber) {
    const normalized = normalizeWhitespace(headText);
    const fallback = normalizeWhitespace(fallbackNumber);

    if (!normalized) {
        const sectionNumber = fallback ? `§ ${fallback}` : '';
        return {
            sectionNumber,
            contentsNumber: fallback,
            subject: ''
        };
    }

    const sectionMatch = normalized.match(/^(§{1,2})\s*([^\s]+)\s*(.*)$/u);
    if (sectionMatch) {
        const sectionNumber = `${sectionMatch[1]} ${sectionMatch[2]}`.trim();
        const contentsNumber = fallback || normalizeWhitespace(sectionMatch[2]);
        const subject = normalizeWhitespace(sectionMatch[3]);
        return { sectionNumber, contentsNumber, subject };
    }

    const sectionNumber = fallback ? `§ ${fallback}` : normalized;
    const subject = fallback ? normalized : '';
    return {
        sectionNumber: normalizeWhitespace(sectionNumber),
        contentsNumber: fallback,
        subject
    };
}

function mapAuthOrSourceNode(srcNode, outDoc) {
    const outNode = outDoc.createElement(srcNode.nodeName);

    const hedText = normalizeWhitespace(xpath.select1('string(./HED)', srcNode));
    if (hedText) {
        appendTextElement(outDoc, outNode, 'HD', hedText, { SOURCE: 'HED' });
    }

    const pspaceNodes = xpath.select('./PSPACE', srcNode);
    if (pspaceNodes.length > 0) {
        for (const pspace of pspaceNodes) {
            const p = outDoc.createElement('P');
            const pText = normalizeWhitespace(xpath.select1('string(.)', pspace));
            if (pText) p.appendChild(outDoc.createTextNode(pText));
            outNode.appendChild(p);
        }
        return outNode;
    }

    const pNodes = xpath.select('./P', srcNode);
    if (pNodes.length > 0) {
        for (const pSrc of pNodes) {
            outNode.appendChild(pSrc.cloneNode(true));
        }
        return outNode;
    }

    const fallbackText = normalizeWhitespace(xpath.select1('string(.)', srcNode));
    if (fallbackText) {
        appendTextElement(outDoc, outNode, 'P', fallbackText);
    }
    return outNode;
}

function addContentsSectionEntry(sectionDiv, outDoc, parentNode) {
    const sectionHead = normalizeWhitespace(xpath.select1('string(./HEAD)', sectionDiv));
    const parsed = parseSectionHead(sectionHead, sectionDiv.getAttribute('N') || '');
    const sectno = normalizeWhitespace(parsed.contentsNumber || parsed.sectionNumber.replace(/^§+\s*/u, ''));
    const subject = normalizeWhitespace(parsed.subject);

    if (sectno) appendTextElement(outDoc, parentNode, 'SECTNO', sectno);
    if (subject) appendTextElement(outDoc, parentNode, 'SUBJECT', subject);
}

function mapSectionNode(sectionDiv, outDoc) {
    const sectionOut = outDoc.createElement('SECTION');

    const sectionHead = normalizeWhitespace(xpath.select1('string(./HEAD)', sectionDiv));
    const parsed = parseSectionHead(sectionHead, sectionDiv.getAttribute('N') || '');
    if (parsed.sectionNumber) appendTextElement(outDoc, sectionOut, 'SECTNO', parsed.sectionNumber);
    if (parsed.subject) appendTextElement(outDoc, sectionOut, 'SUBJECT', parsed.subject);

    for (const child of getElementChildren(sectionDiv)) {
        if (child.nodeName === 'HEAD') continue;
        sectionOut.appendChild(child.cloneNode(true));
    }

    normalizeSectionParagraphStructure(sectionOut, outDoc);

    return sectionOut;
}

function moveNodesFrom(startNode, targetParent) {
    let node = startNode;
    while (node) {
        const next = node.nextSibling;
        targetParent.appendChild(node);
        node = next;
    }
}

function classifyMarkerToken(token) {
    if (!token) return null;

    if (/^\d+$/.test(token)) {
        return { token, kind: 'num' };
    }
    if (/^[A-Z]+$/.test(token)) {
        if (token.length === 1) return { token, kind: 'upper' };
        if (token.length === 2 && token[0] === token[1]) return { token, kind: 'upper' };
        return null;
    }
    if (/^[a-z]+$/.test(token)) {
        const lower = token.toLowerCase();
        const looksRoman = /^[ivxlcdm]+$/.test(lower);
        if (looksRoman) {
            if (lower.length === 1) {
                // Only i/v/x are common ambiguous single-token markers in CFR paragraph lists.
                if (lower === 'i' || lower === 'v' || lower === 'x') {
                    return { token, kind: 'ambig' };
                }
                return { token, kind: 'lower' };
            }
            return { token, kind: 'roman' };
        }
        if (token.length === 1) return { token, kind: 'lower' };
        if (token.length === 2 && token[0] === token[1]) return { token, kind: 'lower' };
        return null;
    }

    return null;
}

function looksLikePhoneNumberTail(text) {
    const tail = normalizeWhitespace(text);
    return /^\d{3}[-\s]\d{4}\b/.test(tail);
}

function isLikelyParagraphListMarker({ token, kind, style, tail }) {
    const body = normalizeWhitespace(tail);
    if (kind === 'num') {
        if (token.length > 3) return false;
        // Avoid classifying phone-number prose such as "(202) 267-1000".
        if (token.length >= 3 && /^\d/.test(body)) return false;
        if (looksLikePhoneNumberTail(body)) return false;
    }

    // Dot/paren markers should be concise list tokens; avoid abbreviations.
    if (style === 'dot' && kind !== 'roman' && !/^\d+$/.test(token) && token.length > 2) {
        return false;
    }

    return true;
}

function detectParagraphMarker(text) {
    const raw = normalizeWhitespace(text);
    if (!raw) return null;

    let match = raw.match(/^\(([A-Za-z0-9]+)\)(?:\s+|[—-]\s*|$)/);
    if (match) {
        const token = match[1];
        const marker = classifyMarkerToken(token);
        if (!marker) return null;
        const tail = raw.slice(match[0].length);
        if (!isLikelyParagraphListMarker({ token, kind: marker.kind, style: 'paren', tail })) {
            return null;
        }
        return marker;
    }

    match = raw.match(/^([A-Za-z0-9]+)[.)](?:\s+|[—-]\s*|$)/);
    if (match) {
        const token = match[1];
        const marker = classifyMarkerToken(token);
        if (!marker) return null;
        const tail = raw.slice(match[0].length);
        if (!isLikelyParagraphListMarker({ token, kind: marker.kind, style: 'dot', tail })) {
            return null;
        }
        return marker;
    }

    return null;
}

function isNextLowerToken(prevToken, token) {
    const a = (prevToken || '').toLowerCase();
    const b = (token || '').toLowerCase();
    if (!/^[a-z]$/.test(a) || !/^[a-z]$/.test(b)) return false;
    return b.charCodeAt(0) === a.charCodeAt(0) + 1;
}

function romanToInt(token) {
    const s = (token || '').toUpperCase();
    if (!/^[IVXLCDM]+$/.test(s)) return null;
    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    for (let i = 0; i < s.length; i++) {
        const cur = values[s[i]];
        const next = values[s[i + 1]] || 0;
        if (!cur) return null;
        if (cur < next) total -= cur;
        else total += cur;
    }
    return total;
}

function isNextRomanToken(prevToken, token) {
    const a = romanToInt(prevToken);
    const b = romanToInt(token);
    if (a === null || b === null) return false;
    return b === a + 1;
}

function resolveAmbiguousMarkerKind(token, stack, currentDepth) {
    const currentToken = (token || '').toLowerCase();
    const prevEntry = currentDepth > 0 ? stack[currentDepth - 1] : null;
    const prevKind = prevEntry ? prevEntry.kind : null;

    // If we can continue an existing lower-alpha chain, prefer that.
    let matchingLowerDepth = 0;
    for (let i = currentDepth; i >= 1; i--) {
        const entry = stack[i - 1];
        if (entry.kind !== 'lower') continue;
        if (isNextLowerToken(entry.token, currentToken)) {
            matchingLowerDepth = i;
            break;
        }
    }

    // Strongly prefer roman after numeric or roman siblings: (1) -> (i), (ii) -> (iii).
    if (prevKind === 'num') return 'roman';
    if (prevKind === 'upper') {
        // Common CFR pattern: (iv) ... (A) ... (B) ... then continue with (v).
        for (let i = currentDepth - 1; i >= 1; i--) {
            const ancestor = stack[i - 1];
            if (ancestor.kind !== 'roman') continue;
            if (isNextRomanToken(ancestor.token, currentToken) || ancestor.token.toLowerCase() === currentToken) {
                return 'roman';
            }
            break;
        }
    }
    if (prevKind === 'roman') {
        if (isNextRomanToken(prevEntry.token, currentToken) || prevEntry.token.toLowerCase() === currentToken) {
            return 'roman';
        }
        if (matchingLowerDepth > 0) return 'lower';
        return 'roman';
    }

    if (matchingLowerDepth > 0) return 'lower';
    return 'lower';
}

function rankForKind(kind, mode) {
    if (kind === 'ambig') kind = 'lower';
    // Mode A: (a) -> (1) -> (i) -> (A)
    if (mode === 'lower-first') {
        if (kind === 'lower') return 1;
        if (kind === 'num') return 2;
        if (kind === 'roman') return 3;
        if (kind === 'upper') return 4;
        return 9;
    }

    // Mode B/default: (1) -> (a) -> (i) -> (A)
    if (kind === 'num') return 1;
    if (kind === 'lower') return 2;
    if (kind === 'roman') return 3;
    if (kind === 'upper') return 4;
    return 9;
}

function assignParagraphDepths(sectionOut) {
    const directPs = xpath.select('./P', sectionOut);
    const stack = [];
    let currentDepth = 0;
    let mode = null;

    for (const p of directPs) {
        let marker = detectParagraphMarker(xpath.select1('string(.)', p));
        if (!marker) continue;
        if (marker.kind === 'ambig') {
            marker = {
                ...marker,
                kind: resolveAmbiguousMarkerKind(marker.token, stack, currentDepth)
            };
        }

        const prevKind = currentDepth > 0 ? stack[currentDepth - 1].kind : null;
        if (!mode && prevKind) {
            if (prevKind === 'lower' && marker.kind === 'num') mode = 'lower-first';
            if (prevKind === 'num' && marker.kind === 'lower') mode = 'num-first';
        }

        const rank = rankForKind(marker.kind, mode);
        const prevRank = prevKind ? rankForKind(prevKind, mode) : null;

        let depth = 1;
        if (currentDepth === 0) {
            depth = 1;
        } else if (marker.kind === prevKind) {
            depth = currentDepth;
        } else {
            let sameKindDepth = 0;
            for (let i = currentDepth; i >= 1; i--) {
                if (stack[i - 1].kind === marker.kind) {
                    sameKindDepth = i;
                    break;
                }
            }

            if (sameKindDepth > 0 && rank <= prevRank) {
                depth = sameKindDepth;
            } else if (prevRank !== null && rank > prevRank) {
                depth = currentDepth + 1;
            } else {
                let ancestor = 0;
                for (let i = currentDepth; i >= 1; i--) {
                    const r = rankForKind(stack[i - 1].kind, mode);
                    if (r < rank) {
                        ancestor = i;
                        break;
                    }
                }
                depth = ancestor + 1;
            }
        }

        if (depth < 1) depth = 1;

        p.setAttribute('LEVEL', String(depth));

        stack.length = depth - 1;
        stack.push({ kind: marker.kind, token: marker.token });
        currentDepth = depth;
    }
}

function splitInlineSubparagraphInP(pNode, outDoc) {
    const fullText = normalizeWhitespace(xpath.select1('string(.)', pNode));
    if (!/^\([A-Za-z0-9]+\)/.test(fullText)) return false;
    if (!detectParagraphMarker(fullText)) return false;

    const children = [];
    let child = pNode.firstChild;
    while (child) {
        children.push(child);
        child = child.nextSibling;
    }

    let splitNode = null;
    let splitOffset = null;

    const looksLikeCrossRefTail = tailText =>
        /^(?:of|to)\s+(?:this|that|the|paragraphs?|sections?|subparagraphs?|subsections?|part|parts|chapter|chapters|appendix|appendixes|sec\.?|§|§§|\()/i
            .test(normalizeWhitespace(tailText));
    const hasInlineSplitBoundary = prefixText => {
        const prefix = normalizeWhitespace(prefixText);
        if (!prefix) return false;
        // Inline markers should start a new clause/sentence, not a cross-reference
        // embedded in prose such as "paragraph (b)" or "through (4)".
        return /(?:[.:;!?]|[—-])(?:\s*(?:and|or))?$/i.test(prefix);
    };
    const textValue = node => {
        if (!node) return '';
        if (node.nodeType === 3 || node.nodeType === 4) return node.data || '';
        return xpath.select1('string(.)', node) || '';
    };
    const suffixFrom = (nodeIndex, offsetInNode) => {
        let text = '';
        const current = children[nodeIndex];
        if (current && (current.nodeType === 3 || current.nodeType === 4)) {
            text += (current.data || '').slice(Math.max(0, offsetInNode || 0));
        }
        for (let idx = nodeIndex + 1; idx < children.length; idx++) {
            text += textValue(children[idx]);
        }
        return text;
    };
    const prefixBefore = (nodeIndex, offsetInNode) => {
        let text = '';
        for (let idx = 0; idx < nodeIndex; idx++) {
            text += textValue(children[idx]);
        }
        if (offsetInNode > 0) {
            text += (children[nodeIndex].data || '').slice(0, offsetInNode);
        }
        return text;
    };
    const isLikelySplitMarkerToken = (token, tailText) => {
        const marker = classifyMarkerToken(token);
        if (!marker) return false;

        const tail = normalizeWhitespace(tailText);
        if (!tail || looksLikeCrossRefTail(tail)) return false;

        if (marker.kind === 'num') {
            // Inline subparagraph breaks are typically short list markers.
            if (token.length > 2) return false;
            if (/^\d/.test(tail)) return false;
            if (looksLikePhoneNumberTail(tail)) return false;
        }

        if (marker.kind === 'upper' && token.length > 1) return false;
        return true;
    };

    for (let i = 0; i < children.length; i++) {
        const n = children[i];
        if (n.nodeType !== 3) continue;
        const raw = n.data || '';
        const trimmed = raw.replace(/^\s+/, '');

        if (i > 0) {
            const lead = trimmed.match(/^\(([A-Za-z0-9]+)\)(?:\s+|[—-]\s*|$)/);
            if (lead) {
                const token = lead[1];
                const markerStart = raw.length - trimmed.length;
                const markerEnd = markerStart + lead[0].length;
                const tail = suffixFrom(i, markerEnd);
                if (isLikelySplitMarkerToken(token, tail) && hasInlineSplitBoundary(prefixBefore(i, markerStart))) {
                    splitNode = n;
                    splitOffset = markerStart;
                    break;
                }
            }
        }

        const startMarker = raw.match(/^\s*\([A-Za-z0-9]+\)(?:\s+|[—-]\s*|$)/);
        const scanFrom = startMarker ? startMarker[0].length : 0;
        const inlineRe = /(?:\s|[—-])\(([A-Za-z0-9]+)\)(?:\s+|[—-]\s*|$)/g;
        inlineRe.lastIndex = scanFrom;
        const inline = inlineRe.exec(raw);
        if (inline) {
            const token = inline[1];
            const markerStart = inline.index + inline[0].lastIndexOf('(');
            const markerEnd = markerStart + `(${token})`.length;
            const tail = suffixFrom(i, markerEnd);
            if (isLikelySplitMarkerToken(token, tail) && hasInlineSplitBoundary(prefixBefore(i, markerStart))) {
                splitNode = n;
                splitOffset = markerStart;
                break;
            }
        }
    }

    if (!splitNode) return false;

    if (splitOffset !== null && splitOffset > 0 && splitOffset < splitNode.data.length) {
        const tail = splitNode.data.slice(splitOffset);
        splitNode.data = splitNode.data.slice(0, splitOffset);
        const tailNode = outDoc.createTextNode(tail);
        if (splitNode.nextSibling) {
            pNode.insertBefore(tailNode, splitNode.nextSibling);
        } else {
            pNode.appendChild(tailNode);
        }
        splitNode = tailNode;
    }

    const nextP = outDoc.createElement('P');
    moveNodesFrom(splitNode, nextP);

    if (pNode.nextSibling) {
        pNode.parentNode.insertBefore(nextP, pNode.nextSibling);
    } else {
        pNode.parentNode.appendChild(nextP);
    }

    return true;
}

function normalizeSectionParagraphStructure(sectionOut, outDoc) {
    // Keep scanning until no paragraph yields another split so newly inserted
    // sibling paragraphs are also normalized.
    let changed = true;
    while (changed) {
        changed = false;
        const directPs = xpath.select('./P', sectionOut);
        for (const p of directPs) {
            if (splitInlineSubparagraphInP(p, outDoc)) {
                changed = true;
            }
        }
    }

    assignParagraphDepths(sectionOut);
}

function mapAppendixNode(appendixDiv, outDoc) {
    const appOut = outDoc.createElement('APPENDIX');
    const earText = normalizeWhitespace(appendixDiv.getAttribute('N') || '');
    const headText = normalizeWhitespace(xpath.select1('string(./HEAD)', appendixDiv));

    if (earText) appendTextElement(outDoc, appOut, 'EAR', earText);
    if (headText) appendTextElement(outDoc, appOut, 'HD', headText, { SOURCE: 'HED' });

    for (const child of getElementChildren(appendixDiv)) {
        if (child.nodeName === 'HEAD') continue;
        appOut.appendChild(child.cloneNode(true));
    }

    return appOut;
}

function mapSubjectGroupNode(subjgrpDiv, outDoc) {
    const groupOut = outDoc.createElement('SUBJGRP');
    const headText = normalizeWhitespace(xpath.select1('string(./HEAD)', subjgrpDiv));
    if (headText) appendTextElement(outDoc, groupOut, 'HD', headText, { SOURCE: 'HED' });

    for (const child of getElementChildren(subjgrpDiv)) {
        const childType = (child.getAttribute('TYPE') || '').toUpperCase();
        if (child.nodeName === 'HEAD') continue;
        if (child.nodeName === 'DIV8' && childType === 'SECTION') {
            groupOut.appendChild(mapSectionNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV9' && childType === 'APPENDIX') {
            groupOut.appendChild(mapAppendixNode(child, outDoc));
            continue;
        }
        groupOut.appendChild(child.cloneNode(true));
    }

    return groupOut;
}

function mapSubpartNode(subpartDiv, outDoc) {
    const subpartOut = outDoc.createElement('SUBPART');
    const headText = normalizeWhitespace(xpath.select1('string(./HEAD)', subpartDiv));
    if (headText) appendTextElement(outDoc, subpartOut, 'HD', headText, { SOURCE: 'HED' });

    for (const child of getElementChildren(subpartDiv)) {
        const childType = (child.getAttribute('TYPE') || '').toUpperCase();
        if (child.nodeName === 'HEAD') continue;

        if (child.nodeName === 'AUTH' || child.nodeName === 'SOURCE') {
            subpartOut.appendChild(mapAuthOrSourceNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV7' && childType === 'SUBJGRP') {
            subpartOut.appendChild(mapSubjectGroupNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV8' && childType === 'SECTION') {
            subpartOut.appendChild(mapSectionNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV9' && childType === 'APPENDIX') {
            subpartOut.appendChild(mapAppendixNode(child, outDoc));
            continue;
        }

        subpartOut.appendChild(child.cloneNode(true));
    }

    return subpartOut;
}

function buildPartContents(partDiv, outDoc) {
    const contents = outDoc.createElement('CONTENTS');
    appendTextElement(outDoc, contents, 'SECHD', 'Sec.');

    for (const child of getElementChildren(partDiv)) {
        const childType = (child.getAttribute('TYPE') || '').toUpperCase();

        if (child.nodeName === 'DIV8' && childType === 'SECTION') {
            addContentsSectionEntry(child, outDoc, contents);
            continue;
        }

        if (child.nodeName === 'DIV6' && childType === 'SUBPART') {
            const subpartContents = outDoc.createElement('SUBPART');
            const subpartHead = normalizeWhitespace(xpath.select1('string(./HEAD)', child));
            if (subpartHead) {
                appendTextElement(outDoc, subpartContents, 'HD', subpartHead, { SOURCE: 'HED' });
            }

            for (const subChild of getElementChildren(child)) {
                const subChildType = (subChild.getAttribute('TYPE') || '').toUpperCase();
                if (subChild.nodeName === 'DIV8' && subChildType === 'SECTION') {
                    addContentsSectionEntry(subChild, outDoc, subpartContents);
                    continue;
                }
                if (subChild.nodeName === 'DIV7' && subChildType === 'SUBJGRP') {
                    const subjgrp = outDoc.createElement('SUBJGRP');
                    const grpHead = normalizeWhitespace(xpath.select1('string(./HEAD)', subChild));
                    if (grpHead) appendTextElement(outDoc, subjgrp, 'HD', grpHead, { SOURCE: 'HED' });
                    for (const secInGrp of getElementChildren(subChild)) {
                        const secType = (secInGrp.getAttribute('TYPE') || '').toUpperCase();
                        if (secInGrp.nodeName === 'DIV8' && secType === 'SECTION') {
                            addContentsSectionEntry(secInGrp, outDoc, subjgrp);
                        }
                    }
                    subpartContents.appendChild(subjgrp);
                }
            }
            contents.appendChild(subpartContents);
            continue;
        }

        if (child.nodeName === 'DIV9' && childType === 'APPENDIX') {
            const appEntry = normalizeWhitespace(child.getAttribute('N') || xpath.select1('string(./HEAD)', child));
            if (appEntry) appendTextElement(outDoc, contents, 'APP', appEntry);
        }
    }

    return contents;
}

function mapPartNode(partDiv, outDoc) {
    const partOut = outDoc.createElement('PART');
    const partNumber = normalizeWhitespace(partDiv.getAttribute('N') || '');
    const partHeading = normalizeWhitespace(xpath.select1('string(./HEAD)', partDiv));

    if (partNumber) appendTextElement(outDoc, partOut, 'EAR', `Pt. ${partNumber}`);
    if (partHeading) appendTextElement(outDoc, partOut, 'HD', partHeading, { SOURCE: 'HED' });

    partOut.appendChild(buildPartContents(partDiv, outDoc));

    for (const child of getElementChildren(partDiv)) {
        const childType = (child.getAttribute('TYPE') || '').toUpperCase();
        if (child.nodeName === 'HEAD') continue;

        if (child.nodeName === 'AUTH' || child.nodeName === 'SOURCE') {
            partOut.appendChild(mapAuthOrSourceNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV6' && childType === 'SUBPART') {
            partOut.appendChild(mapSubpartNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV8' && childType === 'SECTION') {
            partOut.appendChild(mapSectionNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV7' && childType === 'SUBJGRP') {
            partOut.appendChild(mapSubjectGroupNode(child, outDoc));
            continue;
        }
        if (child.nodeName === 'DIV9' && childType === 'APPENDIX') {
            partOut.appendChild(mapAppendixNode(child, outDoc));
            continue;
        }

        partOut.appendChild(child.cloneNode(true));
    }

    return partOut;
}

function mapSubchapterNode(subchapDiv, outDoc) {
    const subchapOut = outDoc.createElement('SUBCHAP');
    const subchapType = normalizeWhitespace(subchapDiv.getAttribute('N') || '');
    if (subchapType) subchapOut.setAttribute('TYPE', subchapType);

    const headText = normalizeWhitespace(xpath.select1('string(./HEAD)', subchapDiv));
    if (headText) appendTextElement(outDoc, subchapOut, 'HD', headText, { SOURCE: 'HED' });

    for (const child of getElementChildren(subchapDiv)) {
        const childType = (child.getAttribute('TYPE') || '').toUpperCase();
        if (child.nodeName === 'DIV5' && childType === 'PART') {
            subchapOut.appendChild(mapPartNode(child, outDoc));
        }
    }

    return subchapOut;
}

function convertEcfrToGovInfoLikeXml(ecfrXml, { titleNumber, date, chapterCode, volumeSet }) {
    const ecfrDoc = parseXml(ecfrXml);
    const outDoc = parseXml('<CFRDOC/>');
    const root = outDoc.documentElement;

    const titleHead = normalizeWhitespace(xpath.select1('string(//DIV1[@TYPE="TITLE"]/HEAD)', ecfrDoc));
    const chapterPath = `//DIV3[@TYPE="CHAPTER" and normalize-space(@N)="${chapterCode}"]`;
    const chapterDiv = xpath.select1(chapterPath, ecfrDoc);
    if (!chapterDiv) {
        throw new Error(`Could not find chapter ${chapterCode} in eCFR payload`);
    }
    const chapterHead = normalizeWhitespace(xpath.select1('string(./HEAD)', chapterDiv));

    const volumeLabel = Array.from(volumeSet)
        .sort((a, b) => Number(a) - Number(b))
        .join(',');

    const fdsys = outDoc.createElement('FDSYS');
    appendTextElement(outDoc, fdsys, 'CFRTITLE', String(titleNumber));
    appendTextElement(outDoc, fdsys, 'CFRTITLETEXT', parseTitleText(titleHead));
    appendTextElement(outDoc, fdsys, 'VOL', volumeLabel);
    appendTextElement(outDoc, fdsys, 'DATE', date);
    appendTextElement(outDoc, fdsys, 'COVERONLY', 'false');
    appendTextElement(outDoc, fdsys, 'ORIGINALDATE', date);
    appendTextElement(outDoc, fdsys, 'HEADING', `Chapter ${chapterCode}`);
    appendTextElement(outDoc, fdsys, 'TITLE', parseChapterTitle(chapterHead));
    const ancestors = outDoc.createElement('ANCESTORS');
    appendTextElement(outDoc, ancestors, 'PARENT', parseTitleText(titleHead), {
        HEADING: `Title ${titleNumber}`,
        SEQ: '0'
    });
    fdsys.appendChild(ancestors);
    root.appendChild(fdsys);

    const chapterOut = outDoc.createElement('CHAPTER');
    for (const subchap of xpath.select('./DIV4[@TYPE="SUBCHAP"]', chapterDiv)) {
        chapterOut.appendChild(mapSubchapterNode(subchap, outDoc));
    }

    for (const part of xpath.select('./DIV5[@TYPE="PART"]', chapterDiv)) {
        chapterOut.appendChild(mapPartNode(part, outDoc));
    }

    root.appendChild(chapterOut);
    return serializeXml(outDoc);
}

function getPartNumberFromEar(earText) {
    const text = normalizeWhitespace(earText);
    const match = text.match(/Pt\.\s*([A-Za-z0-9.\-]+)/i);
    return match ? match[1] : '';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stripXmlDeclaration(xml) {
    return String(xml || '').replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, '');
}

function pruneFarDocContainers(doc) {
    const subchaps = xpath.select('//SUBCHAP', doc);
    for (const subchap of subchaps) {
        const partsInside = xpath.select('.//PART', subchap);
        if (partsInside.length === 0) {
            subchap.parentNode.removeChild(subchap);
        }
    }
}

function filterFarXmlByKeepParts(farXml) {
    const doc = parseXml(farXml);
    const partNodes = xpath.select('//PART', doc);

    for (const partNode of partNodes) {
        const attrPart = normalizeWhitespace(partNode.getAttribute('N') || '');
        const ear = normalizeWhitespace(xpath.select1('string(./EAR)', partNode));
        const candidate = attrPart || ear;
        if (!shouldKeepPartNumber(candidate)) {
            partNode.parentNode.removeChild(partNode);
        }
    }

    pruneFarDocContainers(doc);
    return serializeXml(doc);
}

function resolveAnnualDisplayDate({ explicitDate, year, annualCombinedXml }) {
    if (explicitDate) return explicitDate;
    try {
        const doc = parseXml(annualCombinedXml);
        const date = normalizeWhitespace(xpath.select1('string(//FDSYS/DATE)', doc));
        if (date) return date;
    } catch {
        // Ignore parse errors; fall back below.
    }
    return year ? `${year}-01-01` : 'unknown';
}

function buildSinglePartFarXmlByIndex(farXml, partIndex) {
    const doc = parseXml(farXml);
    const parts = xpath.select('//PART', doc);
    for (let i = 0; i < parts.length; i += 1) {
        if (i !== partIndex) {
            parts[i].parentNode.removeChild(parts[i]);
        }
    }
    pruneFarDocContainers(doc);
    return serializeXml(doc);
}

export {
    parseXml,
    serializeXml,
    filterByVolumes,
    filterByKeepParts,
    normalizeWhitespace,
    normalizePartNumber,
    shouldKeepPartNumber,
    convertEcfrToGovInfoLikeXml,
    getPartNumberFromEar,
    stripXmlDeclaration,
    filterFarXmlByKeepParts,
    resolveAnnualDisplayDate,
    buildSinglePartFarXmlByIndex
};
