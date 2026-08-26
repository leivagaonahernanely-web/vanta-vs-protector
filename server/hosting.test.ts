import { describe, expect, it, vi } from "vitest";

const { findMock, licenseMock } = vi.hoisted(() => ({ findMock: vi.fn(), licenseMock: vi.fn() }));
vi.mock("./db", () => ({ getHostedScriptBySlug: findMock, claimLicenseHwid: licenseMock }));

import { registerHostingRoutes } from "./hosting";

type Handler = (req: any, res: any) => Promise<void> | void;

function getHandler() {
  let handler: Handler | undefined;
  registerHostingRoutes({ get: (_path: string, next: Handler) => { handler = next; } } as never);
  return handler!;
}

function responseMock() {
  return {
    statusCode: 200,
    body: "",
    type: vi.fn(function (this: any) { return this; }),
    setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    send(value: string) { this.body = value; return this; },
  };
}

const script = { id: 1, slug: "scriptSlug123456789", name: "demo.lua", code: "return true", ffaMode: 1, scriptKey: null };

describe("public hosted scripts", () => {
  it("requires the global trial token for FFA scripts", async () => {
    findMock.mockResolvedValue(script);
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, query: {}, headers: { accept: "*/*" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("No key was provided");
  });

  it("renders the FFA loader with the global trial key without source", async () => {
    findMock.mockResolvedValue(script);
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, query: { key: "trial" }, headers: { accept: "text/html" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("This script can't be viewed in a browser");
    expect(response.body).toContain("script_key = &quot;trial&quot;");
    expect(response.body).toContain("loadstring(game:HttpGet");
    expect(response.body).not.toContain("return true");
  });

  it("requires a valid plan key when FFA is disabled", async () => {
    findMock.mockResolvedValue({ ...script, ffaMode: 0, scriptKey: null });
    licenseMock.mockResolvedValue(undefined);
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, query: {}, headers: { accept: "*/*" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("No key was provided");
  });

  it("serves a protected artifact when the key is active", async () => {
    findMock.mockResolvedValue({ ...script, ffaMode: 0, scriptKey: null });
    licenseMock.mockResolvedValue({ id: 4, status: "active" });
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, query: { key: "86vC3ZULuEQpOImpm5VBB6oLROAQmPLe" }, headers: { accept: "*/*", "x-hwid": "device-a" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("return true");
  });

  it("serves only the FFA artifact to non-browser runtime clients with trial", async () => {
    findMock.mockResolvedValue(script);
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, query: { key: "trial" }, headers: { accept: "*/*" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.body).toBe("return true");
    expect(response.body).not.toContain("loadstring(game:HttpGet");
  });
});
