"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");

const SUPPORTED_SCHEMA_VERSION = 1;
const ALLOWED_CONFIDENCE = new Set(["guaranteed", "conditional", "observed"]);
const ALLOWED_DOT_BEHAVIORS = new Set(["significant", "ignore", "equivalent_to_hyphen"]);
let cachedRules = null;

function bundledRulesPath() {
  return path.join(__dirname, "..", "data", "providers.json");
}

function downloadedRulesPath() {
  const custom = process.env.EMAILVET_RULES_PATH;
  if (custom) {
    if (custom === "~") return os.homedir();
    if (custom.startsWith("~/") || custom.startsWith("~\\")) return path.join(os.homedir(), custom.slice(2));
    return path.resolve(custom);
  }
  return path.join(os.homedir(), ".emailvet", "providers.json");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateConfidence(providerId, ruleName, value) {
  if (value == null) return;
  if (typeof value !== "string" || !ALLOWED_CONFIDENCE.has(value)) {
    throw new Error(`Provider ${JSON.stringify(providerId)} rule ${JSON.stringify(ruleName)} has invalid confidence ${JSON.stringify(value)}`);
  }
}

function validateRules(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Rules file must contain a JSON object");
  if (data.schema_version !== SUPPORTED_SCHEMA_VERSION) throw new Error(`Unsupported rules schema version: ${JSON.stringify(data.schema_version)}`);
  if (typeof data.rules_version !== "string" || !data.rules_version.trim()) throw new Error("rules_version must be a non-empty string");
  if (!data.providers || typeof data.providers !== "object" || Array.isArray(data.providers)) throw new Error("providers must be an object");

  for (const [providerId, provider] of Object.entries(data.providers)) {
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) throw new Error(`Provider ${JSON.stringify(providerId)} must be an object`);
    if (!Array.isArray(provider.domains) || provider.domains.length === 0 || provider.domains.some(d => typeof d !== "string" || !d.trim())) {
      throw new Error(`Provider ${JSON.stringify(providerId)} must have valid domains`);
    }
    if (provider.canonical_domain !== undefined && typeof provider.canonical_domain !== "string") {
      throw new Error(`Provider ${JSON.stringify(providerId)} canonical_domain must be a string`);
    }
    const rules = provider.rules;
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new Error(`Provider ${JSON.stringify(providerId)} must contain a rules object`);
    if (rules.lowercase_local_part !== undefined && typeof rules.lowercase_local_part !== "boolean") {
      throw new Error(`Provider ${JSON.stringify(providerId)} lowercase_local_part must be boolean`);
    }
    validateConfidence(providerId, "lowercase_local_part", rules.lowercase_local_part_confidence);

    if (rules.subaddressing !== undefined) {
      const sub = rules.subaddressing;
      if (!sub || typeof sub !== "object" || Array.isArray(sub)) throw new Error(`Provider ${JSON.stringify(providerId)} subaddressing must be an object`);
      if (sub.separator !== undefined && (typeof sub.separator !== "string" || sub.separator.length !== 1)) {
        throw new Error(`Provider ${JSON.stringify(providerId)} subaddress separator must be one character`);
      }
      if (sub.strip !== undefined && typeof sub.strip !== "boolean") throw new Error(`Provider ${JSON.stringify(providerId)} subaddress strip must be boolean`);
      validateConfidence(providerId, "subaddressing", sub.confidence);
    }

    if (rules.dots !== undefined) {
      const dots = rules.dots;
      if (!dots || typeof dots !== "object" || Array.isArray(dots)) throw new Error(`Provider ${JSON.stringify(providerId)} dots must be an object`);
      const behavior = dots.behavior ?? "significant";
      if (typeof behavior !== "string" || !ALLOWED_DOT_BEHAVIORS.has(behavior)) throw new Error(`Provider ${JSON.stringify(providerId)} has unsupported dot behavior ${JSON.stringify(behavior)}`);
      validateConfidence(providerId, "dots", dots.confidence);
    }
  }
}

function loadRules() {
  if (cachedRules) return cachedRules;
  const downloaded = downloadedRulesPath();
  if (fs.existsSync(downloaded)) {
    try {
      const data = readJson(downloaded); validateRules(data);
      cachedRules = {data, source:"downloaded"}; return cachedRules;
    } catch (_) {}
  }
  const data = readJson(bundledRulesPath()); validateRules(data);
  cachedRules = {data, source:"bundled"}; return cachedRules;
}

function clearRulesCache() { cachedRules = null; }
function rulesVersion() { return loadRules().data.rules_version; }
function rulesInfo() { const r=loadRules(); return {version:r.data.rules_version, schemaVersion:r.data.schema_version, source:r.source}; }

function findProvider(domain) {
  const {data}=loadRules();
  for (const [id,p] of Object.entries(data.providers)) {
    if (p.domains.some(d => d.toLowerCase() === domain.toLowerCase())) return [id,p];
  }
  return [null,null];
}

function splitEmail(email) {
  if (typeof email !== "string") throw new TypeError("email must be a string");
  const value=email.trim();
  if (!value) throw new Error("email cannot be empty");
  if ((value.match(/@/g) || []).length !== 1) throw new Error("email must contain exactly one @ character");
  const at=value.lastIndexOf("@");
  const local=value.slice(0,at), domain=value.slice(at+1);
  if (!local) throw new Error("email local part cannot be empty");
  if (!domain) throw new Error("email domain cannot be empty");
  return [local,domain];
}

function analyzeEmail(email) {
  const original=email;
  let [localPart,domain]=splitEmail(email);
  let normalizedDomain=domain.toLowerCase();
  const rulesApplied=[];
  if (normalizedDomain !== domain) rulesApplied.push("lowercase_domain");
  const [providerId,provider]=findProvider(normalizedDomain);
  if (!provider) return {original, canonical:`${localPart}@${normalizedDomain}`, provider:null, rulesApplied};
  const rules=provider.rules;

  if (rules.lowercase_local_part === true) {
    const lowered=localPart.toLowerCase();
    if (lowered !== localPart) rulesApplied.push("lowercase_local_part");
    localPart=lowered;
  }
  const sub=rules.subaddressing || {};
  if (sub.strip === true && sub.separator && localPart.includes(sub.separator)) {
    localPart=localPart.split(sub.separator,1)[0]; rulesApplied.push("strip_subaddress");
  }
  const dotBehavior=(rules.dots && rules.dots.behavior) || "significant";
  if (dotBehavior === "ignore") {
    if (localPart.includes(".")) { localPart=localPart.replace(/\./g,""); rulesApplied.push("ignore_dots"); }
  } else if (dotBehavior === "equivalent_to_hyphen") {
    if (localPart.includes(".")) { localPart=localPart.replace(/\./g,"-"); rulesApplied.push("canonicalize_dots_to_hyphens"); }
  } else if (dotBehavior !== "significant") throw new Error(`Unsupported dot behavior in rules: ${JSON.stringify(dotBehavior)}`);

  if (provider.canonical_domain) {
    const cd=provider.canonical_domain.toLowerCase();
    if (cd !== normalizedDomain) rulesApplied.push("canonicalize_domain");
    normalizedDomain=cd;
  }
  return {original, canonical:`${localPart}@${normalizedDomain}`, provider:providerId, rulesApplied};
}

function canonEmail(email) { return analyzeEmail(email).canonical; }

function requestText(url, timeoutMs) {
  return new Promise((resolve,reject) => {
    const parsed=new URL(url); const client=parsed.protocol === "https:" ? https : http;
    const req=client.get(parsed,{headers:{"User-Agent":"emailvet-js/0.1.0","Accept":"application/json"}},res => {
      if (res.statusCode >=300 && res.statusCode <400 && res.headers.location) { res.resume(); requestText(new URL(res.headers.location, parsed).toString(),timeoutMs).then(resolve,reject); return; }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Rules update request failed with HTTP ${res.statusCode}`)); return; }
      res.setEncoding("utf8"); let body=""; res.on("data",c=>body+=c); res.on("end",()=>resolve(body));
    });
    req.setTimeout(timeoutMs,()=>req.destroy(new Error("Rules update request timed out"))); req.on("error",reject);
  });
}

async function updateRules(url, options={}) {
  const updateUrl=url || process.env.EMAILVET_RULES_URL;
  if (!updateUrl) throw new Error("No rules update URL configured. Pass a URL to updateRules() or set EMAILVET_RULES_URL.");
  const previousVersion=rulesVersion();
  const raw=await requestText(updateUrl, options.timeoutMs ?? 10000);
  let data; try { data=JSON.parse(raw); } catch (e) { throw new Error("Downloaded rules are not valid JSON", {cause:e}); }
  validateRules(data);
  const destination=downloadedRulesPath(); fs.mkdirSync(path.dirname(destination),{recursive:true});
  const temp=`${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data,null,2)+"\n", "utf8"); fs.renameSync(temp,destination); clearRulesCache();
  return {previousVersion, version:data.rules_version, updated:data.rules_version !== previousVersion, path:destination};
}

module.exports={analyzeEmail,canonEmail,clearRulesCache,rulesInfo,rulesVersion,updateRules,validateRules};
