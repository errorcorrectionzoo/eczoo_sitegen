import path from 'path';
import process from 'process';

const __filename = (new URL(import.meta.url)).pathname;
const __dirname = (new URL('.', import.meta.url)).pathname;


export const citationsinfo_cache_dir_default =
    path.join(
        __dirname,
        '..',
        (process.env.ECZOO_CITATIONS_CACHE_DIR ?? '_zoodb_citations_cache')
    );


export const schema_root_dir_default = __dirname;
