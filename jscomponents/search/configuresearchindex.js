
import { defaultStemmerSkipKeywords } from '@phfaist/zoodbtools_search/lunradvancedsetup';

export const lunrAdvancedOptions = {
    //
    // Internal parameter used for matching whole sentences or pieces of whole sentences.
    // Higher values = more accurate full sentence search results but also much more
    // resource usage.  Empirically, N=3 looks like a good value.
    //
    includeNGramsUpTo: 3,

    //
    // Apply custom "boost" factors to specific search terms.  The value is an integer
    // factor by which to multiply that term's contribution to the score.
    //
    customBoostTerms: {
        code: 0,
    },

    //
    // Minimal search term length from which we start allowing a nonzero edit distance in
    // matching terms.
    //
    autoFuzzMinTermLength: 6,

    //
    // List of words that should not be "stemmed".  E.g.: "Rains" is not a plural form of "rain".
    // "Hamming" is not a conjugated form of "to ham".  Overall, this fixes some weird search results.
    //
    stemmerSkipKeywords: [

        'Hamming',
        'Ising',
        'Rains',

        ... defaultStemmerSkipKeywords,
    ],
};
