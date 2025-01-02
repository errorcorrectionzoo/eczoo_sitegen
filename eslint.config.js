import globals from 'globals';

import reactPlugin from 'eslint-plugin-react';
import mochaPlugin from "eslint-plugin-mocha";

import jsLint from "@eslint/js";


export default [
    {
        // I simply cannot figure out how to make ESLint ignore these files.  ... :/
        ignores: [
            "**/dist/*",
            "**/_site/*",
            "**/_site.*/*",
            "**/dev-dist/*",
            "**/_headless_exporter_browser_code_dist/*",
        ],
    },
    jsLint.configs.recommended,
    {
        files: [
            "jscomponents/**/*.{js,jsx,cjs,mjs}",
            "eczoodb/**/*.{js,jsx,cjs,mjs}",
            "previewtool/*.{js,jsx,cjs,mjs}",
        ],
    },
    {
        rules: {
            "no-irregular-whitespace": [ "error", {
                skipStrings: true,
                skipTemplates: true,
                skipJSXText: true,
            } ],
            "no-unused-vars": [ "error", {
                varsIgnorePattern: "^(ne|rdr|ref|.*_)$",
                argsIgnorePattern: "_$",
                destructuredArrayIgnorePattern: "_$"
            } ],
        },
    },

    // MOCHA tests
    mochaPlugin.configs.flat.recommended,

    // REACT stuff

    reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
    {
        files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
        ...reactPlugin.configs.flat.recommended,
        languageOptions: {
          ...reactPlugin.configs.flat.recommended.languageOptions,
          globals: {
            ...globals.serviceworker,
            ...globals.browser,
          },
        },
    },

    // Some CommonJS modules
    {
        files: ["helpers/**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
        },
    }
];
