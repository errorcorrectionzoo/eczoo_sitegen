import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.use_searchable_text_processor");


import {
    SearchableTextFieldset,
    SearchableTextProcessor,
} from '@phfaist/zoodb/dbprocessor/searchabletext';
import {
    LLMSearchableDocTextValuesAssembler,
} from '@phfaist/zoodb/dbprocessor/searchabletextllm';



export function use_searchable_text_processor(_this)
{
    const searchable_text_doc_values_assembler =
          new LLMSearchableDocTextValuesAssembler({
              zoo_llm_environment: _this.zoo_llm_environment,
          });
    _this.searchable_text_fieldset = new SearchableTextFieldset({
        field_name_title: 'name',
        object_types: ['code',], // only search for codes for now
        assemble_doc_text_values: (doc_values) => 
        searchable_text_doc_values_assembler.assemble_doc_text_values(doc_values),
        //
        // better to specify search exclusions in the schema!
        //exclude_fields: ['avatarurl','gscholaruser','pageurl','zooteam','zoorole']
    });
    let searchable_text_processor = new SearchableTextProcessor(
        _this.searchable_text_fieldset
    );
    return searchable_text_processor;
};
