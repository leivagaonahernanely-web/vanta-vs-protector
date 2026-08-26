// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Owner", email: "owner@example.com", role: "admin", isOwner: true, discordUsername: "Protectorscripts" },
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

const { pricesMutate, updatesMutate, trpcProxy } = vi.hoisted(() => {
  const pricesMutate = vi.fn();
  const updatesMutate = vi.fn();
  const queryResult = (data: unknown = []) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
  const mutationResult = () => ({ mutate: vi.fn(), isPending: false });
  const makeProxy = (path: string[] = []): object => new Proxy({}, {
    get: (_target, key: string | symbol) => {
      const name = String(key);
      if (name === "useQuery") return () => path.join(".") === "discord.listPanels" ? queryResult([{ id: 1, name: "Panel principal", channelId: "123456789012345678" }]) : queryResult();
      if (name === "useMutation") {
        if (path.join(".") === "discord.publishPrices") return () => ({ mutate: pricesMutate, isPending: false });
        if (path.join(".") === "discord.publishUpdates") return () => ({ mutate: updatesMutate, isPending: false });
        return mutationResult;
      }
      return makeProxy([...path, name]);
    },
  });
  return { pricesMutate, updatesMutate, trpcProxy: makeProxy() };
});
vi.mock("@/lib/trpc", () => ({ trpc: trpcProxy }));

import Home from "./Home";

afterEach(() => {
  cleanup();
  pricesMutate.mockClear();
  updatesMutate.mockClear();
});

describe("Home authenticated dashboard render", () => {
  it("renders the Prices editor and submits its structured payload through tRPC", () => {
    render(<Home initialSection="Prices" />);
    fireEvent.change(screen.getByPlaceholderText("Nombre de tu script o marca"), { target: { value: "Vanta.vs APP" } });
    fireEvent.change(screen.getAllByPlaceholderText("Ej. Duels Script")[0], { target: { value: "Duels Script" } });
    fireEvent.change(screen.getAllByPlaceholderText("Una línea por plan o método de pago...")[0], { target: { value: "$7 USD" } });
    fireEvent.change(screen.getByLabelText("Panel existente para publicar"), { target: { value: "123456789012345678" } });
    fireEvent.click(screen.getByRole("button", { name: /Publicar Prices/i }));
    expect(pricesMutate).toHaveBeenCalledWith(expect.objectContaining({ title: "Vanta.vs APP", channelId: "123456789012345678" }));
    expect(pricesMutate.mock.calls[0][0].description).toContain("**Duels Script**\n$7 USD");
    expect(pricesMutate.mock.calls[0][0].description).not.toContain("Premium Plan");
  });

  it("renders the Updates editor and submits its title and content through tRPC", () => {
    render(<Home initialSection="Updates" />);
    fireEvent.change(screen.getByPlaceholderText("Ej. Nueva versión disponible"), { target: { value: "Nueva versión" } });
    fireEvent.change(screen.getByPlaceholderText("Escribe los cambios, correcciones y avisos importantes..."), { target: { value: "Correcciones y mejoras." } });
    fireEvent.change(screen.getByLabelText("Panel existente para publicar"), { target: { value: "123456789012345678" } });
    fireEvent.click(screen.getByRole("button", { name: /Publicar actualización/i }));
    expect(updatesMutate).toHaveBeenCalledWith({ title: "Nueva versión", description: "Correcciones y mejoras.", channelId: "123456789012345678" });
  });

  it("renders the informative Overview with one navigation entry per destination and bot status", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Workspace / Overview");
    expect(html).toContain("Vanta.vs Protector");
    expect(html).toContain("BOT OFFLINE");
    expect((html.match(/Generate \/ Manage/g) ?? []).length).toBe(1);
    expect((html.match(/Create New Panel/g) ?? []).length).toBe(1);
    expect((html.match(/Manage Panels/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Coming Soon");
    expect(html).not.toContain("Banta lagger");
    expect(html).not.toContain("Vanta lagger");
    expect(html).toContain("Activar sonidos");
  });
});
