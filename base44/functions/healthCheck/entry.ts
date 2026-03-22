// healthCheck — minimal Base44 function for connectivity testing
Deno.serve(async (_req) => {
  return new Response(
    JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
