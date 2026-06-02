
import { CitationSourceBase } from '@phfaist/zoodb/citationmanager/source/base';


export class CiteSourceExternalQecdbOrg extends CitationSourceBase
{
    constructor(options)
    {
        options ||= {};

        const override_options = {
            source_name: 'External DB: QECDB.ORG',
            chunk_size: Infinity,
            chunk_retrieve_delay_ms: 0,

            cache_store_options: {
                // Setting cache_duration_ms = 0 means do not keep in cache; it will stay though
                // long enough for the zoo to be built.
                cache_duration_ms: 0
            },
        };
        const default_options = {
            cite_prefix: 'qecdborg',
        };

        super(
            override_options,
            options,
            default_options,
        );

    }

    async run_retrieve_chunk(id_list)
    {
        for (const key of id_list) {

            // TODO: Maybe query the qecdb.org site to (1) check that this code exists, and (2) extract some metainformation to display in the citation line.  (Say, "Qecdb.org Database, [[49,1,3]] css code, ID XYZ")

            await this.citation_manager.store_citation(
                this.cite_prefix, key,
                {
                    _ready_formatted: {
                        flm: `\\emph{Qecdb.org Database}, \\href{https://qecdb.org/codes/${key}}{ID ${key}}`,
                    }
                },
                this.cache_store_options,
            );

        }
    }

}


