#!/usr/bin/env node

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import decompress from 'decompress';
import { JSDOM } from 'jsdom';

const CS_URL = 'https://aeronav.faa.gov/upload_313-d/supplements/';
const TPP_URL = 'https://aeronav.faa.gov/upload_313-d/terminal/';
const IFR_ENROUTE_URL = 'https://aeronav.faa.gov/enroute/';
const VFR_URL = 'https://aeronav.faa.gov/visual/';
const DEFAULT_OUTPUT = 'dist';
const REQUEST_TIMEOUT_MS = 120_000;
const execFileAsync = promisify(execFile);

const CS_REGIONS = ['SW'];
const TPP_REGIONS = ['SW1', 'SW2', 'SW3', 'SW4'];
const IFR_ENROUTE_LOW = [2, 3, 4];
const IFR_ENROUTE_HIGH: number[] = [];
const VFR_SECTIONAL = ['San Francisco', 'Los Angeles', 'San Diego', 'Las Vegas'];
const VFR_TERMINAL = ['San Francisco', 'Los Angeles', 'San Diego', 'Las Vegas'];

type UnzipMap = Record<string, string>;

type Candidate = {
    url: string;
    date: string;
    unzip?: UnzipMap;
};

type RegionListing = {
    current?: Candidate;
};

type RegionMap = Record<string, RegionListing>;

type ChartGroup = {
    prefix: string;
    files: RegionMap;
};

type VfrListings = {
    sectional: RegionMap;
    terminal: RegionMap;
};

type Options = {
    output: string;
    help: boolean;
    tile?: string;
};

const IFR_TRIM_WINDOWS: Record<string, [number, number, number, number]> = {
    'ifr-enroute-low-l02.tif': [2175, 250, 17650, 7500],
    'ifr-enroute-low-l03.tif': [2175, 250, 19650, 7550],
    'ifr-enroute-low-l04.tif': [4150, 225, 17700, 7550]
};

function parseArgs(argv: string[]): Options {
    const options: Options = { output: DEFAULT_OUTPUT, help: false };

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg.startsWith('--output=')) {
            options.output = arg.slice('--output='.length);
        } else if (arg.startsWith('--tile=')) {
            options.tile = arg.slice('--tile='.length);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!options.output.trim()) {
        throw new Error('--output must not be empty');
    }
    if (options.tile !== undefined && !options.tile.trim()) {
        throw new Error('--tile must not be empty');
    }

    return options;
}

function printHelp(): void {
    console.log(`Usage: node --import=tsx download-charts.ts [options]

Downloads the current FAA charts and produces WebP MBTiles for raster charts.

Options:
  --output=DIR     Build root (default: dist)
  --tile=FILE      Convert one existing TIFF to WebP MBTiles
  --help, -h       Show this help

Output layout:
  DIR/charts/      PDFs, GeoTIFFs, and MBTiles grouped by publication date
  DIR/zips/        Downloaded source ZIP archives grouped by publication date

Example:
  npm run build:charts
`);
}

function createRegionMap(regions: string[]): RegionMap {
    return Object.fromEntries(regions.map(region => [region, {}])) as RegionMap;
}

function addCandidate(files: RegionMap, region: string, candidate: Candidate): void {
    const listing = files[region];
    if (!listing || !isPublished(candidate.date)) return;

    if (!listing.current || candidate.date > listing.current.date) {
        listing.current = candidate;
    }
}

function dateKey(year: string, month: string, day: string): string {
    return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): string | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
        ? null
        : value;
}

function parseCompactDate(value: string): string | null {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    return match ? parseDateKey(dateKey(match[1], match[2], match[3])) : null;
}

function parseAmericanDate(value: string): string | null {
    const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return match ? parseDateKey(dateKey(match[3], match[1], match[2])) : null;
}

function isPublished(value: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return value <= today;
}

function normalizeArchivePath(value: string): string {
    return value.replaceAll('\\', '/').replaceAll(' ', '_').replace(/^\/+/, '');
}

function anchorText(anchor: any): string {
    return String(anchor.textContent || '').trim();
}

function anchorHref(anchor: any): string {
    return String(anchor.getAttribute('href') || '').trim();
}

function anchors(dom: any): any[] {
    return Array.from(dom.window.document.querySelectorAll('a'));
}

async function request(url: string): Promise<Response> {
    return fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'user-agent': 'faa-regs-chart-builder/1.0' }
    });
}

async function fetchResponse(url: string): Promise<Response> {
    const response = await request(url);
    if (!response.ok) {
        throw new Error(`FAA request failed (${response.status} ${response.statusText}): ${url}`);
    }
    return response;
}

async function fetchDom(url: string): Promise<any> {
    const response = await fetchResponse(url);
    return new JSDOM(await response.text(), { url });
}

async function downloadFile(url: string, destination: string): Promise<boolean> {
    try {
        const stat = await fs.stat(destination);
        if (stat.isFile()) {
            console.log(`file "${destination}" already exists`);
            return true;
        }
    } catch (error: any) {
        if (error.code !== 'ENOENT') throw error;
    }

    console.log(`downloading "${url}"`);
    const response = await request(url);
    if (response.status === 404) {
        console.warn(`skipping unavailable FAA chart (404): ${url}`);
        return false;
    }
    if (!response.ok) {
        throw new Error(`FAA request failed (${response.status} ${response.statusText}): ${url}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes);
    return true;
}

async function getChartSupplementDirectory(): Promise<RegionMap> {
    const files = createRegionMap(CS_REGIONS);
    const dom = await fetchDom(CS_URL);

    for (const anchor of anchors(dom)) {
        const href = anchorHref(anchor);
        const filename = anchorText(anchor) || path.basename(href);
        const match = filename.match(/^CS_([A-Z]+)_(\d{8})\.pdf$/i);
        const date = match ? parseCompactDate(match[2]) : null;
        if (!match || !date) continue;

        addCandidate(files, match[1].toUpperCase(), {
            url: new URL(href || filename, CS_URL).href,
            date
        });
    }

    return files;
}

async function getTerminalProcedurePublication(): Promise<RegionMap> {
    const files = createRegionMap(TPP_REGIONS);
    const dom = await fetchDom(TPP_URL);

    for (const folderAnchor of anchors(dom)) {
        const href = anchorHref(folderAnchor);
        const source = `${anchorText(folderAnchor)} ${href}`;
        const match = source.match(/(\d{4}-\d{2}-\d{2})/);
        const date = match ? parseDateKey(match[1]) : null;
        if (!match || !date || !isPublished(date)) continue;

        const folderUrl = new URL(href || `${match[1]}/`, TPP_URL).href;
        const folderDom = await fetchDom(folderUrl);
        for (const fileAnchor of anchors(folderDom)) {
            const fileHref = anchorHref(fileAnchor);
            const filename = anchorText(fileAnchor) || path.basename(fileHref);
            const fileMatch = filename.match(/^([A-Z0-9]+)\.pdf$/i);
            if (!fileMatch) continue;

            addCandidate(files, fileMatch[1].toUpperCase(), {
                url: new URL(fileHref || filename, folderUrl).href,
                date
            });
        }
    }

    return files;
}

async function getIfrEnroute(): Promise<RegionMap> {
    const regions = [
        ...IFR_ENROUTE_LOW.map(value => `L${String(value).padStart(2, '0')}`),
        ...IFR_ENROUTE_HIGH.map(value => `H${String(value).padStart(2, '0')}`)
    ];
    const files = createRegionMap(regions);
    const dom = await fetchDom(IFR_ENROUTE_URL);

    for (const folderAnchor of anchors(dom)) {
        const href = anchorHref(folderAnchor);
        const source = `${anchorText(folderAnchor)} ${href}`;
        const match = source.match(/(\d{2}-\d{2}-\d{4})/);
        const date = match ? parseAmericanDate(match[1]) : null;
        if (!match || !date || !isPublished(date)) continue;

        const folderUrl = new URL(href || `${match[1]}/`, IFR_ENROUTE_URL).href;
        const folderDom = await fetchDom(folderUrl);
        for (const fileAnchor of anchors(folderDom)) {
            const fileHref = anchorHref(fileAnchor);
            const filename = anchorText(fileAnchor) || path.basename(fileHref);
            const fileMatch = filename.match(/^ENR_([A-Z0-9]+)\.zip$/i);
            if (!fileMatch) continue;

            const region = fileMatch[1].toUpperCase();
            addCandidate(files, region, {
                url: new URL(fileHref || filename, folderUrl).href,
                date,
                unzip: { [`ENR_${region}.tif`]: '.tif' }
            });
        }
    }

    return files;
}

async function getVfr(): Promise<VfrListings> {
    const sectional = createRegionMap(VFR_SECTIONAL.map(region => region.replaceAll(' ', '_')));
    const terminal = createRegionMap(VFR_TERMINAL.map(region => region.replaceAll(' ', '_')));
    const dom = await fetchDom(VFR_URL);

    for (const folderAnchor of anchors(dom)) {
        const href = anchorHref(folderAnchor);
        const source = `${anchorText(folderAnchor)} ${href}`;
        const match = source.match(/(\d{2}-\d{2}-\d{4})/);
        const date = match ? parseAmericanDate(match[1]) : null;
        if (!match || !date || !isPublished(date)) continue;

        for (const regionName of VFR_SECTIONAL) {
            const region = regionName.replaceAll(' ', '_');
            addCandidate(sectional, region, {
                url: new URL(`${match[1]}/sectional-files/${region}.zip`, VFR_URL).href,
                date,
                unzip: { [`${region}_SEC.tif`]: '.tif' }
            });
        }

        for (const regionName of VFR_TERMINAL) {
            const region = regionName.replaceAll(' ', '_');
            addCandidate(terminal, region, {
                url: new URL(`${match[1]}/tac-files/${region}_TAC.zip`, VFR_URL).href,
                date,
                unzip: {
                    [`${region}_TAC.tif`]: '.tif',
                    [`${region}_FLY.tif`]: '-flyway.tif'
                }
            });
        }
    }

    return { sectional, terminal };
}

async function discoverCharts(): Promise<ChartGroup[]> {
    const [supplements, terminalProcedures, ifrEnroute, vfr] = await Promise.all([
        getChartSupplementDirectory(),
        getTerminalProcedurePublication(),
        getIfrEnroute(),
        getVfr()
    ]);

    return [
        { prefix: 'cs', files: supplements },
        { prefix: 'tpp', files: terminalProcedures },
        { prefix: 'ifr-enroute-low', files: ifrEnroute },
        { prefix: 'vfr-sectional', files: vfr.sectional },
        { prefix: 'vfr-terminal', files: vfr.terminal }
    ];
}

async function extractChart(
    archivePath: string,
    outputRoot: string,
    chartRoot: string,
    date: string,
    group: ChartGroup,
    region: string,
    unzip: UnzipMap
): Promise<void> {
    const chartPrefix = `${group.prefix}-${region.toLowerCase()}`;

    console.log(`extracting "${archivePath}"`);
    await decompress(archivePath, outputRoot, {
        filter: (entry: any) => unzip[normalizeArchivePath(entry.path)] != null,
        map: (entry: any) => {
            const sourceName = normalizeArchivePath(entry.path);
            const suffix = unzip[sourceName];
            const chartFilePath = path.join(chartRoot, date, `${chartPrefix}${suffix}`);
            entry.path = path.relative(outputRoot, chartFilePath).split(path.sep).join('/');
            return entry;
        }
    });
}

async function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
        return await execFileAsync(command, args, {
            maxBuffer: 16 * 1024 * 1024
        });
    } catch (error: any) {
        const detail = String(error.stderr || error.stdout || error.message || error).trim();
        throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
    }
}

async function verifyGdalTools(): Promise<void> {
    for (const command of ['gdalinfo', 'gdal_translate', 'gdalwarp', 'gdaladdo']) {
        await runCommand(command, ['--version']);
    }

    const formats = await runCommand('gdalinfo', ['--formats']);
    for (const format of ['WEBP', 'MBTiles']) {
        if (!formats.stdout.includes(format)) {
            throw new Error(`GDAL does not provide the required ${format} driver`);
        }
    }
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

async function findTiffs(directory: string): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const tiffs: string[] = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            tiffs.push(...await findTiffs(entryPath));
        } else if (entry.isFile() && /\.tif$/i.test(entry.name)) {
            tiffs.push(entryPath);
        }
    }

    return tiffs.sort();
}

export async function tileMbtilesFromTiff(tifPath: string): Promise<void> {
    const basePath = tifPath.replace(/\.tif$/i, '');
    const trimVrtPath = `${basePath}-trim.vrt`;
    const rgbVrtPath = `${basePath}-rgb.vrt`;
    const alphaVrtPath = `${basePath}-alpha.vrt`;
    const mbtilesPath = `${basePath}.mbtiles`;
    const temporaryPaths = [trimVrtPath, rgbVrtPath, alphaVrtPath];

    if (await fileExists(mbtilesPath)) {
        await Promise.all(temporaryPaths.map(filePath => fs.rm(filePath, { force: true })));
        console.log(`file "${mbtilesPath}" already exists`);
        return;
    }

    let sourcePath = tifPath;
    try {
        const trimWindow = IFR_TRIM_WINDOWS[path.basename(tifPath)];
        if (trimWindow) {
            const [x, y, width, height] = trimWindow;
            await runCommand('gdal_translate', [
                '-srcwin', String(x), String(y), String(width), String(height),
                '-of', 'VRT', tifPath, trimVrtPath
            ]);
            sourcePath = trimVrtPath;
        }

        const info = await runCommand('gdalinfo', [sourcePath]);
        if (info.stdout.includes('ColorInterp=Palette')) {
            await runCommand('gdal_translate', [
                '-expand', 'rgb', '-of', 'VRT', sourcePath, rgbVrtPath
            ]);
            sourcePath = rgbVrtPath;
        }

        console.log(`rendering mbtiles for "${tifPath}"`);
        await runCommand('gdalwarp', [
            '-t_srs', 'EPSG:3857', '-dstalpha', '-of', 'VRT', sourcePath, alphaVrtPath
        ]);
        await runCommand('gdal_translate', [
            '-of', 'MBTILES',
            '-co', 'TILE_FORMAT=WEBP',
            '-co', 'QUALITY=80',
            alphaVrtPath,
            mbtilesPath
        ]);
        await runCommand('gdaladdo', [
            '-r', 'nearest', mbtilesPath, '2', '4', '8', '16', '32'
        ]);
        console.log(`Wrote ${mbtilesPath}`);
    } finally {
        await Promise.all(temporaryPaths.map(filePath => fs.rm(filePath, { force: true })));
    }
}

async function tileCharts(chartRoot: string): Promise<void> {
    await verifyGdalTools();
    const tiffs = await findTiffs(chartRoot);
    if (tiffs.length === 0) {
        console.log(`No chart TIFFs found under ${chartRoot}`);
        return;
    }

    for (const tifPath of tiffs) {
        await tileMbtilesFromTiff(tifPath);
    }
}

async function buildCharts(options: Options): Promise<void> {
    const outputRoot = path.resolve(options.output);
    const chartRoot = path.join(outputRoot, 'charts');
    const downloadRoot = path.join(outputRoot, 'zips');

    await fs.mkdir(chartRoot, { recursive: true });
    await fs.mkdir(downloadRoot, { recursive: true });

    const groups = await discoverCharts();
    for (const group of groups) {
        for (const [region, listing] of Object.entries(group.files)) {
            const current = listing.current;
            if (!current) {
                console.warn(`no current chart found for ${group.prefix}/${region}`);
                continue;
            }

            const destinationRoot = current.unzip ? downloadRoot : chartRoot;
            const extension = current.unzip ? 'zip' : 'pdf';
            const filename = `${group.prefix}-${region.toLowerCase()}.${extension}`;
            const sourcePath = path.join(destinationRoot, current.date, filename);
            const available = await downloadFile(current.url, sourcePath);

            if (current.unzip && available) {
                await extractChart(
                    sourcePath,
                    outputRoot,
                    chartRoot,
                    current.date,
                    group,
                    region,
                    current.unzip
                );
            }
        }
    }

    await tileCharts(chartRoot);
    console.log(`Charts are ready under ${chartRoot}`);
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
    } else if (options.tile) {
        await verifyGdalTools();
        await tileMbtilesFromTiff(path.resolve(options.tile));
    } else {
        await buildCharts(options);
    }
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPath) {
    main().catch(error => {
        console.error('❌ Error:', error);
        process.exitCode = 1;
    });
}
