import { describe, expect, it, vi } from "vitest";

const findMock = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getHostedScriptBySlug: findMock }));

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

const script = { slug: "scriptSlug123456789", name: "demo.lua", code: "return true" };

describe("public hosted scripts", () => {
  it("renders a branded loader page without source for browsers", async () => {
    findMock.mockResolvedValue(script);
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, headers: { accept: "text/html" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("This script can't be viewed in a browser");
    expect(response.body).toContain("loadstring(game:HttpGet");
    expect(response.body).not.toContain("return true");
  });

  it("serves only the protected artifact to non-browser runtime clients", async () => {
    findMock.mockResolvedValue(script);
    const response = responseMock();
    await getHandler()({ params: { slug: script.slug }, headers: { accept: "*/*" }, protocol: "https", get: () => "vanta.test" }, response);
    expect(response.body).toBe("return true");
    expect(response.body).not.toContain("loadstring(game:HttpGet");
  });
});
