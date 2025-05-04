import debug_module from 'debug';
const debug = debug_module('eczoohelpers_eczcollectbib.collectbib');


import { Cite, plugins } from '@citation-js/core';
//import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-csl';


import { parseAuthorsYearInfo } from './parseauthors.js';

import { generateBibtex } from './generatebibtex.js';

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
    constructor()
    {
        this.bib_db = {};

        this.remove_full_flm_braces = true;
        this.detect_formatted_info_extract_year = false;
    }

    collectFromZooFlmProcessorEncountered({
        zoo_flm_processor,
        include_compiled_flm,
        include_encountered_in,
    })
    {
        include_compiled_flm ??= false;
        include_encountered_in ??= false;

        debug(`Collecting bib references using zoo_flm_processor = ${zoo_flm_processor}`);

        const citation_manager = zoo_flm_processor.citation_manager;

        // will be used if include_compiled_flm
        const citation_compiler = zoo_flm_processor.citation_compiler;

        const all_encountered_citations =
            zoo_flm_processor.scanner.get_encountered('citations');

        let bib_db = this.bib_db; // alias to this.bib_db

        for (const { cite_prefix, cite_key, encountered_in }
            of all_encountered_citations) {

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

            // get the compiled FLM code for this citation
            let compiled_flm = 
                include_compiled_flm
                ? citation_compiler.get_compiled_citation(cite_prefix, cite_key)
                : null;

            //
            // Try to guess important information from any citation that is provided
            // as a ready-formatted citation.
            //
            if (jsondata.author == null || jsondata.issued == null) {
                jsondata = this._detect_jsondata_authoryear({ jsondata });
            }

            let cite_instance = new Cite([ jsondata ]);

            let sort_key = this._generate_sort_key({ cite_instance, jsondata });

            const csl_json = generateCslJson(jsondata);

            const bibentry = {
                cite_prefix,
                cite_key,
                cite_prefix_key_clean,
                cite_instance,
                jsondata,
                rawjsondata,
                csl_json,
                compiled_flm,
                sort_key,
                encountered_in_list: include_encountered_in ? [ encountered_in, ] : null,
            };
            bib_db[cite_prefix_key] = bibentry;
        }

        if (include_encountered_in) {
            // Go through all entries again; finalize the encountered_in_list of each
            // entry to remove duplicates and keep only object pointers
            for (const [cite_prefix_key_, bibobj] of Object.entries(bib_db)) {
                let encountered_in_object_list = {};
                for (const encountered_in of bibobj.encountered_in_list) {
                    const resource_info = encountered_in.resource_info;
                    const key = `${resource_info.object_type}:${resource_info.object_id}:`;
                    if (!Object.hasOwn(encountered_in_object_list, key)) {
                        encountered_in_object_list[key] = resource_info;
                    }
                }
                bibobj.encountered_in_object_list = encountered_in_object_list;
            }
        }

        // prepare the sorted list, for convenience.
        this.bib_db_sorted = [...Object.values(bib_db)].sort(
            (obj1, obj2) => obj1.sort_key.localeCompare(obj2.sort_key)
        );

        // all good!
    }

    generateBibtexEntries()
    {
        return generateBibtex(this.bib_db);
    }

    generateCslJsonEntries()
    {
        return Object.values(this.bib_db).map((bibentry) => bibentry.csl_json);
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
        sort_key = sort_key.replace(/,[^;]+;/, ';');
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

    _detect_jsondata_authoryear({ jsondata })
    {
        let compiled_flm = jsondata._ready_formatted?.flm ?? '';
        compiled_flm = compiled_flm.flm_text ?? compiled_flm;
        if (this.remove_full_flm_braces && compiled_flm.startsWith('{')
            && compiled_flm.endsWith('}')) {
            compiled_flm = compiled_flm.slice(1,compiled_flm.length-1);
        }

        // run our heuristic parser to read out author list & year
        const  {
            author_list,
            // remaining_string,
            year,
            remaining_string,
            remaining_string_no_year,
        } = parseAuthorsYearInfo(compiled_flm);

        let newjsondata = Object.assign({}, jsondata);

        if (jsondata.author == null) {
            newjsondata.author = author_list;
        }
        newjsondata._issued_year = year;
        if (this.detect_formatted_info_extract_year && jsondata.issued == null) {
            newjsondata.issued = {
                'date-parts': [ [ year ] ],
            };
        }
        if (jsondata.author == null && jsondata.title == null
            && jsondata.issued == null && jsondata['container-title'] == null) {
            // Looks like an empty entry -- create a minimal CSL-JSON entry!
            newjsondata.type = "document";
            if (this.detect_formatted_info_extract_year) {
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


// function generateBibtex(bib_db, { filterByEntry }={})
// {
//     let bibtex_entries = [];

//     for (const bibentry of Object.values(bib_db)) {
//         if (filterByEntry != null && !filterByEntry(bibentry)) {
//             continue;
//         }
//         bibtex_entries.push( bibentry.cite_instance.format('bibtex') );
//     }

//     return bibtex_entries;
// }


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
    ["issue", "journal-issue", (v) => v.issue],
    ["page", "article-number", null],
    ["ISBN", "isbn-type", (v) => (v.value || v[0]?.value)],
]

const drop_csl_keys = Object.fromEntries([
    // Internal keys automatically dropped thanks to leading underscore
    //"_ready_formatted",
    //"_hash",
    //---
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

