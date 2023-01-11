//
// Map object types and object IDs to site permalinks for where to find their
// corresponding information.
//

export function zoo_object_permalink(object_type, object_id)
{
    if (object_type === 'code') {
        return `/c/${object_id}`;
    } else if (object_type === 'domain') {
        return `/domain/${object_id}`;
    } else if (object_type === 'kingdom') {
        return `/kingdom/${object_id}`;
    } else if (object_type === 'user') {
        return `/team#u-${object_id}`;
    } else if (object_type === 'codelist') {
        // special treatment for the 'all' list:
        if (object_id === 'all') {
            return `/all`;
        }
        return `/list/${object_id}`;
    }

    throw new Error(`Unknown object type ‘${object_type}’`);
}
