import { chmod, lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nextDir = path.resolve(__dirname, "../.next");

const makeWritable = async (targetPath) => {
  try {
    const stats = await lstat(targetPath);

    if (stats.isDirectory()) {
      const entries = await readdir(targetPath);
      await Promise.all(entries.map((entry) => makeWritable(path.join(targetPath, entry))));
    }

    await chmod(targetPath, 0o666).catch(() => {});
  } catch {
    // Ignore entries that disappear while cleaning.
  }
};

const removeWithRetries = async (targetPath, attempts = 5) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await rm(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200
      });
      return;
    } catch (error) {
      if (index === attempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
};

try {
  await makeWritable(nextDir);
  await removeWithRetries(nextDir);
} catch (error) {
  console.warn("Unable to clean .next before startup:", error.message);
}
