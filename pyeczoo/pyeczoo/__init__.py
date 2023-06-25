
# import os.path

from javascript import require, globalThis, eval_js


# _cur_dirname = os.path.dirname(__file__)
# _eczoo_sitegen_rootdir = os.path.relpath(os.path.join(_cur_dirname, '..', '..'))
# _eczoodb_dir = os.path.join(_eczoo_sitegen_rootdir, 'eczoodb')
# print(f"{_cur_dirname=}")
# print(f"{_eczoo_sitegen_rootdir=}")
# print(f"{_eczoodb_dir=}")


class _Eczoodblib:

    fs = require('fs')

    def __getattr__(self, key):

        # paths to require() are relative to "calling script"
        module = require(f"../../eczoodb/{key}.js")

        #module = require(os.path.join(_eczoodb_dir, f'{key}.js'))

        setattr(self, key, module)
        return module

    # eczoodb = require(os.path.join(_eczoodb_dir, 'eczoodb.js'))
    # fullopts = require(os.path.join(_eczoodb_dir, 'fullopts.js'))
    # load_yamldb = require(os.path.join(_eczoodb_dir, 'load_yamldb.js'))
    # permalinks = require(os.path.join(_eczoodb_dir, 'permalinks.js'))

eczoodb = _Eczoodblib()



def js2dict(x):
    return {
        k: x[k]
        for k in x
    }

