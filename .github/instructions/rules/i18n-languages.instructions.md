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

Every value must be a real translation into the target language. There is **no** placeholder/stub form that is acceptable — `[LANG: TODO]` markers and verbatim English strings are both rejected. If a translation is unknown when a key is being added, source one (translator service, native speaker review) before merging the change; do not land a key with a stub value.

Placeholder tokens (e.g. `{reason}`, `{received}`, `{path}`) and quoted JS-identifier names that appear in error messages (e.g. `'manifest'`, `'files'`) are preserved literally in every locale — they're not English content, they're substitution points or API surface names that the user sees on both sides of the boundary.

The script-purity check at `tools/ci/check-i18n-languages.mjs` flags any run of 2+ ASCII Latin letters in a non-Latin-script locale (after stripping placeholders). If a flagged value is a legitimate translation that happens to contain ASCII for a real reason (e.g. a domain term that's borrowed in every language), copy the **exact full translation string** into `tools/ci/i18n-script-purity-accepted.json` under the locale's array. Substring exceptions are not supported by design — every override is a whole-value approval.

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
3. Add a **real translation** to every other language file. Do not copy the English string. Do not use stub markers — source a real translation before merging.
4. Run `npm run analyze` to confirm key coverage AND script purity (no English leakage into non-Latin locales).

---

## Verification Commands

```sh
# Check key-set completeness across all language files
node tools/check-i18n-languages.mjs

# Full quality analysis (includes i18n coverage)
npm run analyze
```
