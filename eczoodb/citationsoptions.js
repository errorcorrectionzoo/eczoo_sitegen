import csl_style_json_data from './eczoo-bib-style.json' assert { type: 'json' };


export const stdzoo_options_bibstyle = {
    llm_processor_options: {
        citations: {
            csl_style: csl_style_json_data.data,
        },
    },
};
