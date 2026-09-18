import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const fallbackRoot = fileURLToPath(new URL("..", import.meta.url));
const rootDir = fs.existsSync(path.join(process.cwd(), "src")) ? process.cwd() : fallbackRoot;

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
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && context?.parentURL && (specifier.startsWith("./") || specifier.startsWith("../"))) {
      try {
        const parentPath = fileURLToPath(context.parentURL);
        const parentDir = path.dirname(parentPath);
        let targetPath = path.resolve(parentDir, specifier);
        if (!path.extname(targetPath)) {
          if (fs.existsSync(targetPath + ".js")) {
            return { url: pathToFileURL(targetPath + ".js").href, shortCircuit: true };
          } else if (fs.existsSync(targetPath + ".jsx")) {
            return { url: pathToFileURL(targetPath + ".jsx").href, shortCircuit: true };
          } else if (fs.existsSync(path.join(targetPath, "index.js"))) {
            return { url: pathToFileURL(path.join(targetPath, "index.js")).href, shortCircuit: true };
          }
        }
      } catch {
        // Fall back to re-throwing original error
      }
    }
    throw err;
  }
}

