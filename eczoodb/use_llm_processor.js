import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.use_llm_processor");

import csl_style_json_data from './eczoo-bib-style.json' assert { type: 'json' };

import {
    $$kw, ZooTextFragmentRenderer, ZooLLMEnvironment, repr, CitationsProvider
} from '@phfaist/zoodb/zoollm';

import { ZooLLMProcessor } from '@phfaist/zoodb/dbprocessor/llmprocessor';


import { CitationSourceArxiv } from '@phfaist/zoodb/citationmanager/source/arxiv';
import { CitationSourceDoi } from '@phfaist/zoodb/citationmanager/source/doi';
import { CitationSourceManual } from '@phfaist/zoodb/citationmanager/source/manual';
import { CitationSourceBibliographyFile } from '@phfaist/zoodb/citationmanager/source/bibliographyfile';

import { FilesystemResourceRetriever } from '@phfaist/zoodb/resourcecollector/retriever/fs';

import { LLMGraphicsResourceProcessor } from '@phfaist/zoodb/resourcecollector/processor/llmgraphicsprocessor';





export function use_llm_processor(_this)
{
    if (_this.zoo_llm_environment == null) {
        throw new Error(`Cannot use ‘use_llm_processor()’ with no zoo_llm_environment set.`);
    }

    let zoo_llm_processor = new ZooLLMProcessor({
        zoo_llm_environment: _this.zoo_llm_environment,
        llm_error_policy: _this.llm_error_policy,
        refs: {
            code: {
                formatted_ref_llm_text_fn: (codeid, code) => code.name.llm_text,
            },
            user: {
                formatted_ref_llm_text_fn: (userid, user) => user.name,
            },
        },
        citations: {
            sources: {
                arxiv: new CitationSourceArxiv({
                    override_arxiv_dois_file:
                    _this.config.llm_processor_citations_override_arxiv_dois_file,
                    fs: _this.config.fs,
                }),
                doi: new CitationSourceDoi(),
                manual: new CitationSourceManual(),
                preset: new CitationSourceBibliographyFile({
                    bibliography_files:
                    _this.config.llm_processor_citations_preset_bibliography_files,
                    fs: _this.config.fs,
                }),
            },
            default_user_agent: `ecczoogen-bibliography-build-script/0.1 `
                + `(https://github.com/errorcorrectionzoo)`,
            csl_style: csl_style_json_data.data,
        },
        resource_collector_options: {
            resource_types: ['graphics_path'],
            resource_retrievers: {
                graphics_path: new FilesystemResourceRetriever({
                    copy_to_target_directory: false,
                    rename_file_template:
                    (f) => `fig-${f.basenameshort()}.${f.b32hash(4)}${f.lowerext()}`,
                    extensions: [ '', '.svg', '.png', '.jpeg', '.jpg' ],
                    //target_directory: './_output_resource_graphics_files/',
                    fs: _this.config.fs,
                    source_directory:
                    _this.config.llm_processor_graphics_resources_fs_data_dir,
                }),
            },
            resource_processors: {
                'graphics_path': [
                    new LLMGraphicsResourceProcessor({
                        zoo_llm_environment: _this.zoo_llm_environment,
                        fs: _this.config.fs,
                    }),
                ],
            },
        }
    });

    return zoo_llm_processor;
};
