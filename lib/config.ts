export const DEFAULT_TITLE = 14;
export const DEFAULT_CHAPTER = 'I';
export const DEFAULT_VOLUMES = [1, 2, 3];
export const DEFAULT_SOURCE = 'ecfr';
export const DEFAULT_COMBINED_PATH = 'dist/far/combined-ecfr.xml';
export const DEFAULT_FAR_PATH = 'dist/far/far-ecfr.xml';
export const DEFAULT_HTML_PATH = 'dist/far/index.html';
export const DEFAULT_XSL_PATH = 'cfr-ecfr.xsl';

export const TREEVIEW_VENDOR_JS_SRC = 'node_modules/js-treeview/dist/treeview.min.js';
export const TREEVIEW_VENDOR_JS_DST = 'vendor/js-treeview.min.js';
export const TREEVIEW_VENDOR_CSS_SRC = 'node_modules/js-treeview/dist/treeview.min.css';
export const TREEVIEW_VENDOR_CSS_DST = 'vendor/js-treeview.min.css';
export const MINISEARCH_VENDOR_JS_SRC = 'node_modules/minisearch/dist/umd/index.js';
export const FAR_NARROW_BREAKPOINT = 820;

export const KEEP_PART_NUMBERS = new Set([
    '1', '5', '21', '39', '43', '45', '47', '48', '60', '61',
    '63', '65', '67', '68', '71', '73', '89', '91', '93', '95',
    '97', '103', '105', '107', '110', '119', '121', '135', '136',
    '137', '141', '142'
]);

const SOURCE_TYPES = new Set(['ecfr', 'annual']);
const VALUE_OPTIONS = new Set([
    '--source', '--date', '--year', '--vols', '--title', '--chapter',
    '--source-xml', '--combined', '--far', '--html', '--xsl', '--parts-dir'
]);
const FLAG_OPTIONS = new Set([
    '--help'
]);

export function parseCliArgs(argv) {
    const args = { flags: new Set(), positionals: [] };
    for (const arg of argv) {
        if (arg === '-h') {
            args.flags.add('-h');
            continue;
        }
        if (!arg.startsWith('--')) {
            args.positionals.push(arg);
            continue;
        }
        const eq = arg.indexOf('=');
        if (eq === -1) {
            args.flags.add(arg);
            continue;
        }
        args[arg.slice(0, eq)] = arg.slice(eq + 1);
    }
    return args;
}

export function validateCliArgs(args) {
    if (args.positionals?.length) {
        throw new Error(`Unexpected positional argument(s): ${args.positionals.join(', ')}`);
    }

    for (const flag of args.flags) {
        if (flag === '-h') continue;
        if (VALUE_OPTIONS.has(flag)) {
            throw new Error(`${flag} requires a value, for example ${flag}=...`);
        }
        if (!FLAG_OPTIONS.has(flag)) {
            throw new Error(`Unknown option: ${flag}`);
        }
    }

    for (const key of Object.keys(args)) {
        if (!key.startsWith('--')) continue;
        if (!VALUE_OPTIONS.has(key)) {
            throw new Error(`Unknown option: ${key}`);
        }
    }
}

export function parsePositiveInteger(raw, optionName) {
    const value = String(raw ?? '').trim();
    if (!/^[1-9]\d*$/.test(value)) {
        throw new Error(`Invalid ${optionName}="${raw}". Expected a positive integer.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
        throw new Error(`Invalid ${optionName}="${raw}". Expected a safe positive integer.`);
    }
    return parsed;
}

export function parseVolumes(raw) {
    if (!raw) return new Set(DEFAULT_VOLUMES.map(String));
    const values = raw
        .split(',')
        .map(v => v.trim());

    if (values.length === 0) {
        throw new Error('--vols cannot be empty. Example: --vols=1,2,3');
    }
    if (values.some(value => value === '')) {
        throw new Error('--vols cannot contain empty values. Example: --vols=1,2,3');
    }

    for (const value of values) {
        if (!/^\d+$/.test(value)) {
            throw new Error(`Invalid volume "${value}". Expected positive integers, comma separated.`);
        }
        if (Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
            throw new Error(`Invalid volume "${value}". Expected positive integers, comma separated.`);
        }
    }

    return new Set(values.map(value => String(Number(value))));
}

export function parseSourceType(raw) {
    const value = String(raw || DEFAULT_SOURCE).trim().toLowerCase();
    if (value === 'annual-cfr') return 'annual';
    if (!SOURCE_TYPES.has(value)) {
        throw new Error(`Unsupported --source="${raw}". Expected one of: ecfr, annual`);
    }
    return value;
}

export function parseYear(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const value = String(raw).trim();
    if (!/^\d{4}$/.test(value)) {
        throw new Error(`Invalid --year="${raw}". Expected YYYY, for example --year=2025`);
    }
    return value;
}

export function parseDate(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const value = String(raw).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`Invalid --date="${raw}". Expected YYYY-MM-DD, for example --date=2026-08-06`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error(`Invalid --date="${raw}". Expected a real calendar date.`);
    }
    return value;
}
