import pyeczoo.load

eczoodb = pyeczoo.load.load_eczoodb_from_json_data()

print("CSS code information: ", repr(eczoodb.objects.code.css))
