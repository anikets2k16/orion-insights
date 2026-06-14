import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./lib/attach-supabase-auth";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error";
    const isServerFnRequest =
      typeof Request !== "undefined" &&
      arguments[0] != null &&
      typeof arguments[0] === "object" &&
      "request" in arguments[0] &&
      arguments[0].request instanceof Request &&
      arguments[0].request.url.includes("/_serverFn/");

    console.error(error);

    if (isServerFnRequest) {
      return Response.json({ error: message }, { status: 500 });
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
