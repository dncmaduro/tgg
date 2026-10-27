import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeWord } from "@/modules/game/implementations/word-chain/normalization";

const DATA_DIRECTORY = path.join(process.cwd(), "src/modules/game/implementations/word-chain/data");

function readWordList(fileName: string): ReadonlySet<string> {
  const file = readFileSync(path.join(DATA_DIRECTORY, fileName), "utf8");
  return new Set(file.split(/\r?\n/u).map((line) => normalizeWord(line)).filter(Boolean));
}

let dictionary: { playerWords: ReadonlySet<string>; blockedWords: ReadonlySet<string> } | undefined;

export function getWordDictionary(): { playerWords: ReadonlySet<string>; blockedWords: ReadonlySet<string> } {
  dictionary ??= {
    playerWords: readWordList("nguoi_choi.txt"),
    blockedWords: readWordList("tu_cam.txt"),
  };
  return dictionary;
}
