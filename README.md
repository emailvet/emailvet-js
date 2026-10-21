# Emailvet for JavaScript / TypeScript

Provider-aware email address canonicalization using the same rules format as Emailvet for Python.

## Local install

```bash
npm install /path/to/emailvet-js
```

## JavaScript

```js
const { canonEmail, analyzeEmail } = require("emailvet");

console.log(canonEmail("a.b.c.d+123@gmail.com"));
// abcd@gmail.com

console.log(canonEmail("John.Smith@EXAMPLE.COM"));
// John.Smith@example.com

console.log(analyzeEmail("A.B+shop@googlemail.com"));
```

## TypeScript

```ts
import { canonEmail, analyzeEmail, EmailAnalysis } from "emailvet";

const canonical: string = canonEmail("a.b+tag@gmail.com");
const result: EmailAnalysis = analyzeEmail("A.B+shop@googlemail.com");
```

## Rules

```js
const { rulesVersion, rulesInfo, updateRules } = require("emailvet");

console.log(rulesVersion());
console.log(rulesInfo());
await updateRules("https://example.com/providers.json");
```

Normal canonicalization is fully offline. Downloaded rules are stored at `~/.emailvet/providers.json`, intentionally matching the Python package.

## CLI

```bash
emailvet canon "a.b+tag@gmail.com"
emailvet analyze "A.B+tag@googlemail.com"
emailvet rules-version
emailvet rules-info
emailvet update-rules "https://example.com/providers.json"
```

## Test

```bash
npm test
```

Unknown providers are handled conservatively: only the domain is lowercased.
