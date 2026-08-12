import fs from 'fs/promises';
import path from 'path';
import {
    DEFAULT_TITLE,
    DEFAULT_CHAPTER,
    DEFAULT_COMBINED_PATH,
    DEFAULT_FAR_PATH,
    DEFAULT_HTML_PATH,
    DEFAULT_XSL_PATH,
    parseCliArgs,
    validateCliArgs,
    parseSourceType,
    parsePositiveInteger,
    parseYear,
    parseVolumes,
    parseDate
} from './lib/config.ts';
import {
    resolveLatestDateForTitle,
    loadEcfrSourceXml,
    loadAnnualSourceXml
} from './lib/sources.ts';
import {
    filterByVolumes,
    filterByKeepParts,
    convertEcfrToGovInfoLikeXml,
    filterFarXmlByKeepParts,
    resolveAnnualDisplayDate
} from './lib/xml-transform.ts';
import { generateSplitPartSite } from './lib/site-generator.ts';
import { isStrictChildPath, writeFileAtomic } from './lib/fs-utils.ts';

async function main() {
    const args = parseCliArgs(process.argv.slice(2));
    validateCliArgs(args);

    if (args.flags.has('--help') || args.flags.has('-h')) {
        console.log('Usage: node --import=tsx build-far.ts [--source=ecfr|annual] [--date=YYYY-MM-DD] [--year=YYYY]');
        console.log('       [--vols=1,2,3] [--title=14] [--chapter=I]');
        console.log('       [--source-xml=chapter.xml] [--combined=dist/far/combined-ecfr.xml] [--far=dist/far/far-ecfr.xml] [--html=dist/far/index.html] [--xsl=cfr-ecfr.xsl]');
        console.log('       [--parts-dir=dist/far/far-parts]');
        console.log('Outputs: dist/far/combined XML, filtered FAR XML, and modern HTML site.');
        console.log('Build mode: split shell + part pages with offline PWA caching.');
        console.log('Source mode: --source=ecfr (default) or --source=annual (--year required for fetch).');
        return;
    }

    const sourceType = parseSourceType(args['--source']);
    const title = parsePositiveInteger(args['--title'] || DEFAULT_TITLE, '--title');
    const chapter = args['--chapter'] || DEFAULT_CHAPTER;
    const year = parseYear(args['--year']);
    const volumeSet = parseVolumes(args['--vols']);
    const combinedPath = args['--combined'] || DEFAULT_COMBINED_PATH;
    const farPath = args['--far'] || DEFAULT_FAR_PATH;
    const htmlPath = args['--html'] || DEFAULT_HTML_PATH;
    const xslPath = args['--xsl'] || DEFAULT_XSL_PATH;
    const sourceXmlPath = args['--source-xml'];
    const partsDirArg = args['--parts-dir'];
    const explicitDate = parseDate(args['--date']);

    if (partsDirArg) {
        const outputDir = path.dirname(path.resolve(htmlPath));
        const configuredPartsDir = path.resolve(partsDirArg);
        if (!isStrictChildPath(outputDir, configuredPartsDir)) {
            throw new Error(`--parts-dir must be a child directory of the HTML output directory: ${outputDir}`);
        }
    }

    await Promise.all([
        fs.mkdir(path.dirname(path.resolve(combinedPath)), { recursive: true }),
        fs.mkdir(path.dirname(path.resolve(farPath)), { recursive: true }),
        fs.mkdir(path.dirname(path.resolve(htmlPath)), { recursive: true })
    ]);

    let combinedXml;
    let farXml;
    let date = explicitDate || '';

    if (sourceType === 'ecfr') {
        if (!date) {
            if (sourceXmlPath) {
                // A local source is intentionally offline-safe. It may not carry
                // the eCFR API's publication date, so do not make a network call
                // merely to decorate the generated UI.
                date = 'local source';
            } else {
                date = await resolveLatestDateForTitle(title);
            }
        }

        console.log(`📅 eCFR date: ${date}`);
        console.log(`📚 eCFR Title ${title}, Chapter ${chapter}, Volumes ${Array.from(volumeSet).join(',')}`);

        const chapterXml = await loadEcfrSourceXml({ sourceXmlPath, date, title, chapter });
        combinedXml = filterByVolumes(chapterXml, volumeSet);
        const filteredEcfrXml = filterByKeepParts(combinedXml);
        farXml = convertEcfrToGovInfoLikeXml(filteredEcfrXml, {
            titleNumber: title,
            date,
            chapterCode: chapter,
            volumeSet
        });
    } else {
        console.log(`📚 Annual CFR Title ${title}, Chapter ${chapter}, Volumes ${Array.from(volumeSet).join(',')}`);
        if (year) {
            console.log(`📆 Annual CFR year: ${year}`);
        }

        combinedXml = await loadAnnualSourceXml({
            sourceXmlPath,
            year,
            title,
            chapter,
            volumeSet
        });
        farXml = filterFarXmlByKeepParts(combinedXml);
        date = resolveAnnualDisplayDate({
            explicitDate,
            year,
            annualCombinedXml: combinedXml
        });
        console.log(`📅 Annual CFR date: ${date}`);
    }

    const sourceDescription = sourceType === 'annual'
        ? `Annual CFR${year ? ` ${year}` : ''}${date && date !== 'unknown' ? `, dated ${date}` : ', edition date not specified'}`
        : date && date !== 'local source'
            ? `eCFR snapshot dated ${date}`
            : 'eCFR source XML (snapshot date not specified)';
    const scopeDescription = `Volumes ${Array.from(volumeSet).join(', ')}`;

    await writeFileAtomic(combinedPath, combinedXml, 'utf8');
    console.log(`✅ ${combinedPath} written`);

    await writeFileAtomic(farPath, farXml, 'utf8');
    console.log(`✅ ${farPath} written`);

    const splitOut = await generateSplitPartSite({
        farXml,
        htmlPath,
        xslPath,
        title,
        chapter,
        sourceDescription,
        scopeDescription,
        partsDirArg
    });
    console.log(`✅ ${htmlPath} written (split-by-part shell)`);
    console.log(`✅ ${splitOut.partCount} part pages written in ${splitOut.partsDirName}/`);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exitCode = 1;
});
