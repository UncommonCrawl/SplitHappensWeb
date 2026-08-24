export interface CriterionResult {
  label: string;
  satisfied: boolean;
}

interface RowQualifier {
  rowNumber: number | null;
  requiredRows: number;
  value: string | null;
  requiredInstances: number;
  negated: boolean;
}

function rowLabel(qualifier: RowQualifier): string {
  if (qualifier.requiredRows > 1) return `${qualifier.requiredRows} ROWS`;
  return qualifier.rowNumber === null ? "ANY ROW" : `ROW ${qualifier.rowNumber}`;
}

function parseQualifier(parts: string[]): RowQualifier | null {
  let negated = false;
  if (parts.at(-1) === "NONE") {
    negated = true;
    parts = parts.slice(0, -1);
  }
  const rowToken = parts[0];
  let rowNumber: number | null = null;
  let requiredRows = 1;
  if (rowToken === "*" || rowToken === "ANY") rowNumber = null;
  else if (/^\d+X$/.test(rowToken)) requiredRows = Number(rowToken.slice(0, -1));
  else if (/^\d+$/.test(rowToken)) rowNumber = Number(rowToken);
  else return null;

  let value = parts.slice(1).join("_") || null;
  let requiredInstances = 1;
  if (value && /^\d/.test(value)) {
    const match = /^(\d+)(.+)$/.exec(value);
    if (match) {
      requiredInstances = Number(match[1]);
      value = match[2];
    }
  }
  if (value === "*" || value === "ANY") value = null;
  return { rowNumber, requiredRows, value, requiredInstances, negated };
}

function occurrenceCount(word: string, value: string): number {
  let count = 0;
  let index = 0;
  while (index < word.length) {
    const found = word.indexOf(value, index);
    if (found < 0) break;
    count += 1;
    index = found + value.length;
  }
  return count;
}

export function evaluateCriterion(raw: string | null, rowWords: Array<string | null>): CriterionResult {
  if (!raw) return { label: "BONUS RULE", satisfied: false };
  const normalized = raw.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "").trim().toUpperCase();
  if (normalized.startsWith("INCLUDES_") || normalized.startsWith("INCLUDE_")) {
    const value = normalized.replace(/^INCLUDES?_/, "");
    return { label: `ONE WORD IS '${value}'`, satisfied: rowWords.includes(value) };
  }
  const parts = normalized.split("_");
  let operationIndex = 1;
  if (["DOUBLE", "STARTS", "START", "ENDS", "END", "CONTAINS"].includes(parts[0])) operationIndex = 0;
  const operation = parts[operationIndex];
  const qualifierParts = operationIndex === 0 ? parts.slice(1) : [parts[0], ...parts.slice(2)];
  const qualifier = parseQualifier(qualifierParts);
  if (!qualifier) return { label: raw, satisfied: false };
  const candidates = qualifier.rowNumber === null
    ? rowWords
    : [rowWords[qualifier.rowNumber - 1] ?? null];
  const predicate = (word: string): boolean => {
    const value = qualifier.value;
    if (operation === "DOUBLE") {
      return [...word].some((letter, index) => letter === word[index + 1] && (!value || letter === value));
    }
    if (!value) return word.length > 0;
    const repeated = value.repeat(qualifier.requiredInstances);
    if (operation === "STARTS" || operation === "START") return word.startsWith(repeated);
    if (operation === "ENDS" || operation === "END") return word.endsWith(repeated);
    return occurrenceCount(word, value) >= qualifier.requiredInstances;
  };
  const matches = candidates.filter((word): word is string => Boolean(word)).filter(predicate).length;
  const satisfied = qualifier.negated ? matches === 0 : matches >= qualifier.requiredRows;
  const valueLabel = qualifier.value ?? "LETTER";
  const row = rowLabel(qualifier);
  const verb = operation === "DOUBLE" ? `HAS DOUBLE '${valueLabel}'`
    : operation === "STARTS" || operation === "START" ? `STARTS WITH '${valueLabel}'`
      : operation === "ENDS" || operation === "END" ? `ENDS IN '${valueLabel}'`
        : `CONTAINS '${valueLabel}'`;
  let label = `${row} ${verb}`.replace(" ROWS HAS ", " ROWS HAVE ").replace(" ROWS STARTS ", " ROWS START ").replace(" ROWS ENDS ", " ROWS END ").replace(" ROWS CONTAINS ", " ROWS CONTAIN ");
  if (qualifier.negated) label = label.replace("ANY ROW", "NO ROW").replace(" HAS ", " MUST NOT HAVE ").replace(" STARTS ", " MUST NOT START ").replace(" ENDS ", " MUST NOT END ").replace(" CONTAINS ", " MUST NOT CONTAIN ");
  return { label, satisfied };
}
