import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
    TREEVIEW_VENDOR_JS_DST,
    TREEVIEW_VENDOR_CSS_DST
} from './config.mjs';
import { buildSinglePartFarXmlByIndex, stripXmlDeclaration } from './xml-transform.mjs';
import {
    extractPartEntries,
    extractNavigationParts,
    extractSearchEntries,
    seqnumIdFromSectno
} from './xml-index.mjs';
import { addPwaMetadata, writeFarPwaFiles } from './pwa.mjs';
import { isStrictChildPath, replaceDirectoryAtomically, writeFileAtomic } from './fs-utils.mjs';
import {
    ensureTreeViewVendorAssets,
    readMiniSearchVendorAsset,
    preparePartHtmlForSplitShell,
    buildSplitIndexHtml
} from './site.mjs';

const execFileAsync = promisify(execFile);

function toPosix(value) {
    return String(value).split(path.sep).join('/');
}

async function renderXmlToHtml({ xslPath, xmlPath, htmlPath }) {
    const { stdout } = await execFileAsync('xsltproc', [xslPath, xmlPath], {
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024
    });
    await writeFileAtomic(htmlPath, stdout, 'utf8');
}

async function generateSplitPartSite({ farXml, htmlPath, xslPath, title, chapter, sourceDescription, scopeDescription, partsDirArg }) {
    const htmlDir = path.dirname(htmlPath);
    const baseName = path.basename(htmlPath, path.extname(htmlPath));
    const outputDir = path.resolve(htmlDir);
    const defaultPartsDir = path.join(outputDir, `${baseName}-parts`);
    const configuredPartsDir = partsDirArg ? path.resolve(partsDirArg) : defaultPartsDir;
    if (!isStrictChildPath(outputDir, configuredPartsDir)) {
        throw new Error(`--parts-dir must be a child directory of the HTML output directory: ${outputDir}`);
    }

    const finalPartsDir = configuredPartsDir;
    const partsDir = await fs.mkdtemp(
        path.join(path.dirname(configuredPartsDir), `.${baseName}-parts-build-`)
    );
    const partsDirName = toPosix(path.relative(outputDir, finalPartsDir));
    const vendorRelativeRoot = toPosix(path.relative(finalPartsDir, outputDir));
    const splitVendorHref = `${vendorRelativeRoot ? `${vendorRelativeRoot}/` : ''}vendor`;
    let partsCommitted = false;

    try {
        await ensureTreeViewVendorAssets(outputDir);
        const searchVendorJs = await readMiniSearchVendorAsset();
        const entries = extractPartEntries(farXml);
        const navParts = extractNavigationParts(farXml, entries);
        const buildNonce = String(Date.now());
        if (entries.length === 0) throw new Error('No PART nodes found in FAR XML; cannot split by part.');

        const publicParts = [];
        for (const entry of entries) {
            const partXml = buildSinglePartFarXmlByIndex(farXml, entry.index);
            const htmlFileName = `${entry.basename}.html`;
            const xmlOut = path.join(partsDir, `.tmp-${entry.basename}.xml`);
            const htmlOut = path.join(partsDir, htmlFileName);
            const href = `${partsDirName}/${htmlFileName}?v=${buildNonce}`;

            await writeFileAtomic(xmlOut, stripXmlDeclaration(partXml), 'utf8');
            await renderXmlToHtml({ xslPath, xmlPath: xmlOut, htmlPath: htmlOut });
            await fs.rm(xmlOut, { force: true });
            const renderedHtml = await fs.readFile(htmlOut, 'utf8');
            const preparedSplitHtml = preparePartHtmlForSplitShell(renderedHtml, splitVendorHref);
            await writeFileAtomic(htmlOut, preparedSplitHtml, 'utf8');
            publicParts.push({ ...entry, href });
        }

        // mkdtemp() intentionally creates 0700 directories. Normalize the
        // staged public directory before the atomic rename so a web server
        // user can traverse and serve the generated part pages.
        await fs.chmod(partsDir, 0o755);
        await replaceDirectoryAtomically(partsDir, finalPartsDir);
        partsCommitted = true;

        const hrefByIndex = new Map(publicParts.map(part => [part.index, part.href]));
        const navWithHrefs = navParts.map(part => ({
            ...part,
            href: hrefByIndex.get(part.index) || `${partsDirName}/${part.basename}.html?v=${buildNonce}`
        }));
        const renderedScopeDescription = `${scopeDescription}; parts ${publicParts.map(part => part.partNumber).join(', ')}`;
        const searchEntries = extractSearchEntries(farXml).flatMap(entry => {
            const part = publicParts[entry.partIndex];
            if (!part) return [];
            return [{
                target: `${part.href}#seqnum${seqnumIdFromSectno(entry.sectno)}`,
                sectno: entry.sectno,
                subject: entry.subject,
                partHeading: entry.partHeading || part.heading || part.ear,
                subpart: entry.subpart,
                subjectGroup: entry.subjectGroup,
                text: entry.text
            }];
        });
        await fs.rm(path.join(htmlDir, 'far-search.json'), { force: true });

        const defaultTarget = publicParts[0].href;
        const indexHtml = buildSplitIndexHtml({ title: String(title), chapter: String(chapter), sourceDescription, scopeDescription: renderedScopeDescription, parts: navWithHrefs, defaultSrc: defaultTarget, searchEntries, searchVendorJs });
        const pwaPartFiles = [
            ...publicParts.map(part => path.join(finalPartsDir, `${part.basename}.html`)),
            path.join(outputDir, TREEVIEW_VENDOR_JS_DST),
            path.join(outputDir, TREEVIEW_VENDOR_CSS_DST)
        ];
        const pwa = await writeFarPwaFiles({ htmlDir, shellFileName: path.basename(htmlPath), partFiles: pwaPartFiles, buildVersion: buildNonce });
        await writeFileAtomic(htmlPath, addPwaMetadata(indexHtml, pwa), 'utf8');

        return { partsDirName, partsDir: finalPartsDir, partCount: publicParts.length };
    } finally {
        if (!partsCommitted) await fs.rm(partsDir, { recursive: true, force: true }).catch(() => {});
    }
}

export { generateSplitPartSite, renderXmlToHtml };
