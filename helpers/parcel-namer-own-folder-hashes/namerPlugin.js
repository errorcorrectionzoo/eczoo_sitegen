const { Namer } = require('@parcel/plugin');

const path = require('path');


function getBundleName(bundle)
{
    let filePath = bundle.getMainEntry()?.filePath;
    let baseFileName = (filePath != null) ? path.basename(filePath) : null;

    // process.stdout.write(
    //     `Custom namer: ‘${filePath}’ of type ‘${bundle.type}’ (ID ‘${bundle.id}’)\n`
    // );
    
    // special cases first
    if (baseFileName === 'favicon.ico' || baseFileName === 'favicon.svg') {

        // use default naming
        return null;

        // Returning "/favicon.ico|svg" gives a weird error that "Bundles must
        // have unique names" -- it seems the namer is called multiple times (?!)
        //
        //return `/${baseFileName}`;
    }

    let stem = 'shared';
    if (filePath != null) {
        stem = path.basename(filePath, path.extname(filePath))
            .replace(/[^a-zA-Z0-9]/g, '')
            .replace('eczoo', 'ecz')
            .replace('quantum', 'q')
            .replace('classical', 'cl')
            .replace(/^[kd]graph/, 'gr')
            .slice(0, 12)
    }
    
    return `vv/${stem}-${bundle.hashReference}.${bundle.type}`;
};


module.exports = new Namer({

    name({ bundle }) {

        const filePath = bundle.getMainEntry()?.filePath;
        //process.stdout.write(`Namer: ‘${filePath}’ ... \n`);

        if (
            !bundle.needsStableName
            // a hard-coded exception that need to be renamed by us:
            || (filePath && filePath.endsWith('/static/icons/eczogimage.png'))
        ) {
            const bname = getBundleName(bundle);
            // process.stdout.write(
            //     `Custom Namer: ‘${filePath}’ (type ‘${bundle.type}’ ID ‘${bundle.id}’) `
            //     + `→ ‘${bname}’\n`
            // );
            return bname;
        }

        // Allow the next namer to handle this bundle.
        return null;
    }

});
