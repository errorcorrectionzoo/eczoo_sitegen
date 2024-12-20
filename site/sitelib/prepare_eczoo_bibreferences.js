import debugm from 'debug';
const debug = debugm('eczoo_sitegen.sitelib.prepare_eczoo_bibreferences');

import { Cite, plugins } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-csl';

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

let config = plugins.config.get('@csl')
config.templates.add('my_eczoo_sort_key_csl_template', sort_key_csl_template)

// ------------------------------------

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

const drop_csl_keys = Object.fromEntries([
    "indexed",
    "reference-count",
    "content-domain",
    //"published-print",
    "created",
    "is-referenced-by-count",
    "prefix",
    "member",
    //"published-online",
    "link",
    "deposited",
    "score",
    "resource",
    "subtitle",
    "short-title",
    "references-count",
    //"journal-issue",
    "relation",
    "subject",
    //"published",
    "reference",
    "_hash",
].map( (k) => [k, true] ) );


// ------------------------------------



export function prepareEczooBibReferences(eczoodb)
{
    const citation_manager = eczoodb.zoo_flm_processor.citation_manager;
    const citation_compiler = eczoodb.zoo_flm_processor.citation_compiler;

    const all_encountered_citations =
        eczoodb.zoo_flm_processor.scanner.get_encountered('citations');

    let bib_db = {};

    for (const { cite_prefix, cite_key, encountered_in } of all_encountered_citations) {

        let cite_prefix_key = `${cite_prefix}:${cite_key}`;

        if (Object.hasOwn(bib_db, cite_prefix_key)) {
            // we only have to update the 'encountered_in_list' field
            let encountered_in_list = bib_db[cite_prefix_key].encountered_in_list;
            encountered_in_list.push(encountered_in);
            continue;
        }

        let cite_prefix_key_clean = cite_prefix_key.replace(/[^a-zA-Z0-9_.:/@=+()-]+/g, '-');

        const jsondata = Object.assign(
            {
                id: 'Missing-ID',
                type: 'document', // there doesn't seem to be any "unknown" or "misc" type
            },
            citation_manager.get_citation_by_id(cite_prefix_key),
            {
                id: cite_prefix_key_clean,
            },
        );

        // filter out any dictionary keys that are not valid CSL-JSON
        let csljson_collected_notes = [];
        let csljson_data = Object.fromEntries(
            Object.entries(jsondata).filter(
                ([key, value]) => {
                    if (Object.hasOwn(valid_csl_keys, key)) {
                        return true;
                    }
                    // handle this value in some way.
                    if (Object.hasOwn(drop_csl_keys, key)) {
                        // simply skip the value
                        return false;
                    }
                    //debug('Invalid CSL-JSON key, adding to notes...');
                    let value_str = null;
                    if (typeof value === 'string') {
                        value_str = value;
                    } else if (typeof value === 'number') {
                        value_str = `${value}`;
                    } else {
                        value_str = JSON.stringify(value);
                    }
                    csljson_collected_notes.push(`${key}:${value_str}`)
                    return false;
                }
            )
        );
        if (csljson_collected_notes.length) {
            if (csljson_data.notes) {
                csljson_collected_notes.splice(0, 0, csljson_data.notes);
            }
            csljson_data.notes = csljson_collected_notes.join('\n');
        }

        // get the compiled FLM code for this citation
        let compiled_flm = citation_compiler.get_compiled_citation(cite_prefix, cite_key);

        // the bibtex of the citation
        let cite_instance = new Cite([ jsondata ]);
        let bibtex = cite_instance.format('bibtex');

        // Prepare the key relevant for the sorting of the bibliography.
        // The sort key is defined by a custom CSL template.
        let sort_key = cite_instance.format('bibliography', {
            format: 'text',
            template: 'my_eczoo_sort_key_csl_template',
            lang: 'en-US',
        });
        // hack to cut off additional authors, because the CSL's et-al does not seem to work !!
        sort_key = sort_key.replace(/,[^;]+;/, ';');
        if (sort_key === "" || sort_key.startsWith(";")) {
            let fallback_sort_key = compiled_flm.flm_text ?? compiled_flm;
            fallback_sort_key = fallback_sort_key.replace(/\b\w\b\.?[ -]*| and /g, ''); // attempt to remove initials & "and"
            fallback_sort_key = fallback_sort_key.replace(/\W/g, ''); // remove all non-alphanum chars
            sort_key = fallback_sort_key + sort_key;
        }

        bib_db[cite_prefix_key] = {
            cite_prefix,
            cite_key,
            cite_prefix_key_clean,
            jsondata,
            csljson_data,
            bibtex,
            compiled_flm,
            sort_key,
            encountered_in_list: [
                encountered_in,
            ],
        };
    }

    // finalize the encountered_in_list to remove duplicates and keep only object pointers
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

    // prepare the sorted list, for convenience.
    let bib_db_sorted = Object.values(bib_db).sort(
        (obj1, obj2) => obj1.sort_key.localeCompare(obj2.sort_key)
    );

    // prepare the database of all CSL-JSON entries
    let bibdb_csl_json =  Object.entries(bib_db).map( ([k_, v]) => v.csljson_data );

    return {
        bib_db,
        bib_db_sorted,
        bibdb_csl_json,
    }
}