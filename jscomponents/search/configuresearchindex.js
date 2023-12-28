import { getLunrCustomOptionsAdvancedSetup } from '@phfaist/zoodbtools_search/lunradvancedsetup';

export const lunrAdvancedOptions = {
    includeNGramsUpTo: 3,
};

export function configureSearchIndex(search_index)
{
    const indexLunrCustomOptions = getLunrCustomOptionsAdvancedSetup(lunrAdvancedOptions);
    search_index.install_lunr_customization(indexLunrCustomOptions);
}
