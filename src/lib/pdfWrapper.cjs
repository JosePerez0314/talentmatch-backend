// lib/pdfWrapper.cjs
const pdf = require("pdf-parse");

module.exports.extract = async (buffer) => {
    return await pdf(buffer);
};