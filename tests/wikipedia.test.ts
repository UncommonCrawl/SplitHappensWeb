import { describe, expect, it } from "vitest";
import { wikipediaArticleURL } from "../src/wikipedia";

describe("Wikipedia article URLs", () => {
  it.each([
    ["Wayne Gretzky", "https://en.wikipedia.org/wiki/Wayne_Gretzky"],
    ["TLC (group)", "https://en.wikipedia.org/wiki/TLC_(group)"],
    ["Ocean's Eleven", "https://en.wikipedia.org/wiki/Ocean's_Eleven"],
    ["Run-DMC", "https://en.wikipedia.org/wiki/Run-DMC"],
    ["AC/DC", "https://en.wikipedia.org/wiki/AC/DC"],
    ["Pelé", "https://en.wikipedia.org/wiki/Pel%C3%A9"],
    ["Shōnen manga", "https://en.wikipedia.org/wiki/Sh%C5%8Dnen_manga"],
  ])("builds the canonical path for %s", (title, expected) => {
    expect(wikipediaArticleURL(title)).toBe(expected);
  });
});
