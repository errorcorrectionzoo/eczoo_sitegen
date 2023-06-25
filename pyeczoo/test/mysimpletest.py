import json
import os.path
import pyeczoo

EcZooDb = pyeczoo.eczoodb.eczoodb.EcZooDb
get_eczoo_full_options = pyeczoo.eczoodb.fullopts.get_eczoo_full_options
EcZooDbYamlDataLoader = pyeczoo.eczoodb.load_yamldb.EcZooDbYamlDataLoader

default_options = get_eczoo_full_options()
# print(f"{default_options=}")


import javascript


fs_data_dir = os.path.abspath('../eczoodb/test_data')

config = javascript.eval_js('''
return Object.assign({
    fs: pyeczoo.eczoodb.fs,
    fs_data_dir: ''' + json.dumps(fs_data_dir) + ''',
}, default_options);
''')


# config = {
#     'fs': pyeczoo.eczoodb.fs,
#     'fs_data_dir': '../eczoodb/test_data',
# }
# config.update( js2dict(default_options) )


print(f"Using config = {config}")

db = EcZooDb(config)
db.install_zoo_loader(EcZooDbYamlDataLoader())

db.load()

print(f"DB: { db }")
