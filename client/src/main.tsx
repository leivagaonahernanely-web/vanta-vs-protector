import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { shouldRetryQuery } from "./lib/query-retry";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 2500),
      refetchOnReconnect: true,
    },
  },
});

// Sin redirección automática: la pantalla de acceso se muestra según el estado de sesión.
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") console.error("[API Query Error]", event.query.state.error);
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") console.error("[API Mutation Error]", event.mutation.state.error);
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
