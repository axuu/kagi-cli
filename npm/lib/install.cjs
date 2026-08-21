#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const https = require("node:https");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(packageRoot, "package.json"));

const binaryBaseName = process.platform === "win32" ? "kagi.exe" : "kagi";
const releaseTag = `v${packageJson.version}`;
const repo = "Microck/kagi-cli";

function detectTarget() {
  const os = process.platform;
  const arch = process.arch;

  if (arch !== "x64" && arch !== "arm64") {
    throw new Error(`unsupported CPU architecture for kagi: ${arch}`);
  }

  if (os === "linux") {
    return `${arch === "x64" ? "x86_64" : "aarch64"}-unknown-linux-gnu`;
  }

  if (os === "darwin") {
    return `${arch === "x64" ? "x86_64" : "aarch64"}-apple-darwin`;
  }

  if (os === "win32") {
    if (arch !== "x64") {
      throw new Error(
        "unsupported Windows architecture for kagi: arm64. Use x86_64 Windows or a GitHub Release asset for another supported platform."
      );
    }

    return "x86_64-pc-windows-msvc";
  }

  throw new Error(`unsupported operating system for kagi: ${os}`);
}

function getBinaryPath() {
  return path.join(packageRoot, "vendor", detectTarget(), binaryBaseName);
}

function getAssetFileName() {
  return `${binaryBaseName.replace(/\.exe$/, "")}-${releaseTag}-${detectTarget()}${process.platform === "win32" ? ".exe" : ""}`;
}

function getAssetUrl() {
  return `https://github.com/${repo}/releases/download/${releaseTag}/${getAssetFileName()}`;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "kagi-cli-installer",
          "Accept": "application/octet-stream",
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          download(response.headers.location, destination).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(
            new Error(
              `failed to download ${url} - HTTP ${response.statusCode ?? "unknown"}`
            )
          );
          return;
        }

        const file = fs.createWriteStream(destination, { mode: 0o755 });
        response.pipe(file);

        file.on("finish", () => {
          file.close(resolve);
        });

        file.on("error", (error) => {
          reject(error);
        });
      }
    );

    request.on("error", reject);
  });
}

async function verifyChecksum(filePath, checksumsPath, assetFileName) {
  const checksums = await fsp.readFile(checksumsPath, "utf8");
  const entry = checksums
    .split(/\r?\n/)
    .find(
      (line) =>
        /^[a-f0-9]{64}  /i.test(line) && line.slice(66) === assetFileName
    );

  if (!entry) {
    throw new Error(`checksum not found for ${assetFileName}`);
  }

  const expected = entry.slice(0, 64).toLowerCase();
  const actual = crypto
    .createHash("sha256")
    .update(await fsp.readFile(filePath))
    .digest("hex");

  if (actual !== expected) {
    throw new Error(`SHA-256 checksum mismatch for ${assetFileName}`);
  }
}

async function ensureInstalled({ quiet }) {
  const binaryPath = getBinaryPath();

  try {
    await fsp.access(binaryPath, fs.constants.X_OK);
    return binaryPath;
  } catch {
    const vendorDir = path.dirname(binaryPath);
    const tempPath = `${binaryPath}.tmp`;
    const checksumsPath = `${tempPath}.checksums`;
    const assetFileName = getAssetFileName();
    const assetUrl = getAssetUrl();
    const checksumsUrl = `https://github.com/${repo}/releases/download/${releaseTag}/kagi-${releaseTag}-checksums.txt`;

    if (!quiet) {
      console.error(`Downloading native kagi binary from ${assetUrl}`);
    }

    await fsp.mkdir(vendorDir, { recursive: true });
    try {
      await download(assetUrl, tempPath);
      await download(checksumsUrl, checksumsPath);
      await verifyChecksum(tempPath, checksumsPath, assetFileName);

      if (process.platform !== "win32") {
        await fsp.chmod(tempPath, 0o755);
      }

      await fsp.rename(tempPath, binaryPath);
      return binaryPath;
    } finally {
      await Promise.all([
        fsp.rm(tempPath, { force: true }),
        fsp.rm(checksumsPath, { force: true }),
      ]);
    }
  }
}

if (require.main === module) {
  ensureInstalled({ quiet: false }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  detectTarget,
  ensureInstalled,
  getAssetFileName,
  getAssetUrl,
  getBinaryPath,
  verifyChecksum,
};
