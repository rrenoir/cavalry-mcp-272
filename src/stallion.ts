/**
 * Stallion bridge client — sends JavaScript to Cavalry via HTTP POST.
 *
 * Cavalry must have the Stallion script running (Scripts > Stallion).
 * The server listens on 127.0.0.1:8080 by default.
 */

export interface StallionPayload {
  /** Script category: "script" for JS Editor scripts */
  type: "script" | "javaScriptShape" | "skslShader" | "renderSetupExpression";
  /** The JavaScript code to execute */
  code: string;
  /** Optional file path (used for UI scripts) */
  path?: string;
}

export interface StallionConfig {
  host: string;
  port: number;
}

const DEFAULT_CONFIG: StallionConfig = {
  host: "127.0.0.1",
  port: 8080,
};

/**
 * Send a script to Cavalry via Stallion's HTTP bridge.
 * Returns the raw response text from Stallion.
 */
export async function sendToCavalry(
  code: string,
  type: StallionPayload["type"] = "script",
  config: StallionConfig = DEFAULT_CONFIG,
): Promise<string> {
  const url = `http://${config.host}:${config.port}/post`;
  const payload: StallionPayload = { type, code };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Stallion returned ${response.status}: ${await response.text()}`,
    );
  }

  return response.text();
}

/**
 * Check if Stallion is reachable in Cavalry.
 */
export async function pingStallion(
  config: StallionConfig = DEFAULT_CONFIG,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`http://${config.host}:${config.port}/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}
