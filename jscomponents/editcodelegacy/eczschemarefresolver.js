

const window_fetch = window.fetch;


export default class EczSchemaRefResolver
{
    constructor() {
        this._fetch_cache = {}
        this._schema_cache = {}
    }

    resolve(schema_path)
    {
        let _this = this;
        if (this._schema_cache.hasOwnProperty(schema_path)) {
            return this._schema_cache[schema_path];
        }
        const result = this._scan( this.fetch_file(schema_path) );
        if (result instanceof Promise) {
            return result.then( (result_obj) => {
                _this._schema_cache[schema_path] = result_obj;
                return result_obj;
            });
        }
        this._schema_cache[schema_path] = result;
        return Promise.resolve( result );
    }

    fetch_file(file)
    {
        if ( this._fetch_cache.hasOwnProperty(file) ) {
            // already in our cache
            return this._fetch_cache[file];
        }
        // need to fetch the file
        return this.do_fetch_file(file);
    }

    do_fetch_file(file)
    {
        let _this = this;
        let filejson = file;
        if (!file.endsWith('.json')) {
            filejson = file + '.json';
        }
        //
        // FIX MY RENAME "ecc.json" -> "code.json"
        // -----
        filejson = filejson.replace(/ecc\.json$/, 'code.json');
        // -----
        //
        let fetch_promise = window_fetch(filejson).then(
            async (response) => {
                const result = await response.json();
                console.log("schema resolver; do_fetch_file. Result = ", result);
                return result;
            }
        );
        this._fetch_cache[file] = fetch_promise;
        return fetch_promise;
    }
    
    _scan(x) {
        let _this = this;
        if (x instanceof Promise) {
            return x.then( (result_obj) => { return _this._scan(result_obj); } );
        }
        if (Array.isArray(x)) {
            return this._scan_array(x);
        } else if (typeof x === 'object') {
            return this._scan_obj(x);
        } else {
            return x;
        }
    }
    _scan_obj(obj) {
        // check for $ref
        if ('$ref' in obj) {
            return this.fetch_file( obj['$ref'] );
        }

        let _this = this;

        let promises = [];
        Object.keys(obj).forEach( (key) => {
            const item = obj[key];
            const val = _this._scan(item);
            if (val instanceof Promise) {
                promises.push( val.then(
                    ((k)=>{ return (result_obj) => { obj[k] = result_obj; } })(key)
                ) );
            } else {
                obj[key] = val;
            }
        });
        if (promises.length == 0) {
            return obj; // no promises that need to be resolved
        } else {
            return Promise.all(promises).then( () => { return obj; } );
        }
    }
    _scan_array(arr) {
        let _this = this;
        let promises = [];
        arr.forEach( (item, index) => {
            const val = _this._scan(item);
            if (val instanceof Promise) {
                promises.push( val.then(
                    ((idx)=>{ return (result_obj) => { arr[idx] = result_obj; } })(index)
                ) );
            } else {
                arr[index] = val;
            }
        });
        if (promises.length == 0) {
            return arr; // no promises that need to be resolved
        } else {
            return Promise.all(promises).then( () => { return arr; } );
        }
    }

};
