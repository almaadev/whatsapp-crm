import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const rootDir = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let subpath = specifier.slice(2);
    let resolvedPath = path.join(rootDir, "src", subpath);
    if (!path.extname(resolvedPath)) {
      if (fs.existsSync(resolvedPath + ".js")) {
        resolvedPath += ".js";
      } else if (fs.existsSync(resolvedPath + ".jsx")) {
        resolvedPath += ".jsx";
      } else if (fs.existsSync(path.join(resolvedPath, "index.js"))) {
        resolvedPath = path.join(resolvedPath, "index.js");
      }
    }
    return {
      url: pathToFileURL(resolvedPath).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
