const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { verifyChecksum } = require("../lib/install.cjs");

test("rejects a binary that does not match its release checksum", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kagi-install-test-"));
  const binary = path.join(dir, "kagi-test");
  const checksums = path.join(dir, "checksums.txt");

  try {
    const contents = Buffer.from("trusted binary");
    const hash = crypto.createHash("sha256").update(contents).digest("hex");
    await fs.writeFile(binary, contents);
    await fs.writeFile(checksums, `${hash}  kagi-test\n`);

    await verifyChecksum(binary, checksums, "kagi-test");
    await fs.writeFile(binary, "tampered binary");
    await assert.rejects(
      verifyChecksum(binary, checksums, "kagi-test"),
      /SHA-256 checksum mismatch/
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
