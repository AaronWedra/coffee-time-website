export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, project: "coffee-time-website" });
    }
    return env.ASSETS.fetch(request);
  }
};