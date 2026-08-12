import xpath from 'xpath';
import { getElementChildren, normalizeWhitespace } from './xml-utils.ts';

const PARAGRAPH_NODE_NAMES = new Set([
    'P', 'P2', 'FP', 'FP-1', 'FP-2', 'FP-DASH', 'FP1-2', 'PSPACE'
]);

function getParagraphNodes(sectionNode) {
    return getElementChildren(sectionNode)
        .filter(node => PARAGRAPH_NODE_NAMES.has(node.nodeName));
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

function parseParagraphMarkerSequence(text) {
    const raw = normalizeWhitespace(text);
    if (!raw) return null;

    const markers = [];
    let remainder = raw;

    while (true) {
        const match = remainder.match(/^(?:\(([A-Za-z0-9]+)\)|([A-Za-z0-9]+)[.)])/);
        if (!match) break;

        const token = match[1] || match[2];
        const style = match[1] ? 'paren' : 'dot';
        const marker = classifyMarkerToken(token);
        if (!marker) return markers.length ? { markers } : null;

        const after = remainder.slice(match[0].length);
        const adjacentMarker = /^(?:\(|[A-Za-z0-9]+[.)])/.test(after);
        const validBoundary = adjacentMarker || /^(?:\s+|[—-]\s*|$)/.test(after);
        if (!validBoundary) break;

        if (!isLikelyParagraphListMarker({ token, kind: marker.kind, style, tail: after })) {
            return markers.length ? { markers } : null;
        }

        markers.push(marker);
        remainder = after;
        if (!adjacentMarker) break;
    }

    return markers.length ? { markers } : null;
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

    if (!prevEntry) return 'lower';

    // Numeric and Roman siblings introduce a Roman sub-list: (1) -> (i),
    // while a Roman sibling continues that same list: (ii) -> (iii).
    if (prevKind === 'num' || prevKind === 'roman') return 'roman';

    // A single i/v/x is ambiguous. Treat it as alphabetic only when it
    // actually continues the preceding alphabetic sequence, such as h -> i.
    // b -> i, c -> i, etc. are the common Roman-subparagraph form.
    if (prevKind === 'lower') {
        return isNextLowerToken(prevEntry.token, currentToken) ? 'lower' : 'roman';
    }

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

function advanceParagraphMarker(marker, state) {
    if (marker.kind === 'ambig') {
        marker = {
            ...marker,
            kind: resolveAmbiguousMarkerKind(marker.token, state.stack, state.currentDepth)
        };
    }

    const { stack } = state;
    const prevKind = state.currentDepth > 0 ? stack[state.currentDepth - 1].kind : null;
    if (!state.mode && prevKind) {
        if (prevKind === 'lower' && marker.kind === 'num') state.mode = 'lower-first';
        if (prevKind === 'num' && marker.kind === 'lower') state.mode = 'num-first';
    }

    const rank = rankForKind(marker.kind, state.mode);
    const prevRank = prevKind ? rankForKind(prevKind, state.mode) : null;

    let depth = 1;
    if (state.currentDepth === 0) {
        depth = 1;
    } else if (marker.kind === prevKind) {
        depth = state.currentDepth;
    } else {
        let sameKindDepth = 0;
        for (let i = state.currentDepth; i >= 1; i--) {
            if (stack[i - 1].kind === marker.kind) {
                sameKindDepth = i;
                break;
            }
        }

        if (sameKindDepth > 0 && rank <= prevRank) {
            depth = sameKindDepth;
        } else if (prevRank !== null && rank > prevRank) {
            depth = state.currentDepth + 1;
        } else {
            let ancestor = 0;
            for (let i = state.currentDepth; i >= 1; i--) {
                const ancestorRank = rankForKind(stack[i - 1].kind, state.mode);
                if (ancestorRank < rank) {
                    ancestor = i;
                    break;
                }
            }
            depth = ancestor + 1;
        }
    }

    state.stack.length = Math.max(0, depth - 1);
    state.stack.push({ kind: marker.kind, token: marker.token });
    state.currentDepth = Math.max(1, depth);
    return state.currentDepth;
}

function assignParagraphDepths(sectionOut) {
    const paragraphs = getParagraphNodes(sectionOut);
    const state = { stack: [], currentDepth: 0, mode: null };

    for (const paragraph of paragraphs) {
        paragraph.removeAttribute('LEVEL');
        const parsed = parseParagraphMarkerSequence(xpath.select1('string(.)', paragraph));
        if (!parsed) continue;

        let depth = 1;
        for (const marker of parsed.markers) {
            depth = advanceParagraphMarker(marker, state);
        }
        paragraph.setAttribute('LEVEL', String(depth));
    }
}

function splitInlineSubparagraph(pNode, outDoc) {
    const fullText = normalizeWhitespace(xpath.select1('string(.)', pNode));
    if (!/^\([A-Za-z0-9]+\)/.test(fullText)) return false;
    if (!parseParagraphMarkerSequence(fullText)) return false;

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

    const nextP = pNode.cloneNode(false);
    nextP.removeAttribute('LEVEL');
    let node = splitNode;
    while (node) {
        const next = node.nextSibling;
        nextP.appendChild(node);
        node = next;
    }

    if (pNode.nextSibling) {
        pNode.parentNode.insertBefore(nextP, pNode.nextSibling);
    } else {
        pNode.parentNode.appendChild(nextP);
    }

    return true;
}

export function normalizeSectionParagraphStructure(sectionOut, outDoc) {
    // Keep scanning until no paragraph yields another split so newly inserted
    // sibling paragraphs are also normalized.
    let changed = true;
    while (changed) {
        changed = false;
        const paragraphs = getParagraphNodes(sectionOut);
        for (const paragraph of paragraphs) {
            if (splitInlineSubparagraph(paragraph, outDoc)) changed = true;
        }
    }

    assignParagraphDepths(sectionOut);
}
