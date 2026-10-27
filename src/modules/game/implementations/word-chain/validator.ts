import { getWordDictionary } from "@/modules/game/implementations/word-chain/dictionary";
import { normalizeWord, splitWord } from "@/modules/game/implementations/word-chain/normalization";

export type WordValidationCode = "VALID" | "INVALID_FORMAT" | "INVALID_CONNECTION" | "ALREADY_USED" | "BLOCKED_WORD" | "NOT_IN_DICTIONARY";

export type WordValidationResult =
  | { code: "VALID"; word: string; firstSyllable: string; lastSyllable: string; canChallenge: false }
  | { code: Exclude<WordValidationCode, "VALID">; word: string; message: string; canChallenge: boolean };

export type WordValidationContext = {
  requiredSyllable: string | null;
  usedWords: ReadonlySet<string>;
  acceptedChallengeWords?: ReadonlySet<string>;
};

const WORD_PATTERN = /^\p{L}+(?: \p{L}+)+$/u;

export function validateWord(input: string, context: WordValidationContext): WordValidationResult {
  const word = normalizeWord(input);
  if (word.length < 3 || word.length > 80 || !WORD_PATTERN.test(word)) return invalid("INVALID_FORMAT", word, "Nhập đúng một từ ghép gồm 2 tiếng.", false);

  const syllables = splitWord(word);
  if (syllables.length !== 2 || syllables.some((syllable) => syllable.length < 1)) return invalid("INVALID_FORMAT", word, "Nhập đúng một từ ghép gồm 2 tiếng.", false);
  if (context.requiredSyllable && syllables[0] !== normalizeWord(context.requiredSyllable)) return invalid("INVALID_CONNECTION", word, `Từ cần bắt đầu bằng "${context.requiredSyllable}".`, false);
  if (context.usedWords.has(word)) return invalid("ALREADY_USED", word, "Từ này đã được dùng.", false);

  const dictionary = getWordDictionary();
  if (dictionary.blockedWords.has(word)) return invalid("BLOCKED_WORD", word, "Từ này không được phép.", false);
  if (context.acceptedChallengeWords?.has(word) || dictionary.playerWords.has(word)) return { code: "VALID", word, firstSyllable: syllables[0], lastSyllable: syllables[1], canChallenge: false };
  return invalid("NOT_IN_DICTIONARY", word, "Không có trong từ điển.", true);
}

function invalid(code: Exclude<WordValidationCode, "VALID">, word: string, message: string, canChallenge: boolean): WordValidationResult {
  return { code, word, message, canChallenge };
}
