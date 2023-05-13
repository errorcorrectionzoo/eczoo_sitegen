module.exports = {
    layout: "base_page",
    date: "Git last modified",
    permalink: (data) => `${ data.page.filePathStem }.${ data.page.outputFileExtension }`,

    get_current_year: (data) => (new Date().getFullYear())
};
