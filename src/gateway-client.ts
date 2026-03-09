/**
 * gateway-client.ts
 *
 * HTTP client for calling Spraay x402 Gateway endpoints.
 * Supports x402 micropayments via x402-fetch + viem wallet.
 * Falls back to plain HTTP for free endpoints if no x402 key.
 */

import { OFFERING_MAP, type JobOffering } from "./offerings.js";

export interface GatewayResponse {
  success: boolean;
  data?: any;
  error?: string;
  latencyMs: number;
  gatewayCost: string;
  endpoint: string;
}

export class SpraayGatewayClient {
  private baseUrl: string;
  private walletPrivateKey: string;
  private fetchWithPay: typeof fetch | null = null;

  constructor(baseUrl: string, walletPrivateKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.walletPrivateKey = walletPrivateKey;
  }

  /**
   * Initialize the x402 payment-enabled fetch client.
   * Uses x402-fetch which wraps native fetch with automatic 402 handling.
   */
  async init(): Promise<void> {
    if (!this.walletPrivateKey) {
      console.log("[gateway] No X402_WALLET_PRIVATE_KEY — free endpoints only");
      return;
    }

    try {
      const { wrapFetchWithPayment } = await import("x402-fetch");
      const { createWalletClient, http } = await import("viem");
      const { privateKeyToAccount } = await import("viem/accounts");
      const { base } = await import("viem/chains");

      const account = privateKeyToAccount(
        this.walletPrivateKey.startsWith("0x")
          ? (this.walletPrivateKey as `0x${string}`)
          : (`0x${this.walletPrivateKey}` as `0x${string}`),
      );
      const walletClient = createWalletClient({
        account,
        transport: http(),
        chain: base,
      });

      this.fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any);
      console.log(`[gateway] x402 client initialized (${account.address.slice(0, 8)}...)`);
    } catch (err: any) {
      console.warn(`[gateway] x402-fetch init failed: ${err.message}`);
      console.warn("[gateway] Falling back to plain HTTP (free endpoints only)");
    }
  }

  /**
   * Execute a job by offering ID (used by keyword router fallback).
   */
  async executeByOffering(offeringId: string, params: Record<string, any>): Promise<GatewayResponse> {
    const offering = OFFERING_MAP.get(offeringId);
    if (!offering) {
      return { success: false, error: `Unknown offering: ${offeringId}`, latencyMs: 0, gatewayCost: "0", endpoint: "unknown" };
    }
    return this.callEndpoint(offering.gatewayEndpoint, offering.gatewayMethod, params, offering.gatewayCost);
  }

  /**
   * Execute a raw gateway call by path + method (used by Claude engine).
   */
  async executeRaw(
    path: string,
    method: "GET" | "POST",
    params: Record<string, any>,
    costUsd: string = "0"
  ): Promise<GatewayResponse> {
    return this.callEndpoint(path, method, params, costUsd);
  }

  /**
   * Core HTTP call with x402 payment support.
   */
  private async callEndpoint(
    endpoint: string,
    method: "GET" | "POST",
    params: Record<string, any>,
    gatewayCost: string
  ): Promise<GatewayResponse> {
    const start = Date.now();
    try {
      let url = `${this.baseUrl}${endpoint}`;

      if (method === "GET") {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) qs.set(k, String(v));
        }
        const qsStr = qs.toString();
        if (qsStr) url += `?${qsStr}`;
      }

      const doFetch = this.fetchWithPay || fetch;
      const fetchOpts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (method === "POST") {
        fetchOpts.body = JSON.stringify(params);
      }

      console.log(`[gateway] ${this.fetchWithPay ? "x402" : "HTTP"} ${method} ${url}`);
      const response = await doFetch(url, fetchOpts);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        if (response.status === 402) {
          return {
            success: false,
            error: `402 Payment Required — x402 client not initialized or insufficient funds. Set X402_WALLET_PRIVATE_KEY.`,
            latencyMs, gatewayCost, endpoint,
          };
        }
        return {
          success: false,
          error: `Gateway ${response.status}: ${errorText.slice(0, 200)}`,
          latencyMs, gatewayCost, endpoint,
        };
      }

      const data = await response.json();
      return { success: true, data, latencyMs, gatewayCost, endpoint };
    } catch (err: any) {
      return {
        success: false,
        error: `Gateway error: ${err.message}`,
        latencyMs: Date.now() - start,
        gatewayCost: "0",
        endpoint,
      };
    }
  }

  /**
   * Health check using the FREE /api/v1/gpu/models endpoint.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/gpu/models`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
