module.exports = {
    "layout": "base_page",
    "permalink": (data) => `${ data.page.filePathStem }.${ data.page.outputFileExtension }`,
}
