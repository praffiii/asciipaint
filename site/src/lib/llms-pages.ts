import { getCollection } from "astro:content";
import type { Page } from "./llms";

export async function pages(): Promise<Page[]> {
  const docs = await getCollection("docs");
  return docs.map((entry) => ({ id: entry.id, title: entry.data.title, description: entry.data.description, body: entry.body ?? "" }));
}
