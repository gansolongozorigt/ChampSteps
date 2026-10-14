// node scripts/cap-bump.mjs — native version numbers from package.json.
//   iOS:     MARKETING_VERSION = package.json version, CURRENT_PROJECT_VERSION += 1
//   Android: versionName = package.json version, versionCode += 1
// Run before a store build (npm run cap:bump). Build numbers only ever go up.
import { readFileSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;

const pbx = "ios/App/App.xcodeproj/project.pbxproj";
let p = readFileSync(pbx, "utf8");
let iosBuild = 0;
p = p.replace(/CURRENT_PROJECT_VERSION = (\d+);/g, (_, n) => { iosBuild = Number(n) + 1; return `CURRENT_PROJECT_VERSION = ${iosBuild};`; });
p = p.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
writeFileSync(pbx, p);

const gradle = "android/app/build.gradle";
let g = readFileSync(gradle, "utf8");
let androidCode = 0;
g = g.replace(/versionCode (\d+)/, (_, n) => { androidCode = Number(n) + 1; return `versionCode ${androidCode}`; });
g = g.replace(/versionName "[^"]*"/, `versionName "${version}"`);
writeFileSync(gradle, g);

console.log(`iOS ${version} (${iosBuild}) · Android ${version} (${androidCode})`);
