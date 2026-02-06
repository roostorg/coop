const fs = require("fs");
const path = require("path");

const ruleFiles = fs
  .readdirSync(__dirname)
  .filter((file) => {
    const fullPath = path.join(__dirname, file);
    return !fs.statSync(fullPath).isDirectory() && file !== "index.js" && !file.endsWith("test.js");
  });

const rules = Object.fromEntries(
  ruleFiles.map((file) => [path.basename(file, ".js"), require("./" + file)])
);

module.exports = { rules };
