#!/usr/bin/env node

const csUrl = "https://aeronav.faa.gov/upload_313-d/supplements/";
const tppUrl = "https://aeronav.faa.gov/upload_313-d/terminal/";
const ifrEnrouteUrl = "https://aeronav.faa.gov/enroute/";

import { JSDOM } from "jsdom";
import moment from "moment";
import fs from "node:fs/promises";
import decompress from "decompress";
import { waitForDebugger } from "node:inspector";

const csRegions = ["SW"];
const tppRegions = ["SW1", "SW2", "SW3", "SW4"];
const ifrEnrouteLow = [2, 3, 4];
const ifrEnrouteHigh = [];

const getChartSupplementDiretory = async () => {
    const dom = await JSDOM.fromURL(csUrl, {});
    let chd = dom.window.document.querySelector("pre").children;
    const files = {};
    for (let i = 0; i < csRegions.length; i++) {
        files[csRegions[i]] = [];
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
                    if (moment() >= date) {
                        files[region].current = {
                            url,
                            date: date.format("YYYY-MM-DD"),
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
    for (let i = 0; i < tppRegions.length; i++) {
        files[tppRegions[i]] = [];
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
                                files[region].current = {
                                    url,
                                    date: date.format("YYYY-MM-DD"),
                                };
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
        files[`L${i.toFixed(0).padStart(2, "0")}`] = [];
    }
    for (const i of ifrEnrouteHigh) {
        files[`H${i.toFixed(0).padStart(2, "0")}`] = [];
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
                                files[region].current = {
                                    url,
                                    date: date.format("YYYY-MM-DD"),
                                    unzip,
                                };
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

const res = [
    //{ prefix: "cs", files: await getChartSupplementDiretory() },
    //{ prefix: "tpp", files: await getTerminalProcedurePublication() },
    { prefix: "ifr-enroute-low", files: await getIFREnroute() },
];

//console.log(res);
for (let r of res) {
    for (let region of Object.keys(r.files)) {
        const cur = r.files[region].current;
        if (!cur) {
            continue;
        }
        const file = `${r.prefix}-${region.toLowerCase()}-${cur.date}.${cur.unzip ? "zip" : "pdf"}`;
        const fileExists = (path) =>
            fs.stat(path).then(
                () => true,
                () => false,
            );
        if (await fileExists(file)) {
            console.log(`file "${file}" already exists`);
        } else {
            console.log(`downloading "${file}"`);
            await fetch(cur.url)
                .then((r) => r.arrayBuffer())
                .then((bytes) => fs.writeFile(file, new Uint8Array(bytes)));
            if (cur.unzip) {
                await decompress(file, "./", {
                    filter: (f) => cur.unzip[f.path] != null,
                    map: (f) => {
                        f.path = `${r.prefix}-${region.toLowerCase()}-${cur.date}${cur.unzip[f.path]}`;
                        return f;
                    },
                });
            }
        }
    }
}
