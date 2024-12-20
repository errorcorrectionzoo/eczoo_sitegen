import path from 'path';
import process from 'process';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;


export const citationsinfo_cache_dir_default =
    path.join(
        __dirname,
        '..',
        (process.env.ECZOO_CITATIONS_CACHE_DIR ?? '_zoodb_citations_cache')
    );


export const schema_root_dir_default = __dirname;
