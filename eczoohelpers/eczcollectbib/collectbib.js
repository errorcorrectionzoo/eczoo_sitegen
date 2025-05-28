import debug_module from 'debug';
const debug = debug_module('eczoohelpers_eczcollectbib.collectbib');

import loMerge from 'lodash/merge.js';

import { Cite, plugins } from '@citation-js/core';
import '@citation-js/plugin-csl';

//import { render_text_standalone, $$kw } from '@phfaist/zoodb/zooflm';

import { parseAuthorsYearInfo } from './parseauthors.js';
import { Anystyle } from './parse_anystyle.js';

// Using a special BibTeX export style (inspired by Zotero).
import { generateBibtex } from './generatebibtex.js';

// Using a citaiton.js plugin. Unfortunatly it's over-zealous in escaping LaTeX commands
// and I can't seem to change this behavior.
//import { generateBibtex } from './generatebibtex_alt.js';

// ------------------------------------

let sort_key_csl_template = `<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" class="in-text" default-locale="en-US">
    <bibliography>
        <layout>
            <names variable="author" delimiter=", " et-al-min="2" et-al-use-first="1">
                <name form="long" initialize-with=". " name-as-sort-order="all" sort-separator=" " />
            </names>
            <date variable="issued" form="numeric" date-parts="year" prefix=";"/>
        </layout>
    </bibliography>
</style>`;

let plusings_config_csl = plugins.config.get('@csl')
plusings_config_csl.templates.add(
    'my_eczoo_sort_key_csl_template', sort_key_csl_template
)


// ------------------------------------


export class EczBibReferencesCollector
{
    constructor(options={})
    {
        this.bib_db = {};
        this.bib_db_sorted = [];
        this.processed = false;

        this.options = Object.assign(
            {
                remove_full_flm_braces: true,
                detect_formatted_info_extract_year: false,
            },
            options ?? {}
        );
    }

    saveBibDbData()
    {
        return JSON.stringify({bib_db: this.bib_db, processed: this.processed});
    }
    loadBibDbData(bibDbData)
    {
        let d = JSON.parse(bibDbData);
        this.bib_db = d.bib_db;
        this.processed = d.processed;
        if (this.processed) {
            this._build_bib_db_sorted();
        }
    }

    _build_bib_db_sorted()
    {
        this.bib_db_sorted = [...Object.values(this.bib_db)].sort(
            (obj1, obj2) => obj1.sort_key.localeCompare(obj2.sort_key)
        );
    }

    collectFromZooFlmProcessorEncountered({
        zoo_flm_processor,
        include_compiled_flm,
        include_encountered_in,
        filter_bib_entry,
    })
    {
        include_compiled_flm ??= false;
        include_encountered_in ??= false;
        filter_bib_entry ??= null;

        debug(`Collecting bib references using zoo_flm_processor = ${zoo_flm_processor}`);

        const citation_manager = zoo_flm_processor.citation_manager;

        // will be used if include_compiled_flm
        const citation_compiler = zoo_flm_processor.citation_compiler;

        const all_encountered_citations =
            zoo_flm_processor.scanner.get_encountered('citations');

        let bib_db = this.bib_db; // alias to this.bib_db

        for (const encountered_citation of all_encountered_citations) {
            const { cite_prefix, cite_key, encountered_in } = encountered_citation;

            if (filter_bib_entry && !filter_bib_entry(encountered_citation)) {
                continue;
            }

            let cite_prefix_key = `${cite_prefix}:${cite_key}`;

            if (Object.hasOwn(bib_db, cite_prefix_key)) {
                //
                // We've already taken care of this citation.  We only have to
                // update the 'encountered_in_list' field.
                //
                if (include_encountered_in) {
                    let encountered_in_list = bib_db[cite_prefix_key].encountered_in_list;
                    encountered_in_list.push(encountered_in);
                }
                continue;
            }

            let cite_prefix_key_clean =
                cite_prefix_key.replace(/[^a-zA-Z0-9_.:/@=+()-]+/g, '-')
                .slice(0,36) ;

            const rawjsondata = citation_manager.get_citation_by_id(cite_prefix_key);

            // get the compiled FLM code for this citation
            let compiled_flm = 
                include_compiled_flm
                ? citation_compiler.get_compiled_citation(cite_prefix, cite_key)
                : null;
            
            // compile the citation to plain text for parsing with Anystyle ? --- OR NOT, DIRECTLY USE FLM FOR ANYSTYLE???
            //
            // jsondata._ready_formatted.flm;
            // compiled_flm = compiled_flm.flm_text ?? compiled_flm;
            // if (this.options.remove_full_flm_braces && compiled_flm.startsWith('{')
            //     && compiled_flm.endsWith('}')) {
            //     compiled_flm = compiled_flm.slice(1,compiled_flm.length-1);
            // }
            // // compile FLM to text
            // const fragment = zoo_flm_environment.make_fragment(
            //     compiled_flm,
            //     $$kw({
            //         is_block_level: false,
            //         standalone_mode: true,
            //         what: `Citation text for ${jsondata.id}`,
            //     }),
            // );
            // const formattedBibRef = render_text_standalone(fragment);


            const bibentry = {
                cite_prefix,
                cite_key,
                cite_prefix_key,
                cite_prefix_key_clean,
                rawjsondata,
                compiled_flm, // POSSIBLY NON-SERIALIZABLE !
                encountered_in_list: include_encountered_in ? [ encountered_in, ] : null,

                // These are set only once the entries are "processed"
                cite_instance: null, // NOT SERIALIZABLE
                jsondata: null,
                sort_key: null,
                csl_json: null,

                toJSON()
                {
                    return Object.assign(
                        {},
                        this,
                        {
                            compiled_flm: this.compiled_flm?.flm_text ?? this.compiled_flm,
                            cite_instance: null,
                        }
                    );
                }
            };
            bib_db[cite_prefix_key] = bibentry;
        }

        if (include_encountered_in) {
            this._build_encountered_in_object_list();
        }

        // all good!
    }

    _build_encountered_in_object_list()
    {
        // Go through all entries again; finalize the encountered_in_list of each
        // entry to remove duplicates and keep only object pointers
        for (const [cite_prefix_key_, bibentry] of Object.entries(this.bib_db)) {
            let encountered_in_object_list = {};
            for (const encountered_in of bibentry.encountered_in_list) {
                const resource_info = encountered_in.resource_info;
                const key = `${resource_info.object_type}:${resource_info.object_id}:`;
                if (!Object.hasOwn(encountered_in_object_list, key)) {
                    encountered_in_object_list[key] = resource_info;
                }
            }
            bibentry.encountered_in_object_list = encountered_in_object_list;
        }
    }

    getFilteredBibDb({ filter_bib_entry, include_encountered_in }={})
    {
        include_encountered_in ??= true;

        let c2 = new EczBibReferencesCollector(
            this.options
        );
        let new_bib_db = {};
        for (const bibentry of Object.values(this.bib_db)) {
            const { cite_prefix, cite_key, cite_prefix_key, encountered_in_list } = bibentry;
            if (encountered_in_list == null) {
                throw new Error(`getFilteredBibDb() requires the original bibdb to include encountered_in information.  Use option "include_encountered_in: true" when collecting entries.`);
            }
            for (const encountered_in of encountered_in_list) {
                // reconstruct an "encountered citation"
                const encountered_citation = { cite_prefix, cite_key, encountered_in };
                if (filter_bib_entry && !filter_bib_entry(encountered_citation)) {
                    continue;
                }
                if (Object.hasOwn(new_bib_db, cite_prefix_key)) {
                    //
                    // We've already taken care of this citation.  We only have to
                    // update the 'encountered_in_list' field.
                    //
                    if (include_encountered_in) {
                        let encountered_in_list =
                            new_bib_db[cite_prefix_key].encountered_in_list;
                        encountered_in_list.push(encountered_in);
                    }
                    continue;
                }
                new_bib_db[cite_prefix_key] = Object.assign(
                    {},
                    bibentry,
                    {
                        encountered_in_list: [ encountered_in ],
                        encountered_in_object_list: null,
                    }
                );
            }
        }
        c2.bib_db = new_bib_db;
        if (include_encountered_in) {
            c2._build_encountered_in_object_list();
        }
        c2.processed = this.processed;
        if (c2.processed) {
            c2._build_bib_db_sorted();
        }
        return c2;
    }

    generateBibtexEntries(options={})
    {
        if (!this.processed) {
            throw new Error(`call processEntries() before generateBibtexEntries()`);
        }
        return generateBibtex(this.bib_db, options);
    }

    generateCslJsonEntries()
    {
        if (!this.processed) {
            throw new Error(`call processEntries() before generateCslJsonEntries()`);
        }
        return Object.values(this.bib_db).map((bibentry) => bibentry.csl_json);
    }

    // ----------------

    processEntries({ anystyleOptions }={})
    {
        const anystyle = new Anystyle();
        anystyle.initialize(anystyleOptions);

        for (const bibentry of Object.values(this.bib_db)) {

            const {
                cite_prefix_key_clean,
                rawjsondata
            } = bibentry;

            let jsondata = Object.assign(
                {
                    id: 'Missing-ID',
                    type: 'document', // there doesn't seem to be any "unknown" or "misc" type
                },
                rawjsondata,
                {
                    id: cite_prefix_key_clean,
                },
            );

            //
            // Try to guess important information from any citation that is provided
            // as a ready-formatted citation.
            //
            if ((jsondata.author == null || jsondata.issued == null)
                && jsondata._ready_formatted?.flm) {
                jsondata = this._complete_jsondata({ jsondata, anystyle });
            }

            let cite_instance = new Cite([ jsondata ]);

            let sort_key = this._generate_sort_key({ cite_instance, jsondata });

            const csl_json = generateCslJson(jsondata);

            bibentry.cite_instance = cite_instance;
            bibentry.jsondata = jsondata;
            bibentry.sort_key = sort_key;
            bibentry.csl_json = csl_json;
        }

        this.processed = true;

        // prepare the sorted list, for convenience.
        this._build_bib_db_sorted();
    }

    // ----------------

    _complete_jsondata({ jsondata, anystyle })
    {
        // based on Anystyle:
        let compiled_flm = this._get_compiled_flm({ jsondata });

        if (!compiled_flm || compiled_flm.trim() == "") {
            // no compiled citation to work with!
            console.warn(`⚠️⚠️⚠️ No compiled citation available for ${jsondata.id}!`, jsondata);
            return jsondata;
        }

        try {
            const anystyleResult =
                anystyle.anystyle(compiled_flm, { wantJson: true, wantBibtex: false });

            loMerge(jsondata, anystyleResult.json); // merge in!
            return jsondata;

        } catch (err) {
            if (!err._anystyle_error) {
                throw err;
            }
            debug(
                `*** anystyle returned an error for ‘${jsondata.id}’. Trying our `
                + `heuristic algorithm instead.`
            );
            return this._detect_jsondata_authoryear({ jsondata });
        }

        // alternative, try to find author and year through manual heuristic
        // coded in parseauthors.js:
        //return this._detect_jsondata_authoryear({ jsondata });
    }

    // ----------------

    _generate_sort_key({ cite_instance, jsondata })
    {
        // Prepare the key relevant for the sorting of the bibliography.
        // The sort key is defined by a custom CSL template.
        let sort_key = cite_instance.format('bibliography', {
            format: 'text',
            template: 'my_eczoo_sort_key_csl_template',
            lang: 'en-US',
        });
        // hack to cut off additional authors, because I cannot seem to make
        // CSL's et-al to work !!
        sort_key = sort_key.replace(/,[^;]+;/g, ';');
        // In case there is some sort of error ...
        if (sort_key === "" || sort_key.startsWith(";")) {
            let compiled_flm = jsondata._ready_formatted?.flm ?? '';
            let fallback_sort_key = compiled_flm.flm_text ?? compiled_flm;
            // attempt to remove initials & "and"
            fallback_sort_key = fallback_sort_key.replace(/\b\w\b\.?[ -]*| and /g, '');
            // remove all non-alphanum chars
            fallback_sort_key = fallback_sort_key.replace(/\W/g, '');
            sort_key = fallback_sort_key + sort_key;
            debug(`For some reason, I was not able to generate a reliable sort key for ‘${jsondata.id}’!  Fallback key = ${fallback_sort_key}`);
        }
        if (sort_key === "" || sort_key.startsWith(";")) { // still problematic
            sort_key = `zzzz${sort_key}`; // bump to the end, sorry...
        }

        return sort_key;
    }

    _get_compiled_flm({ jsondata })
    {
        let compiled_flm = jsondata._ready_formatted?.flm ?? '';
        compiled_flm = compiled_flm.flm_text ?? compiled_flm;
        if (this.options.remove_full_flm_braces && compiled_flm.startsWith('{')
            && compiled_flm.endsWith('}')) {
            compiled_flm = compiled_flm.slice(1,compiled_flm.length-1);
        }
        // make sure we don't have '\n' in compiled_flm!
        compiled_flm = compiled_flm.replaceAll('\n', ' ');
        return compiled_flm;
    }

    _detect_jsondata_authoryear({ jsondata })
    {
        const compiled_flm = this._get_compiled_flm({ jsondata });

        debug(`_detect_jsondata_authoryear (${jsondata.id}): Using compiled_flm = ‘${compiled_flm}’`);

        // run our heuristic parser to read out author list & year
        const  {
            author_list,
            // remaining_string,
            year,
            remaining_string,
            remaining_string_no_year,
        } = parseAuthorsYearInfo(compiled_flm);

        debug(`_detect_jsondata_authoryear (${jsondata.id}): Found`, {author_list, year, remaining_string, remaining_string_no_year});

        let newjsondata = Object.assign({}, jsondata);

        if (jsondata.author == null) {
            newjsondata.author = author_list;
        }
        newjsondata._issued_year = year;
        if (this.options.detect_formatted_info_extract_year && jsondata.issued == null) {
            newjsondata.issued = {
                'date-parts': [ [ year ] ],
            };
        }
        if (jsondata.author == null && jsondata.title == null
            && jsondata.issued == null && jsondata['container-title'] == null) {
            // Looks like an empty entry -- create a minimal CSL-JSON entry!
            newjsondata.type = "document";
            if (this.options.detect_formatted_info_extract_year) {
                newjsondata.note = remaining_string_no_year;
            } else {
                newjsondata.note = remaining_string;
            }
            debug(`Setting type=document etc. on newjsondata:`, newjsondata);
        }

        return newjsondata;
    }
}



//
// Helpers to dump bib database contents in BibTeX and/or CSL-JSON
//


// ------


const valid_csl_keys = Object.fromEntries([
    // collected from https://github.com/citation-style-language/schema/blob/master/schemas/input/csl-data.json
    "DOI",
    "ISBN",
    "ISSN",
    "PMCID",
    "PMID",
    "URL",
    "abstract",
    "accessed",
    "annote",
    "archive",
    "archive-place",
    "archive_collection",
    "archive_location",
    "author",
    "authority",
    "available-date",
    "call-number",
    "categories",
    "chair",
    "chapter-number",
    "citation-key",
    "citation-label",
    "citation-number",
    "collection-editor",
    "collection-number",
    "collection-title",
    "compiler",
    "composer",
    "container-author",
    "container-title",
    "container-title-short",
    "contributor",
    "curator",
    "custom",
    "dimensions",
    "director",
    "division",
    "edition",
    "editor",
    "editorial-director",
    "event",
    "event-date",
    "event-place",
    "event-title",
    "executive-producer",
    "first-reference-note-number",
    "genre",
    "guest",
    "host",
    "id",
    "illustrator",
    "interviewer",
    "issue",
    "issued",
    "journalAbbreviation",
    "jurisdiction",
    "keyword",
    "language",
    "locator",
    "medium",
    "narrator",
    "note",
    "number",
    "number-of-pages",
    "number-of-volumes",
    "organizer",
    "original-author",
    "original-date",
    "original-publisher",
    "original-publisher-place",
    "original-title",
    "page",
    "page-first",
    "part",
    "part-title",
    "performer",
    "printing",
    "producer",
    "publisher",
    "publisher-place",
    "recipient",
    "references",
    "reviewed-author",
    "reviewed-genre",
    "reviewed-title",
    "scale",
    "script-writer",
    "section",
    "series-creator",
    "shortTitle",
    "source",
    "status",
    "submitted",
    "supplement",
    "title",
    "title-short",
    "translator",
    "type",
    "version",
    "volume",
    "volume-title",
    "volume-title-short",
    "year-suffix"
].map( (k) => [k, true] ) );

const default_from_keys = [
    // if issued is not present, use value from published-online; etc.
    ["issued", "published-online", null],
    ["issued", "published-print", null],
    ["issued", "published-other", null],
    ["issued", "accepted", null],
    ["issue", "journal-issue", (v) => v.issue],
    ["page", "article-number", null],
    ["ISBN", "isbn-type", (v) => (v.value || v[0]?.value)],
]

const drop_csl_keys = Object.fromEntries([
    // Internal keys automatically dropped thanks to leading underscore
    //"_ready_formatted",
    //"_hash",
    //---
    "accepted",
    "indexed",
    "reference-count",
    "content-domain",
    "published-print",
    "created",
    "is-referenced-by-count",
    "prefix",
    "member",
    "published-online",
    "link",
    "license",
    "deposited",
    "score",
    "resource",
    "subtitle",
    "short-title",
    "references-count",
    "journal-issue",
    "relation",
    "subject",
    "published",
    "reference",
    "funder",
    "article-number",
    "assertion",
    "isbn-type",
    "update-policy",
    "published-other",
].map( (k) => [k, true] ) );

function valueToString(value)
{
    if (typeof value === 'string') {
        return value;
    } else if (typeof value === 'number') {
        return `${value}`;
    } else if (Array.isArray(value)) {
        return value.map(x => valueToString(x)).join('\n');
    }
    return JSON.stringify(value);
};

function generateCslJson(jsondata)
{
    // filter out any dictionary keys that are not valid CSL-JSON
    let csljson_collected_notes = [];
    if (jsondata.note) {
        csljson_collected_notes.push(valueToString(jsondata.note));
    }
    let csljson_data = Object.assign({}, jsondata);
    for (const [k,v, fn] of default_from_keys) {
        if (csljson_data[k] == null && csljson_data[v] != null) {
            csljson_data[k] = fn ? fn(csljson_data[v]) : csljson_data[v];
        }
    }
    csljson_data = Object.fromEntries(
        Object.entries(csljson_data).filter(
            ([key, value]) => {
                if (Object.hasOwn(valid_csl_keys, key)) {
                    return true;
                }
                if (key === 'note') {
                    // special handling -- skip for now
                    return false;
                }
                // handle this value in some way.
                if (Object.hasOwn(drop_csl_keys, key) || key.startsWith('_')) {
                    // simply skip the value
                    return false;
                }
                //debug('Invalid CSL-JSON key, adding to notes...');
                if (!value) {
                    // if there isn't any value (or it's null), simply omit the key...
                    return false;
                }
                let value_str = valueToString(value);
                csljson_collected_notes.push(`${key}:${value_str}`)
                return false;
            }
        )
    );
    if (csljson_collected_notes.length) {
        csljson_data.note = csljson_collected_notes.join('\n');
    }
    
    return csljson_data;
}

