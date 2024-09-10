#!/usr/bin/env node

// Sources: FAA official website
const csUrl = "https://aeronav.faa.gov/upload_313-d/supplements/";
const tppUrl = "https://aeronav.faa.gov/upload_313-d/terminal/";
const ifrEnrouteUrl = "https://aeronav.faa.gov/enroute/";
const vfrUrl = "https://aeronav.faa.gov/visual/";
const output = ".";

import { JSDOM } from "jsdom";
import moment from "moment";
import fs from "node:fs/promises";
import decompress from "decompress";
import { waitForDebugger } from "node:inspector";

const csRegions = ["SW"];
const tppRegions = ["SW1", "SW2", "SW3", "SW4"];
const ifrEnrouteLow = [2, 3, 4];
const ifrEnrouteHigh = [];
const vfrSectional = ["San Francisco", "Los Angeles"];
const vfrTerminal = ["San Francisco", "Los Angeles"];

const getChartSupplementDiretory = async () => {
    const dom = await JSDOM.fromURL(csUrl, {});
    let chd = dom.window.document.querySelector("pre").children;
    const files = {};
    for (let region of csRegions) {
        files[region] = [];
        files[region].current = { date: moment(0) };
    }
    const pattern = /CS_([A-Z]+)_([0-9]{8}).pdf/;
    for (let i = 0; i < chd.length; i++) {
        if (chd[i] instanceof dom.window.HTMLAnchorElement) {
            const file = chd[i].textContent;
            const m = file.match(pattern);
            if (m) {
                const region = m[1];
                const date = moment(m[2], "YYYYMMDD");
                const url = `${csUrl}${file}`;
                if (files[region]) {
                    files[region].push({ url, date });
                    if (moment() >= date && date > files[region].current.date) {
                        files[region].current = {
                            url,
                            date,
                        };
                    }
                }
            }
        }
    }
    return files;
};

const getTerminalProcedurePublication = async () => {
    const dom = await JSDOM.fromURL(tppUrl, {});
    let chd = dom.window.document.querySelector("pre").children;
    const files = {};
    for (let region of tppRegions) {
        files[region] = [];
        files[region].current = { date: moment(0) };
    }
    const pattern = /([0-9]{4}-[0-9]{2}-[0-9]{2})/;
    for (let i = 0; i < chd.length; i++) {
        if (chd[i] instanceof dom.window.HTMLAnchorElement) {
            const folder = chd[i].textContent;
            const m = folder.match(pattern);
            if (m) {
                const dom = await JSDOM.fromURL(`${tppUrl}${m[1]}`, {});
                const date = moment(m[1], "YYYY-MM-DD");
                const items = dom.window.document.querySelector("pre").children;
                const pattern = /([A-Z1-9]+).pdf/;
                if (moment() >= date) {
                    for (let j = 0; j < items.length; j++) {
                        const file = items[j].textContent;
                        const m = file.match(pattern);
                        const url = `${tppUrl}/${folder}/${file}`;
                        if (m) {
                            const region = m[1];
                            if (files[region]) {
                                files[region].push({ url, date });
                                if (date > files[region].current.date) {
                                    files[region].current = {
                                        url,
                                        date,
                                    };
                                }
                            }
                        }
                    }
                } else {
                    console.log(`skipped ${folder}: in the future`);
                }
            }
        }
    }
    return files;
};

const getIFREnroute = async () => {
    const dom = await JSDOM.fromURL(ifrEnrouteUrl, {});
    let chd = dom.window.document.querySelector("pre").children;
    const files = {};
    for (const i of ifrEnrouteLow) {
        const region = `L${i.toFixed(0).padStart(2, "0")}`;
        files[region] = [];
        files[region].current = { date: moment(0) };
    }
    for (const i of ifrEnrouteHigh) {
        const region = `H${i.toFixed(0).padStart(2, "0")}`;
        files[region] = [];
        files[region].current = { date: moment(0) };
    }

    const pattern = /([0-9]{2}-[0-9]{2}-[0-9]{4})/;
    for (let i = 0; i < chd.length; i++) {
        if (chd[i] instanceof dom.window.HTMLAnchorElement) {
            const folder = chd[i].textContent;
            const m = folder.match(pattern);
            if (m) {
                const dom = await JSDOM.fromURL(`${ifrEnrouteUrl}${m[1]}`, {});
                const date = moment(m[1], "MM-DD-YYYY");
                const items = dom.window.document.querySelector("pre").children;
                const pattern = /ENR_([A-Z0-9]+).zip/;
                if (moment() >= date) {
                    for (let j = 0; j < items.length; j++) {
                        const file = items[j].textContent;
                        const m = file.match(pattern);
                        const url = `${ifrEnrouteUrl}/${folder}/${file}`;
                        if (m) {
                            const region = m[1];
                            const unzip = {};
                            unzip[`ENR_${region}.tif`] = ".tif";
                            if (files[region]) {
                                files[region].push({ url, date });
                                if (date > files[region].current.date) {
                                    files[region].current = {
                                        url,
                                        date,
                                        unzip,
                                    };
                                }
                            }
                        }
                    }
                } else {
                    console.log(`skipped ${folder}: in the future`);
                }
            }
        }
    }
    return files;
};

const getVFR = async () => {
    const secFiles = {};
    for (const i of vfrSectional) {
        const _region = i.replaceAll(" ", "_");
        secFiles[_region] = [];
        secFiles[_region].current = { date: moment(0) };
    }
    const tacFiles = {};
    for (const i of vfrTerminal) {
        const _region = i.replaceAll(" ", "_");
        tacFiles[_region] = [];
        tacFiles[_region].current = { date: moment(0) };
    }
    const dom = await JSDOM.fromURL(`${vfrUrl}`, {});
    let chd = dom.window.document.querySelector("pre").children;
    const pattern = /([0-9]{2}-[0-9]{2}-[0-9]{4})/;
    for (let i = 0; i < chd.length; i++) {
        if (chd[i] instanceof dom.window.HTMLAnchorElement) {
            const folder = chd[i].textContent;
            const m = folder.match(pattern);
            if (m) {
                const date = moment(m[1], "MM-DD-YYYY");
                if (moment() >= date) {
                    for (const region of vfrSectional) {
                        const unzip = {};
                        const _region = region.replaceAll(" ", "_");
                        const url = `${vfrUrl}${m[1]}/sectional-files/${_region}.zip`;
                        unzip[`${_region}_SEC.tif`] = ".tif";
                        secFiles[_region].push({ url, date });
                        if (date > secFiles[_region].current.date) {
                            secFiles[_region].current = {
                                url,
                                date,
                                unzip,
                            };
                        }
                    }
                    for (const region of vfrTerminal) {
                        const unzip = {};
                        const _region = region.replaceAll(" ", "_");
                        const url = `${vfrUrl}${m[1]}/tac-files/${_region}_TAC.zip`;
                        unzip[`${_region}_TAC.tif`] = ".tif";
                        unzip[`${_region}_FLY.tif`] = "-flyway.tif";
                        tacFiles[_region].push({ url, date });
                        if (date > tacFiles[_region].current.date) {
                            tacFiles[_region].current = {
                                url,
                                date,
                                unzip,
                            };
                        }
                    }
                } else {
                    console.log(`skipped ${folder}: in the future`);
                }
            }
        }
    }
    return { secFiles, tacFiles };
};

const vfrCharts = await getVFR();

const res = [
    { prefix: "cs", files: await getChartSupplementDiretory() },
    { prefix: "tpp", files: await getTerminalProcedurePublication() },
    { prefix: "ifr-enroute-low", files: await getIFREnroute() },
    { prefix: "vfr-sectional", files: vfrCharts.secFiles },
    { prefix: "vfr-terminal", files: vfrCharts.tacFiles },
];

const zip_path = `${output}/zips`;
const chart_path = `${output}/charts`;

try {
    await fs.mkdir(zip_path);
    await fs.mkdir(chart_path);
} catch (_) {}

for (let r of res) {
    for (let region of Object.keys(r.files)) {
        const cur = r.files[region].current;
        if (!cur.url) {
            continue;
        }
        const date = cur.date.format("YYYY-MM-DD");
        const dir = `${cur.unzip ? zip_path : chart_path}/${date}`;
        try {
            await fs.mkdir(dir);
        } catch (_) {}
        const file = `${dir}/${r.prefix}-${region.toLowerCase()}.${cur.unzip ? "zip" : "pdf"}`;
        const fileExists = (path) =>
            fs.stat(path).then(
                () => true,
                () => false,
            );
        if (await fileExists(file)) {
            console.log(`file "${file}" already exists`);
        } else {
            console.log(`downloading "${cur.url}"`);
            await fetch(cur.url)
                .then((r) => r.arrayBuffer())
                .then((bytes) => fs.writeFile(file, new Uint8Array(bytes)));
        }
        if (cur.unzip) {
            console.log(`extracting "${file}"`);
            await decompress(file, "./", {
                filter: (f) => cur.unzip[f.path.replaceAll(" ", "_")] != null,
                map: (f) => {
                    f.path = `${chart_path}/${date}/${r.prefix}-${region.toLowerCase()}${cur.unzip[f.path.replaceAll(" ", "_")]}`;
                    return f;
                },
            });
        }
    }
}
