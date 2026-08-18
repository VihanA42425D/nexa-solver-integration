import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
}

export function isActiveV6Bundle(bundle) {
  return bundle?.deploymentVersion === 6
    && bundle?.releaseId
    && bundle?.deploymentStatus !== "AWAITING_POST_DEPLOY_EXPORT"
    && bundle?.activationRequired !== true
    && bundle?.contracts
    && Object.keys(bundle.contracts).length > 0
    && bundle?.networks
    && Object.keys(bundle.networks).length > 0;
}

export async function loadPublicSurface(networkName = null, options = {}) {
  const [manifest, integration, standards, events] = await Promise.all([
    readJson("manifest.json"),
    readJson("nexa-mainnet-v6.json"),
    readJson("standards/standard-ids.json"),
    readJson("events/events.json"),
  ]);
  const active = isActiveV6Bundle(integration);
  if (options.requireActive !== false && !active) {
    throw new Error("NEXA_V6_PUBLIC_BUNDLE_NOT_ACTIVATED");
  }
  const network = networkName == null ? null : integration.networks?.[networkName] ?? null;
  if (networkName != null && active && !network) {
    throw new Error(`Unsupported Nexa network: ${networkName}`);
  }
  return Object.freeze({ manifest, integration, standards, events, active, network });
}
