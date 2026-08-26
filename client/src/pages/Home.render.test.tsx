import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Owner", email: "owner@example.com", discordUsername: "Protectorscripts" },
    loading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));
vi.mock("@/components/ui/switch", () => ({ Switch: ({ checked }: { checked?: boolean }) => <input type="checkbox" checked={checked} readOnly /> }));

const queryResult = (data: unknown = []) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
const mutationResult = () => ({ mutate: vi.fn(), isPending: false });
const trpcProxy = new Proxy({}, {
  get: () => new Proxy({}, {
    get: () => new Proxy({}, {
      get: (target, key) => key === "useQuery" ? (input?: unknown) => {
        if (input && typeof input === "object" && "id" in input) return queryResult({ code: "print('private')" });
        return queryResult();
      } : mutationResult,
    }),
  }),
});
vi.mock("@/lib/trpc", () => ({ trpc: trpcProxy }));

import Home from "./Home";

describe("Home authenticated dashboard render", () => {
  it("renders the informative Overview with one navigation entry per destination and online bot status", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Workspace / Overview");
    expect(html).toContain("Vanta.vs Protector");
    expect(html).toContain("BOT ONLINE · Protectorscripts");
    expect((html.match(/Generate \/ Manage/g) ?? []).length).toBe(1);
    expect((html.match(/Create New Panel/g) ?? []).length).toBe(1);
    expect((html.match(/Manage Panels/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Coming Soon");
  });
});
