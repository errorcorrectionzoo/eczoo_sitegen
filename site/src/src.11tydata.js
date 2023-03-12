module.exports = {
    "layout": "base_page",
    "date": "Git last modified",
    "permalink": (data) => `${ data.page.filePathStem }.${ data.page.outputFileExtension }`,
}
