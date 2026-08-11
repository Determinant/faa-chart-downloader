import fs from 'fs/promises';
import path from 'path';
import {
    TREEVIEW_VENDOR_JS_SRC,
    TREEVIEW_VENDOR_JS_DST,
    TREEVIEW_VENDOR_CSS_SRC,
    TREEVIEW_VENDOR_CSS_DST,
    MINISEARCH_VENDOR_JS_SRC
} from './config.mjs';
import {
    buildSplitIndexHtml
} from './site-shell.mjs';

async function ensureTreeViewVendorAssets(baseDir = '.') {
    const vendorDir = path.resolve(baseDir, path.dirname(TREEVIEW_VENDOR_JS_DST));
    await fs.mkdir(vendorDir, { recursive: true });
    await fs.copyFile(TREEVIEW_VENDOR_JS_SRC, path.join(vendorDir, path.basename(TREEVIEW_VENDOR_JS_DST)));
    await fs.copyFile(TREEVIEW_VENDOR_CSS_SRC, path.join(vendorDir, path.basename(TREEVIEW_VENDOR_CSS_DST)));
}

async function readMiniSearchVendorAsset() {
    return fs.readFile(MINISEARCH_VENDOR_JS_SRC, 'utf8');
}

function normalizeRawTextBlocks(html) {
    return String(html || '').replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, body) => {
        // In raw-text elements, entity refs are not decoded by browsers.
        // Decode only angle entities that break emitted CSS/JS operators.
        let normalizedBody = body
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        if (String(tag).toLowerCase() === 'script') {
            // Ensure decoded content cannot accidentally terminate the script tag.
            normalizedBody = normalizedBody.replace(/<\/script/gi, '<\\/script');
        }

        return `<${tag}${attrs}>${normalizedBody}</${tag}>`;
    });
}

function forceSingleSidebarLayout(html) {
    const markerStyle = `<style>
body { margin: 0 !important; }
#layout { display: block !important; }
#sidebar { display: none !important; }
#main { padding: 1em !important; }
</style>`;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${markerStyle}</head>`);
    }
    return `${markerStyle}\n${html}`;
}

function preparePartHtmlForSplitShell(html, vendorHref = 'vendor') {
    const source = normalizeRawTextBlocks(html);
    const prefix = String(vendorHref || 'vendor').replace(/\/+$/g, '');
    const withVendorPath = source
        .replace(/vendor\/js-treeview\.min\.css/g, `${prefix}/js-treeview.min.css`)
        .replace(/vendor\/js-treeview\.min\.js/g, `${prefix}/js-treeview.min.js`);
    return forceSingleSidebarLayout(withVendorPath);
}

export {
    ensureTreeViewVendorAssets,
    readMiniSearchVendorAsset,
    preparePartHtmlForSplitShell,
    buildSplitIndexHtml
};
