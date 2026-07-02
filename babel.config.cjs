// .cjs because package.json has "type": "module" — babel-jest loads this
// file synchronously and needs plain CommonJS, not an ESM export.
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
};
