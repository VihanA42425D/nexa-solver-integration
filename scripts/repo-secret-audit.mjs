import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const excludedDirectories = new Set([".git", "node_modules"]);

const secretRules = [
  {
    name: "PEM private key",
    pattern: /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/g,
  },
  {
    name: "GitHub access token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    name: "AWS access key ID",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "Slack access token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    name: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    name: "hex private key assignment",
    pattern: /\b(?:PRIVATE[_-]?KEY|SIGNER[_-]?KEY)\b["']?\s*[:=]\s*["']?(?:0x)?[a-f0-9]{64}\b/gi,
  },
  {
    name: "sensitive credential assignment",
    pattern: /\b(?:PRIVATE[_-]?KEY|SIGNER[_-]?KEY|MNEMONIC|PASSWORD|CLIENT[_-]?SECRET|API[_-]?SECRET|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN)\b["']?\s*[:=]\s*["']?([^"'\s,}#]{8,})/gi,
    capture: 1,
  },
];

const placeholderValues = new Set([
  "changeme",
  "example",
  "not-a-secret",
  "placeholder",
  "redacted",
  "your-secret-here",
]);

const isPlaceholder = (value) => {
  const normalized = value.trim().toLowerCase();
  return placeholderValues.has(normalized)
    || normalized.startsWith("${")
    || normalized.startsWith("process.env")
    || normalized.startsWith("$env:")
    || /^[x*]+$/.test(normalized);
};

const listRepositoryFiles = async (directory, root, files = []) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        "Symbolic links are not allowed in the public repository: "
          + relative(root, absolutePath),
      );
    }
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    if (entry.isDirectory()) {
      await listRepositoryFiles(absolutePath, root, files);
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
};

export const auditRepositoryForSecrets = async (repositoryRoot) => {
  const root = resolve(repositoryRoot);
  const files = await listRepositoryFiles(root, root);
  for (const absolutePath of files) {
    const source = await readFile(absolutePath, "utf8");
    for (const rule of secretRules) {
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      for (const match of source.matchAll(pattern)) {
        if (rule.capture && isPlaceholder(match[rule.capture])) continue;
        const file = relative(root, absolutePath).replaceAll("\\", "/");
        throw new Error("Potential " + rule.name + " detected in " + file);
      }
    }
  }
  return files.length;
};
