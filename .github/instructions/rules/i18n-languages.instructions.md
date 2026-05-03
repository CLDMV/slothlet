---
applyTo: "src/lib/i18n/languages/**"
---

# i18n Language Files — Translation Rules

All files in `src/lib/i18n/languages/` must contain **actual translations** of every message into the target language. Copying English strings into other language files is not acceptable.

---

## Language File Inventory

| File         | Language             | Locale                                                                                       |
| ------------ | -------------------- | -------------------------------------------------------------------------------------------- |
| `en-us.json` | English (US)         | Reference — all other files must translate from this                                         |
| `en-gb.json` | English (GB)         | British English spellings and idioms                                                         |
| `de-de.json` | German               | Translate fully into German                                                                  |
| `es-es.json` | Spanish (Spain)      | Translate fully into European Spanish                                                        |
| `es-mx.json` | Spanish (Mexico)     | Translate fully into Latin American Spanish                                                  |
| `fr-fr.json` | French               | Translate fully into French                                                                  |
| `hi-in.json` | Hindi                | Translate fully into Hindi (Devanagari script preferred; Latin transliteration unacceptable) |
| `ja-jp.json` | Japanese             | Translate fully into Japanese                                                                |
| `ko-kr.json` | Korean               | Translate fully into Korean                                                                  |
| `pt-br.json` | Portuguese (Brazil)  | Translate fully into Brazilian Portuguese                                                    |
| `ru-ru.json` | Russian              | Translate fully into Russian (Cyrillic script)                                               |
| `zh-cn.json` | Chinese (Simplified) | Translate fully into Simplified Chinese                                                      |

---

## Rules

### Every key must be translated

- Every message key present in `en-us.json` must appear in every other language file.
- The value must be a translation into that file's target language — **not** a copy of the English string.
- Placeholder tokens (e.g. `{reason}`, `{received}`, `{path}`) must be preserved exactly as they appear in the English source.

### Do not leave English strings in non-English files

- If a translation is unknown, write a clearly-marked placeholder rather than pasting the English text. Example for `de-de.json`:
  ```json
  "SOME_KEY": "[DE: TODO] rule.condition must be a plain object, a function, or an array of plain objects and functions"
  ```
- Flagged `[LANG: TODO]` entries are acceptable as temporary stubs; verbatim English strings without a `TODO` marker are not.

### Key set must be identical across all files

- No file may have keys that do not exist in `en-us.json`.
- No file may be missing keys that are present in `en-us.json`.
- Run `npm run analyze` and `tools/check-i18n-languages.mjs` to detect key-set divergence.

### Formatting conventions

- Maintain the same JSON key order as `en-us.json` for ease of diff review.
- Use the same indentation style as the rest of the project (tabs, as defined in `.configs/.prettierrc`).
- Do not add comments — JSON does not support them and the parser will reject the file.

---

## When Adding a New Key

1. Add the key and its English value to `en-us.json` first.
2. Add `en-gb.json` with a British English variant (or copy the US value if identical).
3. Add a **real translation** to every other language file. Do not copy the English string.
4. If a professional or verified translation is unavailable, use a `[LANG: TODO]` prefixed stub and file an issue to track the missing translation.
5. Run `npm run analyze` to confirm key coverage.

---

## Verification Commands

```sh
# Check key-set completeness across all language files
node tools/check-i18n-languages.mjs

# Full quality analysis (includes i18n coverage)
npm run analyze
```
