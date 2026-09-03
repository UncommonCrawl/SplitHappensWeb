import { describe, expect, it } from "vitest";
import { evaluateCriterion } from "../src/criteria";

describe("criteria parser", () => {
  it("handles fixed, wildcard, multiple-row, and negated row rules", () => {
    expect(evaluateCriterion("2_STARTS_C", ["CAT", "DOG"]).satisfied).toBe(false);
    expect(evaluateCriterion("*_ENDS_G", ["CAT", "DOG"]).satisfied).toBe(true);
    expect(evaluateCriterion("2X_CONTAINS_A", ["CAT", "BAR", "DOG"]).satisfied).toBe(true);
    expect(evaluateCriterion("*_ENDS_S_NONE", ["CAT", "DOG"]).satisfied).toBe(true);
  });

  it("handles double letters, repeated text, and include rules", () => {
    expect(evaluateCriterion("*_DOUBLE_*", ["BELL", "CAT"]).satisfied).toBe(true);
    expect(evaluateCriterion("1_CONTAINS_2A", ["BAA", "CAT"]).satisfied).toBe(true);
    expect(evaluateCriterion("INCLUDES_CAT", ["DOG", "CAT"]).satisfied).toBe(true);
  });

  it("formats Silver criteria with spelled-out numbers and MUST", () => {
    expect(evaluateCriterion("4_STARTS_A", []).label).toBe("ROW FOUR MUST START WITH 'A'");
    expect(evaluateCriterion("2X_CONTAINS_A", []).label).toBe("TWO ROWS MUST CONTAIN 'A'");
    expect(evaluateCriterion("*_ENDS_S_NONE", []).label).toBe("ALL ROWS MUST NOT END IN 'S'");
    expect(evaluateCriterion("INCLUDES_CAT", []).label).toBe("ONE WORD MUST BE 'CAT'");
  });
});
