import fs from 'fs/promises';
import path from 'path';

export function isStrictChildPath(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return Boolean(relative)
        && relative !== '..'
        && !relative.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relative);
}

export async function writeFileAtomic(filePath, data, encoding = 'utf8') {
    const absolutePath = path.resolve(filePath);
    const parentDir = path.dirname(absolutePath);
    const temporaryPath = path.join(
        parentDir,
        `.${path.basename(absolutePath)}.tmp-${process.pid}-${Date.now()}`
    );

    await fs.mkdir(parentDir, { recursive: true });
    try {
        await fs.writeFile(temporaryPath, data, encoding);
        await fs.rename(temporaryPath, absolutePath);
    } finally {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
    }
}

export async function replaceDirectoryAtomically(sourceDir, targetDir) {
    const backupDir = `${targetDir}.previous-${process.pid}-${Date.now()}`;
    let movedExisting = false;
    try {
        try {
            await fs.rename(targetDir, backupDir);
            movedExisting = true;
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        await fs.rename(sourceDir, targetDir);
        if (movedExisting) await fs.rm(backupDir, { recursive: true, force: true });
    } catch (error) {
        if (movedExisting) {
            try {
                await fs.access(targetDir);
            } catch {
                await fs.rename(backupDir, targetDir).catch(() => {});
            }
        }
        throw error;
    }
}
