import { Contract, Interface } from "ethers";
import { loadPublicSurface } from "./load-public-surface.mjs";

export async function connectOifAdapter(networkName, runner) {
  const surface = await loadPublicSurface(networkName);
  return new Contract(surface.network.contracts.oifAdapter, surface.abis.oif, runner);
}

export async function readOifMandate(networkName, provider, orderId) {
  const adapter = await connectOifAdapter(networkName, provider);
  const output = await adapter.mandateFor(orderId);
  const outputHash = await adapter.hashOutput(output);
  const fillRecord = await adapter["getFillRecord(bytes32,bytes32)"](orderId, outputHash);
  return { orderId, output, outputHash, fillRecord };
}

export async function encodeOifReservation(networkName, request) {
  const surface = await loadPublicSurface(networkName);
  const iface = new Interface(surface.abis.oif);
  return iface.encodeFunctionData("requestOIFReservation", [
    request.terms,
    request.proof,
    request.amountInRaw,
    request.minimumAmountOutRaw,
    request.destinationRecipient,
    request.validUntil,
  ]);
}

export async function encodeOifFill(networkName, fill) {
  const surface = await loadPublicSurface(networkName);
  const iface = new Interface(surface.abis.oif);
  return iface.encodeFunctionData("fill", [
    fill.orderId,
    fill.output,
    fill.fillDeadline,
    fill.fillerData ?? "0x",
  ]);
}
