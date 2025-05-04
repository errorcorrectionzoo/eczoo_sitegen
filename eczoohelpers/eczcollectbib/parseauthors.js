import debug_module from 'debug';
const debug = debug_module('eczoohelpers_eczcollectbib.parseauthors');


const rx_suffix = /^((Jr\.|Sr\.)|((I{1,3}|IV|V|VI{1,3}|IX|X)\b(?!\.)))\s*/u;
const rx_etal = /^((et\s+al\.?)|\\(emph|textit)\{et\s+al(\.?\}|\}\.?))/iu;

class _TokenConsumer
{
    constructor(s)
    {
        this.s = s;
    }

    remainingString()
    {
        return this.s;
    }

    /**
     * If the given regular expression `rx` is not found in the current state string,
     * then returns `false`.
     * 
     * If the regular expression `rx` is found in the current state string, the following
     * actions are taken:
     * 
     *   - If `toklist` is not null, then the function `mfn(m)` is called with the
     *     match result `m` that was returned by `string.match()`.  The return value
     *     of `mfn()` is appended to the array `toklist`.
     * 
     *   - The internal state string is updated to consume the entire length of the
     *     matched regular expression.
     * 
     *   - This method returns an opaque object (let's call it a `_ConsumeResult`
     *     object) that you can use to restore the state before consuming this element
     *     with `backtrackToBefore()`. Note the returned object evaluates to true in a
     *     boolean context, so you can use it in an `if` statement if you don't
     *     care about the possibility of backtracking to this location.
     * 
     * A custom checkpoint can be used (returned by `_make_checkpoint()`) to specify the
     * point where we should backtrack to in the returned object.  This is useful to
     * implement `consumeXXX()` functions that call several other `consumeYYY()` functions
     * internally, to backtrack to the initial state at the beginning of the call to
     * `consumeXXX()`.
     */
    _consume(rx, toklist=null, mfn=null, checkpoint=null)
    {
        let m = this.s.match(rx);
        if (m == null) {
            return false;
        }
        if (toklist) {
            toklist.push(mfn(m));
        }
        if (checkpoint == null) {
            checkpoint = this._make_checkpoint();
        }
        this.s = this.s.slice(m.index + m[0].length);
        return this._make_consume_result(checkpoint);
    }

    _make_checkpoint()
    {
        return { s : this.s };
    }
    _restore_state(state)
    {
        this.s = state.s;
    }
    _make_consume_result(prev_state)
    {
        return { _prev_state: prev_state };
    }

    /**
     * If you called a consumeXXX() method which successfully consumed a XXX, and
     * then later regret having consumed the XXX element, then you can call this
     * method to restore the state immediately before consuming the XXX element.
     * 
     * Example::
     * 
     *      let consume_result = token_consumer.consumeXXX();
     *      if (consume_result) {
     *          // successfully consumed XXX
     *          ...
     *          // maybe here we realize that we should not have consumed the XXX
     *          // above and we need to backtrack to the state immediately before
     *          // consuming the XXX
     *          token_consumer.backtrackToBefore(consume_result);
     *      }
     * 
     */
    backtrackToBefore(consume_result)
    {
        this._restore_state(consume_result._prev_state);
    }

    /**
     * Call `token_consumer.peek(token_consumer.consumeXXX())` to peek ahead to
     * see if an XXX could be consumed, without actually consuming the XXX token.
     * 
     * The way this works is that the token is first consumed by `consumeXXX()`;
     * the call to `peek()` then restores the initial state if a token was
     * successfully consumed.  The `peek()` function returns `true` if the initial
     * call to consumeXXX() [whose return value is provided as argument to `peek()`]
     * succeeded in reading a token, and `false` otherwise.
     */
    peek(consume_result)
    {
        if (!consume_result) {
            return false;
        }
        this.backtrackToBefore(consume_result);
        return true;
    }


    consumeInitial(toklist)
    {
        if (this.s.match(rx_etal)) {
            // never match "et al".
            return false;
        }
        // match:
        // - "L.", "L", "Yu."
        // - but NOT: "Lichtenberg" (starts with "L"), "O'Connor", "A-Hoy"
        // - yet also: "J.-L."
        return this._consume(
            /^(\p{Lu}\p{M}*)(\.\s*|(?![\p{L}'’\p{Dash_Punctuation}])\s*|(\p{L}\p{M}*)\.\s*)(\p{Dash_Punctuation}(\p{Lu}\p{M}*)(\.\s*|(?![\p{L}'’\p{Dash_Punctuation}])\s*|(\p{L}\p{M}*)\.\s*)){0,2}/u,
            toklist, 
            (m) => m[0].trim(),
        );
    }
    consumeNamePart(toklist)
    {
        if (this.s.match(/^and\b/u)) { // do not match bibtex-like separator "and"
            return false;
        }
        if (this.s.match(rx_etal)) {
            // never match "et al".
            return false;
        }
        return this._consume(
            /^[\p{L}\p{M}'’\p{Dash_Punctuation}]+(\s+|(?!\p{L}))/u,
            toklist,
            (m) => m[0].trim(),
        );
    }
    consumeInitialOrNamePartNotSuffix(toklist)
    {
        if (this.s.match(rx_suffix)) {
            return false;
        }
        return this.consumeInitial(toklist) || this.consumeNamePart(toklist);
    }
    consumeSuffix(toklist)
    {
        return this._consume(
            rx_suffix,
            toklist,
            (m) => m[0].trim(),
        );
    }
    consumeComma(toklist)
    {
        return this._consume(
            /^,\s*/u,
            toklist,
            (m_) => ',',
        );
    }
    consumeAuthorSeparator(toklist)
    {
        // An author separator can be a single comma (,), a semicolumn (;),
        // or a bibtex-style " and " (with possible preceding comma/semicolumn).
        // In addition, we can also use " \and " or " & " or " \& "
        // (with possible preceding comma/semicolumn).
        //
        // NOTE: Careful, this might accidentally match a comma in "Last, First".
        return this._consume(
            /^(\s*[;,]\s*\\?(and\b|&)\s*|\s*\\?(and\b|&)\s*|\s*[;,]\s*)/u,
            toklist, 
            (m_) => ';'
        );
    }
    consumeDefinitiveAuthorSeparator(toklist)
    {
        // will not match a comma in "Last, First".
        return this._consume(
            /^(\s*[;,]\s*\\?(and\b|&)\s*|\s*\\?(and\b|&)\s*|\s*[;]\s*)/u,
            toklist, 
            (m_) => ';'
        );
    }
    consumeEtAl(toklist)
    {
        return this._consume(
            rx_etal,
            toklist, 
            (m) => m[1]
        );
    }

    consumeSpace()
    {
        return this._consume(/^\s*/u);
    }

    consumeBracedName(toklist)
    {
        let checkpoint = this._make_checkpoint();
        this.consumeSpace();
        return this._consume(
            /^\{([^{}]+)\}/u,
            toklist,
            (m) => m[1],
            checkpoint,
        );
    }

    consumeAuthor(toklist, {
        assumeLastCommaFirst,
        assumeFirstLast,
        assumeMiddleNamesAlwaysInitials,
        assumeLastNamesNeverInitials,
        assumeNoSequenceOfLowercaseWords,
    }={})
    {
        // assume that names are given as "Last, First" syntax.
        assumeLastCommaFirst ??= false;
        // assume that names are given as "First Last" syntax.
        assumeFirstLast ??= false;

        if (assumeLastCommaFirst && assumeFirstLast) {
            throw new Error(`Cannot have both assumeLastCommaFirst and assumeFirstLast set.`);
        }

        // Setting this to true can help us split author names correctly.  Specifically,
        // this assumption is that any given name that is not the first given name is
        // always specified as an initial.  Thanks to this assumption, the string
        // "Google, John Doe" is parsed as two authors "Google" and "John Doe", rather
        // than a single author with given names "John Doe" and last name "Google".
        // Indeed, the name "John Doe Google" would have had to been written with an
        // initialized middle name as "Google, John D.".
        assumeMiddleNamesAlwaysInitials ??= false;

        // When using the "Last [Last2...] [Suffix], First [...]" syntax, assume that
        // last names never not contain initials.  [I'M NOT SURE THIS IS A GOOD ASSUMPTION
        // TO MAKE!]
        assumeLastNamesNeverInitials ??= false;

        // Assume that author names do not contain multiple long-ish lowercase words.  This
        // is a useful trick to help avoid catching a publication title as an author name.
        assumeNoSequenceOfLowercaseWords ??= false;

        // Furthermore, we assume that the sequence of last names never begins with an
        // initial.  This helps us immediately decide that "G. Bluhm, Google" as two authors
        // "G. Bluhm" and "Google", rather than an author with last names "G. Bluhm" and first
        // name "Google".


        let aCheckpoint = this._make_checkpoint();
        let mkreturn = (info) =>
            Object.assign({}, this._make_consume_result(aCheckpoint), info)
        ;

        const checkNoSequenceOfLowercaseWords = (v) => {
            let lcwords = v.filter( (s) => s.match(/^\p{Lowercase_Letter}{5,}$/u) );
            debug(`Checking: v=${v} lcwords=${lcwords}`);
            if (lcwords.length >= 2) {
                // more than this many lowercase words of big enough length, that's
                // likely a title!
                this._restore_state(aCheckpoint);
                return false;
            }
            if (v.length == 2 && lcwords.length == 1) {
                // Also problematic if a we have a single long word in a two-part "name"
                // e.g. "About lattices" or "Linear bounds".  Note that we might get very
                // small title names because the presence of a single word "and" causes
                // a split as if we had a whole author name that was given.
                return false;
            }
            return true;
        };

        let atoklist = [];

        if (this.consumeBracedName(atoklist)) {
            // got full name in a brace straight away
            toklist.push({
                family: atoklist.join(' '),
            });
            return mkreturn({ readAsBracedName: true });
        }

        if (!assumeLastCommaFirst && this.consumeInitial(atoklist)) {
            // starts with an initial, so we simply read off the remainder of the name.
            // this logic branch should not be used if we know that authors are specified
            // as Last, First, because here we won't look for a comma.

            // consume any remaining initials -- these are likely given names.
            while (this.consumeInitial(atoklist))
                ;

            let btoklist = [];
            while (this.consumeInitialOrNamePartNotSuffix(btoklist))
                ;

            // if (btoklist.length === 0 && !atoklist[atoklist.length-1].endsWith('.')) {
            //     // it's likely that a short last name (e.g. "Li", "Xu") was confused
            //     // as an initial. 
            // } // ### better: fix consumeInitial() to be less tolerant

            let ctoklist = [];
            while (this.consumeSuffix(ctoklist))
                ;

            let author = {};
            author.given = atoklist.join(' '); // certainly nonempty
            if (btoklist.length) {
                author.family = btoklist.join(' ');
            }
            if (ctoklist.length) {
                author.suffix = ctoklist.join(' ');
            }

            if (assumeNoSequenceOfLowercaseWords &&
                !checkNoSequenceOfLowercaseWords([...atoklist, ...btoklist])) {
                return false;
            }
            toklist.push(author);
            return mkreturn({ rulesOutLastCommaFirstSyntax: true });
        }

        let firstThingInitial = false;
        let firstThingNamePart = false;
        if (this.consumeInitial(atoklist)) {
            firstThingInitial = true;
        } else if (this.consumeNamePart(atoklist)) {
            firstThingNamePart = true;
        }
        if (firstThingInitial || firstThingNamePart) {
            let btoklist = [];
            let suffixtoklist = [];

            // started with a name.  We need to read on to determine how the name is
            // formatted.  Possibilities:
            //
            //    - Last [Last2 ...] [Suffix], First [Mid ...]
            //    - First Last [Last2...] [Suffix]   (+ possible comma separates next author)
            //    - First [Mid ...] Last [Last2 ...] [Suffix]
            //    - ... [mind blown]

            let seenInitials = firstThingInitial;
            let seenSuffixes = false;

            // First, consume any remaining initials -- if any initials are present,
            // they should be packed along in the `atoklist` as they are likely given
            // names.
            while (true) {
                // prevent suffixes from being read as initials...
                while (this.consumeSuffix(suffixtoklist)) {
                    seenSuffixes = true;
                }
                if (seenSuffixes) {
                    break;
                }
                if (this.consumeInitial(atoklist)) {
                    seenInitials = true;
                    continue;
                }
                break;
            }

            // let's go until we see a suffix or a comma.
            while (true) {
                while (this.consumeSuffix(suffixtoklist)) {
                    seenSuffixes = true;
                }
                if (seenSuffixes) {
                    break;
                }
                if (this.consumeInitial(btoklist)) {
                    seenInitials = true;
                    continue;
                }
                if (this.consumeNamePart(btoklist)) {
                    continue;
                }
                break;
            }

            let authorIfFirstLast = null;
            if (btoklist.length) {
                authorIfFirstLast = {
                    given: atoklist.join(' '),
                    family: btoklist.join(' '),
                };
            } else {
                authorIfFirstLast = {
                    family: atoklist.join(' '),
                };
            }
            if (seenSuffixes) {
                authorIfFirstLast.suffix = suffixtoklist.join(' ');
            }

            // If we've read too many lowercase words in this name, it's more likely a
            // publication title rather than an author name, so we should stop here.
            if (assumeNoSequenceOfLowercaseWords &&
                !checkNoSequenceOfLowercaseWords([...atoklist, ...btoklist])) {
                this._restore_state(aCheckpoint);
                return false;
            }
            
            let septoklist;
            if (assumeFirstLast
                || firstThingInitial
                || (assumeLastNamesNeverInitials && seenInitials)
                || this.peek(this.consumeDefinitiveAuthorSeparator(septoklist))) {
                // Note, we assume that last names do not start with an initial.
                // Good, we got a full author name for sure.  Also, now we know
                // that all names are "First Last", no comma.
                toklist.push(authorIfFirstLast);
                return mkreturn({ rulesOutLastCommaFirstSyntax: true });
            }
            let consumeCommaResult = this.consumeComma(septoklist);
            if (!consumeCommaResult) {
                // cannot be "Last, First" because we don't have any comma at this point.
                toklist.push(authorIfFirstLast);
                return mkreturn({ rulesOutLastCommaFirstSyntax: true });
            }
            // this one is a bit tricky; the comma could either be a "Last, First"
            // separator or an author separator.  We begin by assuming it is a
            // "Last, First" separator, until we are proven otherwise.

            // if we are proven otherwise, this function will restore the state to
            // immediately before reading the comma, and return the author name
            // we read until the comma as "First Last" syntax.
            let goBackToBeforeCommaAndReturnNameAsFirstLast = () => {
                this.backtrackToBefore(consumeCommaResult);
                toklist.push(authorIfFirstLast);
                return mkreturn({ rulesOutLastCommaFirstSyntax: true });
            };
            
            let gtoklist = [];
            if (!this.consumeInitialOrNamePartNotSuffix(gtoklist)) {
                // Does not look like a given name(s), not even a name of another
                // author.  Perhaps a braced author name or a title or something like that.
                // Stop before the comma and return what we have.
                return goBackToBeforeCommaAndReturnNameAsFirstLast();
            }
            while (true) {
                if (this.consumeInitial(gtoklist)) {
                    continue;
                }
                if (this.consumeNamePart(gtoklist)) {
                    if (assumeMiddleNamesAlwaysInitials) {
                        // this cannot be part of given names, we already read the
                        // first name and we're not allowed to have further non-initialed
                        // middle names.
                        return goBackToBeforeCommaAndReturnNameAsFirstLast();
                    }
                    continue;
                }
                break;
            }

            // okay, we've got our author name.
            let author = {
                family: [ ...atoklist, ...btoklist ].join(' '),
                given: gtoklist.join(' ')
            };
            if (authorIfFirstLast.suffix) {
                author.suffix = authorIfFirstLast.suffix;
            }
            if (assumeNoSequenceOfLowercaseWords &&
                !checkNoSequenceOfLowercaseWords([...atoklist, ...btoklist, ...gtoklist])) {
                return goBackToBeforeCommaAndReturnNameAsFirstLast();
            }
            toklist.push(author);
            return mkreturn({ readAsLastFirst: true });
        }

        // not an initial, not a name, stop.
        //debug(`Couldn't consume full name at this point in s: s=‘${this.s}’`);

        // we didn't consume anything, but to be sure (and future-proof if I add an
        // innocent consumeSpace() or other above), let's restore the state:
        this._restore_state(aCheckpoint);

        return false;
    }

    consumeFinalPunctuation()
    {
        return this._consume(/^\s*[.:;,]\s*/u);
    }

    consumeAuthorList(toklist, { assumptions, etalValue }={})
    {
        etalValue ??= {family: 'others'}; // "others" as recognized by BibTeX

        let authortoklist = [];
        let septoklist = [];
        let cur_assumptions = Object.assign(
            {
                //
                // We can add any additional base assumptions here, such as:
                //
                //assumeLastCommaFirst|assumeFirstLast: true,
                assumeMiddleNamesAlwaysInitials: true,
                //assumeLastNamesNeverInitials: true,
                assumeNoSequenceOfLowercaseWords: true,
            },
            assumptions ?? {},
        );
        let checkpoint = this._make_checkpoint();

        let readingAsLastFirstFormat = null;
        while (true) {
            // get an author.
            let consume_result = this.consumeAuthor(authortoklist, {...cur_assumptions});
            if (readingAsLastFirstFormat == null && consume_result.readAsLastFirst) {
                readingAsLastFirstFormat = true;
            }
            if (consume_result.rulesOutLastCommaFirstSyntax
                && !cur_assumptions.assumeFirstLast) {
                // new information! Now we know that we should not read the author list
                // as first, last.
                cur_assumptions.assumeFirstLast = true;
                if (readingAsLastFirstFormat) {
                    // we've already read some names using the "Last, First" format -- 
                    // start over!
                    authortoklist = [];
                    readingAsLastFirstFormat = false;
                    this._restore_state(checkpoint);
                    continue;
                }
            }
            // now, get an author separator.
            if (!this.consumeAuthorSeparator(septoklist)) {
                // No author separator here.  We must have reached the end of the author
                // list!
                break;
            }
        }

        if (this.consumeEtAl()) {
            authortoklist.push(etalValue);
        }

        this.consumeFinalPunctuation();

        toklist.push(...authortoklist);
        return this._make_consume_result(checkpoint);
    }
};

// expose some internal stuff for tests :) 
export const _testing = {
    _TokenConsumer,
};



function guessYear(str)
{
    // find last occurrence of something that looks like a year
    let rx_year = /(?:\((\d\d\d\d)\)|(?:\D|^)(\d\d\d\d)(\D|$))/g;
    let lastMatch = null;
    let m = null;
    while ((m = rx_year.exec(str)) != null) {
        lastMatch = m;
    }
    if (!lastMatch) {
        return { year: null, remaining_string_no_year: str };
    }
    let year = parseInt(lastMatch[1] || lastMatch[2]);

    let remaining_string_no_year =
        str.slice(0,lastMatch.index) + str.slice(lastMatch.index + lastMatch[0].length);

    return { year, remaining_string_no_year };
}


/**
 * Returns: An object with the following properties::
 * 
 *     {
 *         author_list: [ { given: 'John', family: 'Doe' }, ... ],
 *         remaining_string: '"My title," Journal of This and That 134:13 (2025)',
 *         remaining_string_no_year: '"My title," Journal of This and That 134:13',
 *         year: 2025
 *     }
 * 
 * You can provide some flags to indicate assumptions that are to be made when parsing
 * the author list::
 *     
 *     assumptions: {
 *         assumeLastCommaFirst: true,
 *         assumeFirstLast: true,
 *         assumeMiddleNamesAlwaysInitials: true,
 *         assumeLastNamesNeverInitials: true,
 *         assumeNoSequenceOfLowercaseWords: true,
 *     }
 * 
 * If "et al." is encountered, then an additional fictitious author is included to
 * represent all omitted authors.  By default, it is ``{family: "others"}`` as understood
 * by BibTeX.  You can supply an alternative object via the `etalValue` option.
 */
export function parseAuthorsYearInfo(full_text_citation, { assumptions, etalValue }={})
{
    let author_list = [];

    let t = new _TokenConsumer(full_text_citation);
    
    let ok = t.consumeAuthorList(author_list, { assumptions, etalValue });

    if (!ok) {
        author_list = [];
    }

    const remaining_string = t.remainingString();

    const { year, remaining_string_no_year } = guessYear(remaining_string);

    return {
        author_list: author_list,
        remaining_string: remaining_string,
        year: year,
        remaining_string_no_year: remaining_string_no_year,
    };
}
