// Boxing — ntp.css build artifact generator (ADR-0011).
// Single source of truth for the CSS concatenation (BX-XPLAT-001): imported
// by build.mjs (extension dist) and build-demo.mjs (Pages demo) so there is
// exactly one copy of this logic. ntp/ntp.css is gitignored and regenerated
// on every build from these 4 sources, in this order:
// base.css + settings.css + onboarding.css + conn.css.
import fs from "node:fs";
import path from "node:path";

export function buildNtpCss(root) {
  const srcDir = path.join(root, "ntp");
  const srcFiles = ["base.css", "settings.css", "onboarding.css", "conn.css"];
  const css = srcFiles.map((f) => fs.readFileSync(path.join(srcDir, f), "utf8")).join("");
  fs.writeFileSync(path.join(srcDir, "ntp.css"), css, "utf8");
  console.log("A8.0: ntp.css built from " + srcFiles.length + " sources (" + css.length + " chars)");
  return css.length;
}
