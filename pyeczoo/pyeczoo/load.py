import json
import os.path
import pyeczoo

from urllib.request import urlopen

EcZooDb = pyeczoo.eczoodb.eczoodb.EcZooDb
get_eczoo_full_options = pyeczoo.eczoodb.fullopts.get_eczoo_full_options
EcZooDbYamlDataLoader = pyeczoo.eczoodb.load_yamldb.EcZooDbYamlDataLoader

# default_options = get_eczoo_full_options()
# print(f"{default_options=}")

import javascript


#fs_data_dir = os.path.abspath('../eczoodb/test_data')

_eczoodbDataUrl = 'https://errorcorrectionzoo.org/dat/eczoodata.json'
_eczoodbRefsDataUrl = 'https://errorcorrectionzoo.org/dat/eczoorefsdata.json'
#_eczoodbDataUrl = 'file://' + os.path.abspath('../site/_site/dat/eczoodata.json')
#_eczoodbRefsDataUrl = 'file://' + os.path.abspath('../site/_site/dat/eczoorefsdata.json')


def load_eczoodb_from_json_data(eczoodbDataUrl=None, eczoodbRefsDataUrl=None):
    eczoodbDataUrl = eczoodbDataUrl or _eczoodbDataUrl
    eczoodbRefsDataUrl = eczoodbRefsDataUrl or _eczoodbRefsDataUrl

    with urlopen(eczoodbDataUrl) as f:
        eczoodbData = json.load(f)
    with urlopen(eczoodbRefsDataUrl) as f:
        eczoodbRefsData = json.load(f)

    default_options = get_eczoo_full_options()

    eczoodbOpts = javascript.eval_js(r'''
    return {
        use_relations_populator: default_options.use_relations_populator,

        use_flm_environment: default_options.use_flm_environment,
        use_flm_processor: false,

        // allow unresolved refs because e.g. a code description might contain a
        // reference to an equation/figure somewhere else on the code page
        // itself (and hence not listed in the global refs database)
        flm_options: {
            allow_unresolved_references: true,
        },

        use_searchable_text_processor: false,

        fs: null,
        // flm_processor_graphics_resources_fs_data_dir: data_dir,    
        // flm_processor_citations_override_arxiv_dois_file:
        //     path.join(data_dir, 'code_extra', 'override_arxiv_dois.yml'),
        // flm_processor_citations_preset_bibliography_files: [
        //     path.join(data_dir, 'code_extra', 'bib_preset.yml'),
        // ],

        continue_with_errors: true,
    };
    ''')

    eczoodb = EcZooDb(eczoodbOpts)

    #
    # load refs & citations
    #
    eczoodb.zoo_flm_environment.ref_resolver.load_database(
        eczoodbRefsData['refs']
    );
    eczoodb.zoo_flm_environment.citations_provider.load_database(
        eczoodbRefsData['citations']
    )

    #
    # load zoo data
    #
    eczoodb.load_data(eczoodbData['db'])

    #print(f"DB: { eczoodb }")

    return eczoodb

