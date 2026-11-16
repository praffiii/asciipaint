import type { APIRoute } from "astro";
import { full } from "../lib/llms";
import { pages } from "../lib/llms-pages";

export const GET: APIRoute = async ({ site }) =>
  new Response(full(await pages(), site!.origin), { headers: { "content-type": "text/plain; charset=utf-8" } });
