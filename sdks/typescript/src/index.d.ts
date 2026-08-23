export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface ClientOptions {
  baseUrl?: string;
  discoveryUri?: string;
  expectedFeedSigner?: string;
  fetch?: typeof fetch;
}
export interface RouteQuery { sourceChainId?: number; sourceNetworkId?: string }
export interface VerifyFeedOptions { expectedSigner?: string; nowSeconds?: number; required?: boolean }
export interface FeedVerification {
  valid: boolean; computedHash: string; expectedHash: string;
  recoveredSigner: string | null; declaredSigner: string | null;
  expectedSigner: string | null; expired: boolean;
}
export interface PermitRequest {
  quoteId: string; requestedAmountInRaw: string; standard: string;
  payer?: string; recipient?: string; payerAccountId?: string;
  recipientAccountId?: string; payerLocator?: Json; recipientLocator?: Json;
  idempotencyKey: string;
}
export class NexaSdkError extends Error {
  code: string; details: unknown; serverCode?: string;
}
export function canonicalJson(value: Json): string;
export function computeFeedHash(payload: Json): string;
export function verifyFeed(feed: any, options?: VerifyFeedOptions): FeedVerification;
export function requestPermitMessage(request: PermitRequest): string;
export class NexaV6Client {
  constructor(options?: ClientOptions);
  discover(): Promise<any>;
  getRoutes(query?: RouteQuery): Promise<{ feed: any; routes: any[]; verification: FeedVerification }>;
  getRoute(routeId: string): Promise<any>;
  verifyFeed(feed: any, options?: VerifyFeedOptions): FeedVerification;
  requestPermitMessage(request: PermitRequest): string;
  requestPermit(request: PermitRequest, requestSignature: string): Promise<any>;
  resolveExecution(rpcUrl: string, payload: string): Promise<any>;
  previewExecution(rpcUrl: string, permitEnvelope: any): Promise<any>;
  buildExecutionTx(permitEnvelope: any): any;
  getFillStatus(fillId: string): Promise<any>;
}
