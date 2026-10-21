# Emailvet

Provider-aware email address canonicalization for JavaScript and TypeScript.

```js
canonEmail("a.b.c.d+123@gmail.com");
// "abcd@gmail.com"
```

## Install

```bash
npm install emailvet
```

## Usage

```js
const { canonEmail, analyzeEmail } = require("emailvet");

console.log(canonEmail("a.b.c.d+123@gmail.com"));
// abcd@gmail.com

console.log(canonEmail("John.Smith@EXAMPLE.COM"));
// John.Smith@example.com
```

TypeScript is supported through bundled type declarations.

## Supported providers

Emailvet currently includes provider-specific rules for:

- Gmail / Googlemail
- Outlook.com
- Proton Mail
- Yandex Mail
- Fastmail-owned domains

Unknown providers are handled conservatively: only the domain is lowercased.

## Analysis

Use `analyzeEmail()` when you want to see what Emailvet changed:

```js
const result = analyzeEmail("A.B+shop@googlemail.com");

console.log(result);
```

```js
{
  original: "A.B+shop@googlemail.com",
  canonical: "ab@gmail.com",
  provider: "gmail",
  rulesApplied: [
    "lowercase_local_part",
    "strip_subaddress",
    "ignore_dots",
    "canonicalize_domain"
  ]
}
```

## Rules and updates

Provider rules are bundled with the package, so normal canonicalization works entirely offline.

```js
const {
  rulesVersion,
  rulesInfo,
  updateRules
} = require("emailvet");

console.log(rulesVersion());
console.log(rulesInfo());
```

To install a newer trusted `providers.json` rules file:

```js
await updateRules("https://example.com/providers.json");
```

You can also set `EMAILVET_RULES_URL` and call `updateRules()` without passing a URL.

## License

MIT
