/**
 * Port of the upstream repository's cong_cu/chuan_hoa.js.
 * Source commit: 1f74a02589082e35f8e19220ff5c1cd5f65920e7.
 */

const TONE_MARKS = new Set(["̀", "́", "̃", "̉", "̣"]);
const VOWELS = new Set("aeiouyăâêôơư");
const Y_TO_I_PREFIXES = ["qu", "h", "k", "l", "m", "t", "s", "v"];
const TONE_CLUSTERS = ["oa", "oe", "uy"];

function removeToneMarks(value: string): string {
  return [...value.normalize("NFD")].filter((character) => !TONE_MARKS.has(character)).join("");
}

function normalizeSyllable(syllable: string): string {
  let plain = removeToneMarks(syllable);
  let decomposed = [...syllable.normalize("NFD")];

  if (plain.length && plain.at(-1) === "y" && [...plain].filter((character) => VOWELS.has(character)).length === 1 && plain.length > 1 && Y_TO_I_PREFIXES.some((prefix) => plain.startsWith(prefix))) {
    decomposed = [...decomposed.join("").replace(/y/g, "i")];
    plain = removeToneMarks(decomposed.join(""));
  }

  for (const cluster of TONE_CLUSTERS) {
    const clusterIndex = plain.indexOf(cluster);
    if (clusterIndex < 0 || clusterIndex + cluster.length !== plain.length) continue;
    const vowelPositions: number[] = [];
    let plainIndex = 0;
    for (let decomposedIndex = 0; decomposedIndex < decomposed.length; decomposedIndex += 1) {
      if (!TONE_MARKS.has(decomposed[decomposedIndex])) {
        if (plainIndex === clusterIndex || plainIndex === clusterIndex + 1) vowelPositions.push(decomposedIndex);
        plainIndex += 1;
      }
    }
    if (vowelPositions.length === 2 && vowelPositions[0] + 1 < decomposed.length && TONE_MARKS.has(decomposed[vowelPositions[0] + 1])) {
      const reordered = [...decomposed];
      const tone = reordered.splice(vowelPositions[0] + 1, 1)[0];
      reordered.splice(vowelPositions[1], 0, tone);
      decomposed = reordered;
    }
    break;
  }

  return decomposed.join("").normalize("NFC");
}

export function normalizeWord(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/gu, " ").split(" ").map(normalizeSyllable).join(" ").toLocaleLowerCase("vi-VN");
}

export function splitWord(input: string): string[] {
  const normalized = normalizeWord(input);
  return normalized ? normalized.split(" ") : [];
}
