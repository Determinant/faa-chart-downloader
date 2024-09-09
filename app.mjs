#!/usr/bin/env node

const csUrl = "https://aeronav.faa.gov/upload_313-d/supplements/";
const tppUrl = "https://aeronav.faa.gov/upload_313-d/terminal/";

import { JSDOM } from "jsdom";
import moment from "moment";
import fs from "node:fs/promises";

const csRegions = ["SW"];
const tppRegions = ["SW1", "SW2", "SW3", "SW4"];

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
                        files[region].current = { url, date: date.format('YYYY-MM-DD') };
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

const res = [
    { prefix: "cs", files: await getChartSupplementDiretory() },
    { prefix: "tpp", files: await getTerminalProcedurePublication() },
];
for (let r of res) {
    for (let region of Object.keys(r.files)) {
        const cur = r.files[region].current;
        const file = `${r.prefix}-${region.toLowerCase()}-${cur.date}.pdf`;
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
        }
    }
}
