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
    } else if (object_type === 'space') {
        // TEMPORARY (zoodb 0.3.0 port, part B1): the FLM processor's index
        // has an entry, with an href, for every object, and the spaces have
        // no page.  No content refers to a space.  The href is a placeholder,
        // as were the `zoodbobjectref:` hrefs of the former FLM layer, until
        // the package can leave an object without a page out of the index
        // (reported to the main session).
        return `zoodbobjectref:/space:${object_id}`;
    }

    throw new Error(`Unknown object type ‘${object_type}’`);
}

export function zoo_graphics_resource_permalink(graphics_resource)
{
    return `/fig/${graphics_resource.src_url}`;
}


export const zoo_permalinks = {
    object: zoo_object_permalink,
    graphics_resource: zoo_graphics_resource_permalink,
};
