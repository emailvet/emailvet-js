#!/usr/bin/env node
"use strict";
const {analyzeEmail,canonEmail,rulesInfo,rulesVersion,updateRules}=require("./index.js");
async function main(){const [command,...args]=process.argv.slice(2);
if(command==="canon"){if(args.length!==1)throw new Error("Usage: emailvet canon <email>");console.log(canonEmail(args[0]));return;}
if(command==="analyze"){if(args.length!==1)throw new Error("Usage: emailvet analyze <email>");console.log(JSON.stringify(analyzeEmail(args[0]),null,2));return;}
if(command==="rules-version"){console.log(rulesVersion());return;}
if(command==="rules-info"){console.log(JSON.stringify(rulesInfo(),null,2));return;}
if(command==="update-rules"){console.log(JSON.stringify(await updateRules(args[0]),null,2));return;}
console.error("Usage:\n  emailvet canon <email>\n  emailvet analyze <email>\n  emailvet rules-version\n  emailvet rules-info\n  emailvet update-rules [url]");process.exitCode=1;}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
