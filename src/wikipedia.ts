export function wikipediaArticleURL(articleTitle: string): string {
  const path = articleTitle
    .replaceAll(" ", "_")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://en.wikipedia.org/wiki/${path}`;
}
