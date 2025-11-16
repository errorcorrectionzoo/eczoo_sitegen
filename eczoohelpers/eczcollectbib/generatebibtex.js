import debug_module from 'debug';
const debug = debug_module('eczoohelpers_eczcollectbib.generatebibtex');

import fs from 'fs';
import path from 'path';

import { get_builtin_uni2latex_dict } from '@phfaist/zoodb/flm-js/pylatexenc.latexencode.get_builtin_rules';

import CSL from 'citeproc';

function escape_url(url)
{
    return url.replace(/[%#\\]/g, (match) => '\\'+match);
}


const unicodeLatexReplacements = get_builtin_uni2latex_dict();

// const noBibLatexEscapeKeys = [
//     // The ID of the entry & its internal hash
//     'id', '_hash',
//     // Entry type is a standard string, don't try to escape it
//     'type',
//     // Any identifiers, e.g. DOIs, URLs, arXiv numbers, ...
//     'DOI', 'URL', 'ISBN', 'ISSN', 'eprint', 'prefix',
//     // The following fields will be ignored anyways in bibtex export, don't waste time converting them
//     'abstract', 'update-policy', 'source',
// ];


const hardEscapes = {
    BACKSLASHCHAR: '\\',
    BRACE_OPEN: '{',
    BRACE_CLOSE: '}',
};
const hardEscapesNames = [...Object.keys(hardEscapes)];

const _rxHardEscapes = new RegExp("<(" + hardEscapesNames.join('|') + ")\\s*/>", "g");

function replaceHardEscapes(x)
{
    return x.replaceAll(_rxHardEscapes, (match, arg) => hardEscapes[arg]);
}

const _allowedMacrosEverywhere = [ '%', '$', '&', '#', ]
const allowedMacros = [
    'emph', 'textbf', 'textit', 'ensuremath', 'url', 'href', 
    ..._allowedMacrosEverywhere
];
const allowedMathMacros = [
    'mathbb', 'mathsf', 'mathrm', 'mathcal', 'text', 'textup', 'textrm', 'frac',
    'langle', 'rangle',
    ..._allowedMacrosEverywhere
];

function replaceSpecialChar(c)
{
    const replacementCode = unicodeLatexReplacements[c.codePointAt(0)];
    if (replacementCode != null) {
        //debug(`...replacement code for ${specialchar} is ${replacementCode}`);
        // replace by known LaTeX equivalent string.  Make sure we include any trailing
        // braces to protect a macro name!
        if (/\\[a-zA-Z]+$/u.test(replacementCode)) {
            // looks like the replacement code finishes with a macro with a name, add protective
            // braces around the entire replacement string.
            return '{' + replacementCode + '}';
        }
        return replacementCode;
    }
    // unknown char, use '?' for safety
    return '?';
}

function cheapTextLatexEscapeMath(x)
{
    return x.replaceAll(
        /((?:\\|<BACKSLASHCHAR\s*\/>)([a-zA-Z]+|.))|((?:<(?:BRACE_OPEN|BRACE_CLOSE)\s*\/>)|[{}_^])|([\\%#]|[^\u0020-\u007F])/ug,
        (match, macro, macroname, safe, specialchar) => {
            if (macro != null) {
                if (allowedMathMacros.includes(macroname)) {
                    return macro;
                }
                debug(`Removing unallowed macro in math mode: \\${macroname}`);
                return '\\string'+macro; // print unallowed macro verbatim
                //return ''; // remove unallowed macro
            }
            if (safe != null) {
                return safe;
            }
            if (specialchar != null) {
                return replaceSpecialChar(specialchar);
            }
            throw new Error(`Got unknown case??? ‘${match}’`);
        }
    );
}

function cheapTextLatexEscape(x)
{
    //debug(`cheapTextLatexEscape():`, x);
    return x.replaceAll(
        /((?:\$\$?|(?:\\|<BACKSLASHCHAR\s*\/>)[([])(.*?)(?:\$\$?|(?:\\|<BACKSLASHCHAR\s*\/>)[)\]]))|((?:\\|<BACKSLASHCHAR\s*\/>)([a-zA-Z]+|.))|((?:<(?:BRACE_OPEN|BRACE_CLOSE)\s*\/>)|[{}])|([_^\\%#$]|[^\u0020-\u007F])/ug,
        (match, mathinline, mathinlinecontent, macro, macroname, safe, specialchar) => {
            if (mathinline != null) {
                //debug(`Replacing math inline! `, {mathinline});
                return '$' + cheapTextLatexEscapeMath(mathinlinecontent) + '$';
            }
            if (macro != null) {
                if (allowedMacros.includes(macroname)) {
                    return macro;
                }
                debug(`Removing unallowed macro (text mode): \\${macroname}`);
                return '\\string'+macro; // print unallowed macro verbatim
                //return ''; // remove unallowed macro
            }
            if (safe != null) {
                return safe;
            }
            if (specialchar != null) {
                return replaceSpecialChar(specialchar);
            }
            throw new Error(`Got unknown case??? ‘${match}’`);
        }
    );
}

const decodeXmlEntities = { 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'amp': '&' };

function bibtexTextEscape(text)
{
    // the actual bibtex content will be passed here, so don't do any fancy escaping...

    let text2 = (text ?? '');

    // some sources (incl. DOI/crossref lookups) include weird XML and entities that will confuse
    // LaTeX. Remove all of that.
    // Some sources have even multiply-encoded &amp;s.  In a first round, take care of all the
    // &amp;s recursively, like &amp;lt;&amp;amp;&amp;gt; -> &lt;&&gt;
    while (/&amp;/.test(text2)) {
        text2 = text2.replaceAll(/&amp;/g, '&');
    }
    // all remaining XML content, but NOT our special internal tags!:
    text2 = text2.replaceAll(
        /<\/?([a-zA-Z-]+)(\s+[^>]*|\/)?>/g,
        (match, tagName) => {
            if (hardEscapesNames.includes(tagName)) {
                return match;
            }
            return ''; // strip out this tag
        }
    );
    // all remaining XML entities:
    text2 = text2.replaceAll(
        new RegExp("&(" + Object.keys(decodeXmlEntities).join("|") + ");", 'g'),
        (_, entityName) => decodeXmlEntities[entityName]
    )

    // Do some heavy escaping. Do not leave stuff that might confuse LaTeX.
    // no newlines
    text2 = text2.replaceAll('\n', ' ');
    // escape any remaining special syntax that could confuse latex, escape _'s and &'s, etc.
    text2 = cheapTextLatexEscape(text2)

    // ensure that braces are balanced!!  We're trying to be tolerant here, so try to add
    // some braces to balance them if they aren't.  We might have inputs with unbalanced
    // braces coming from "anystyle"'s output, for instance.
    let openBraces = 0;
    for (let j = 0; j < text2.length; ++j) {
        if (text2.charAt(j) === '{') { // <BRACE_OPEN/> should not count here, see below.
            openBraces += 1;
        } else if (text2.charAt(j) === '}') {
            openBraces -= 1;
        }
    }
    // If openBraces !== 0, fix by including initial or final braces.
    if (openBraces < 0) {
        debug(`WARNING: Too many closing braces in bibtex text output “${text2}”!`);
        text2 = '{'.repeat(-openBraces) + text2;
    } else if (openBraces > 0) {
        debug(`WARNING: Missing closing braces in bibtex text output “${text2}”!`);
        text2 = text2 + '}'.repeat(openBraces);
    }

    // - I ran into bugs where '\' chars were simply omitted in some instance.  Here's
    //   a terribly dirty hack to make sure they're restored.  In a similar vein, sometimes
    //   some braces should not count towards the mandatory balancing done above (e.g., the 
    //   "prefix" and "suffix" values in the bibtex csl style, which contain opening and
    //   closing braces, respectively).  We fix these cases with "hard escapes" with special
    //   placeholders of the form <BACKSLASHCHAR/> or <BRACE_OPEN/>.  Replace them here.
    //
    text2 = replaceHardEscapes(text2 ?? '');

    //debug(`Escaping text: ${JSON.stringify(text)} -> ${JSON.stringify(text2)}`);

    return text2;
}


export const _testing = {
    bibtexTextEscape,
    cheapTextLatexEscape,
};


CSL.Output.Formats.bibtexlatex = {
    // set this from inner functions ... :/
    //flm_environment: null,
    //recomposer: null,

    //
    // text_escape: Format-specific function for escaping text destined
    // for output.  Takes the text to be escaped as sole argument.  Function
    // will be run only once across each portion of text to be escaped, it
    // need not be idempotent.
    //
    "text_escape": bibtexTextEscape,
    "bibstart": "",
    "bibend": "",
    "@font-style/italic": "\\emph{%%STRING%%}",
    "@font-style/oblique": "\\emph{%%STRING%%}",
    "@font-style/normal": false, // "%%STRING%%",
    "@font-variant/small-caps": "\\textsc{%%STRING%%}",
    "@passthrough/true": CSL.Output.Formatters.passthrough,
    "@font-variant/normal": false, //"%%STRING%%",
    "@font-weight/bold": "\\textbf{%%STRING%%}",
    "@font-weight/normal": false, //"%%STRING%%",
    "@font-weight/light": false,
    "@text-decoration/none": false, //"%%STRING%%",
    "@text-decoration/underline": false, //"%%STRING%%",
    "@vertical-align/sup": "\\ensuremath{{}^{\\text{%%STRING%%}}}",
    "@vertical-align/sub": "\\ensuremath{{}_{\\text{%%STRING%%}}}",
    "@vertical-align/baseline": false, //"%%STRING%%",
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
    "@quotes/true": function (state, str) {
        if ("undefined" === typeof str) {
            return state.getTerm("open-quote");
        }
        return state.getTerm("open-quote") + str + state.getTerm("close-quote");
    },
    "@quotes/inner": function (state, str) {
        if ("undefined" === typeof str) {
            //
            // Mostly right by being wrong (for apostrophes)
            //
            return "\u2019";
        }
        return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
    },
    "@quotes/false": false,
    "@cite/entry": function (state, str) {
        return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt,
                                           this.suffix_txt);
    },
    "@bibliography/entry": function (state, str) {
        // Test for this.item_id to add decorations to
        // bibliography output of individual entries.
        //
        // Full item content can be obtained from
        // state.registry.registry[id].ref, using
        // CSL variable keys.
        //
        // Example:
        //
        //   print(state.registry.registry[this.item_id].ref["title"]);
        //
        // At present, for parallel citations, only the
        // id of the master item is supplied on this.item_id.
        var insert = "";
        if (state.sys.embedBibliographyEntry) {
            insert = state.sys.embedBibliographyEntry(this.item_id) + "\n";
        }
        //return "  <div class=\"csl-entry\">" + str + "</div>\n" + insert;
        return str + '\n' + insert;
    },
    "@display/block": function (state, str) {
        return str; //"\n\n    <div class=\"csl-block\">" + str + "</div>\n";
    },
    "@display/left-margin": function (state, str) {
        return str; // "\n    <div class=\"csl-left-margin\">" + str + "</div>";
    },
    "@display/right-inline": function (state, str) {
        return str; // "<div class=\"csl-right-inline\">" + str + "</div>\n  ";
    },
    "@display/indent": function (state, str) {
        return str; // "<div class=\"csl-indent\">" + str + "</div>\n  ";
    },
    "@showid/true": function (state, str, /*cslid*/) {
        return str;
    },
    "@URL/true": function (state, str) {
        return "\\bibUrl{" + escape_url(str) + "}";
    },
    "@DOI/true": function (state, str) {
        // var doiurl = str;
        // if (!str.match(/^https?:\/\//)) {
        //     doiurl = "https://doi.org/" + str;
        // }
        return "\\bibDoi{" + escape_url(str) + "}";
    }
};

const bibtex_csl_fname = path.join(import.meta.dirname, 'bibtex--patched.csl');




/**
 * The `bib_db` is an object with keys that are the citation keys and values
 * that are objects of the type { csl_json: {...} }.  It is meant to be used
 * with the `bib_db` stored by a `EczBibReferencesCollector` instance in
 * `collectbib.js`.
 * 
 * The `computeEntryBibtexKey()` callback, if provided, will be called to
 * determine what BibTeX key a given item should be given.  The callback
 * is given one argument, the object that is a value in `bib_db` (and which
 * contains the key 'csl_json').
 */
export function generateBibtex(bib_db, { computeEntryBibtexKey, }={})
{
    const csl_style = fs.readFileSync(bibtex_csl_fname, {
        encoding: 'utf-8'
    });
    debug(`csl_style = ${csl_style.slice(0,50)}...`);

    let csljsonObjects = {};
    // make sure all citeKeys/ID's are UNIQUE!
    for (const v of Object.values(bib_db)) {
        const citeKeyBase =
            computeEntryBibtexKey
            ? computeEntryBibtexKey(v)
            : (v.cite_prefix_key_clean ?? `idX`);
        let csljsonObject = Object.assign({}, v.jsondata);
        let citeKey = citeKeyBase;
        let n = 0;
        while (csljsonObjects[citeKey] != null) {
            // citeKey already exists
            console.warn(`Duplicate citation key ‘${citeKey}’!`);
            ++n;
            citeKey = `${citeKeyBase}${n}`;
        }
        csljsonObject.id = citeKey;
        csljsonObject.key = citeKey;
        csljsonObjects[citeKey] = csljsonObject;
    }

    const citeproc_sys_object = {
        retrieveLocale: (lang_) => {
            return citeproc_locales_en_US;
        },
        retrieveItem: (id) => {
            const citeKey = id;
            const csljsonObject = csljsonObjects[citeKey];
            if (csljsonObject == null) {
                throw new Error(`Bib item ‘${citeKey}’ not found`);
            }
            // Any manual fixes to be applied here.  There appears to be a bug where
            // if the "note" field begins with "\emph{", then the backslash gets omitted.
            // WTF?? Try a hack around that.
            for (const [k,v] of Object.entries(csljsonObject)) {
                if (v && typeof v === 'string') {
                    csljsonObject[k] = v.replaceAll('\\', '<BACKSLASHCHAR/>');
                }
            }
            //debug(`Retrieved item:`, csljsonObject);
            return csljsonObject;
        }
    };

    // fs.writeFileSync('./_IUYEUIHDTEMPVALUDATA.json', JSON.stringify(
    //     Object.fromEntries( Object.entries(bib_db_safe).map(([k,v]) => [k, {
    //         csl_json: v.csl_json,
    //         cite_prefix: v.cite_prefix,
    //         cite_key: v.cite_key,
    //         cite_prefix_key: v.cite_prefix_key,
    //         cite_prefix_key_clean: v.cite_prefix_key_clean,
    //         sort_key: v.sort_key,
    //     }]) )
    // ));

    const output_format = 'bibtexlatex';

    let cite_processor = new CSL.Engine(citeproc_sys_object, csl_style);
    cite_processor.setOutputFormat(output_format);

    debug(`Generating bibtex keys, all bibtex keys are =`, [ ...Object.keys(csljsonObjects) ].join(','));
    
    cite_processor.updateItems( [ ...Object.keys(csljsonObjects) ] );
    const c_result = cite_processor.makeBibliography();

    if (!c_result) {
        throw new Error(`Could not CSL-compile citation text to bibtex!`);
    }

    const bibtex_entries = [ ... c_result[1] ];
    
    return bibtex_entries;
}







//
// The following locale XML file contents was downloaded from
//
//   https://github.com/citation-style-language/locales
//
// (Download link is:
// https://raw.githubusercontent.com/citation-style-language/locales/master/locales-en-US.xml)
//
// Licensing: “All the locale files in this repository are released under the
// Creative Commons Attribution-ShareAlike 3.0 Unported license. For
// attribution, any software using CSL locale files from this repository must
// include a clear mention of the CSL project and a link to
// CitationStyles.org. When distributing these locale files, the listings of
// translators in the locale metadata must be kept as is.”
//
const citeproc_locales_en_US = `<?xml version="1.0" encoding="utf-8"?>
<locale xmlns="http://purl.org/net/xbiblio/csl" version="1.0" xml:lang="en-US">
  <info>
    <translator>
      <name>Andrew Dunning</name>
    </translator>
    <translator>
      <name>Sebastian Karcher</name>
    </translator>
    <translator>
      <name>Rintze M. Zelle</name>
    </translator>
    <translator>
      <name>Denis Meier</name>
    </translator>
    <translator>
      <name>Brenton M. Wiernik</name>
    </translator>
    <rights license="http://creativecommons.org/licenses/by-sa/3.0/">This work is licensed under a Creative Commons Attribution-ShareAlike 3.0 License</rights>
    <updated>2015-10-10T23:31:02+00:00</updated>
  </info>
  <style-options punctuation-in-quote="true"/>
  <date form="text">
    <date-part name="month" suffix=" "/>
    <date-part name="day" suffix=", "/>
    <date-part name="year"/>
  </date>
  <date form="numeric">
    <date-part name="month" form="numeric-leading-zeros" suffix="/"/>
    <date-part name="day" form="numeric-leading-zeros" suffix="/"/>
    <date-part name="year"/>
  </date>
  <terms>
    <term name="advance-online-publication">advance online publication</term>
    <term name="album">album</term>
    <term name="audio-recording">audio recording</term>
    <term name="film">film</term>
    <term name="henceforth">henceforth</term>
    <term name="loc-cit">loc. cit.</term> <!-- like ibid., the abbreviated form is the regular form  -->
    <term name="no-place">no place</term>
    <term name="no-place" form="short">n.p.</term>
    <term name="no-publisher">no publisher</term> <!-- sine nomine -->
    <term name="no-publisher" form="short">n.p.</term>
    <term name="on">on</term>
    <term name="op-cit">op. cit.</term> <!-- like ibid., the abbreviated form is the regular form  -->
    <term name="original-work-published">original work published</term>
    <term name="personal-communication">personal communication</term>
    <term name="podcast">podcast</term>
    <term name="podcast-episode">podcast episode</term>
    <term name="preprint">preprint</term>
    <term name="radio-broadcast">radio broadcast</term>
    <term name="radio-series">radio series</term>
    <term name="radio-series-episode">radio series episode</term>
    <term name="special-issue">special issue</term>
    <term name="special-section">special section</term>
    <term name="television-broadcast">television broadcast</term>
    <term name="television-series">television series</term>
    <term name="television-series-episode">television series episode</term>
    <term name="video">video</term>
    <term name="working-paper">working paper</term>
    <term name="accessed">accessed</term>
    <term name="and">and</term>
    <term name="and others">and others</term>
    <term name="anonymous">anonymous</term>
    <term name="anonymous" form="short">anon.</term>
    <term name="at">at</term>
    <term name="available at">available at</term>
    <term name="by">by</term>
    <term name="circa">circa</term>
    <term name="circa" form="short">c.</term>
    <term name="cited">cited</term>
    <term name="edition">
      <single>edition</single>
      <multiple>editions</multiple>
    </term>
    <term name="edition" form="short">ed.</term>
    <term name="et-al">et al.</term>
    <term name="forthcoming">forthcoming</term>
    <term name="from">from</term>
    <term name="ibid">ibid.</term>
    <term name="in">in</term>
    <term name="in press">in press</term>
    <term name="internet">internet</term>
    <term name="interview">interview</term>
    <term name="letter">letter</term>
    <term name="no date">no date</term>
    <term name="no date" form="short">n.d.</term>
    <term name="online">online</term>
    <term name="presented at">presented at the</term>
    <term name="reference">
      <single>reference</single>
      <multiple>references</multiple>
    </term>
    <term name="reference" form="short">
      <single>ref.</single>
      <multiple>refs.</multiple>
    </term>
    <term name="retrieved">retrieved</term>
    <term name="scale">scale</term>
    <term name="version">version</term>

    <!-- LONG ITEM TYPE FORMS -->
    <term name="article">preprint</term>
    <term name="article-journal">journal article</term>
    <term name="article-magazine">magazine article</term>
    <term name="article-newspaper">newspaper article</term>
    <term name="bill">bill</term>
    <term name="book">book</term>
    <term name="broadcast">broadcast</term>
    <term name="chapter">book chapter</term>
    <term name="classic">classic</term>
    <term name="collection">collection</term>
    <term name="dataset">dataset</term>
    <term name="document">document</term>
    <term name="entry">entry</term>
    <term name="entry-dictionary">dictionary entry</term>
    <term name="entry-encyclopedia">encyclopedia entry</term>
    <term name="event">event</term>
    <!-- figure is in the list of locator terms -->
    <term name="graphic">graphic</term>
    <term name="hearing">hearing</term>
    <term name="interview">interview</term>
    <term name="legal_case">legal case</term>
    <term name="legislation">legislation</term>
    <term name="manuscript">manuscript</term>
    <term name="map">map</term>
    <term name="motion_picture">video recording</term>
    <term name="musical_score">musical score</term>
    <term name="pamphlet">pamphlet</term>
    <term name="paper-conference">conference paper</term>
    <term name="patent">patent</term>
    <term name="performance">performance</term>
    <term name="periodical">periodical</term>
    <term name="personal_communication">personal communication</term>
    <term name="post">post</term>
    <term name="post-weblog">blog post</term>
    <term name="regulation">regulation</term>
    <term name="report">report</term>
    <term name="review">review</term>
    <term name="review-book">book review</term>
    <term name="software">software</term>
    <term name="song">audio recording</term>
    <term name="speech">presentation</term>
    <term name="standard">standard</term>
    <term name="thesis">thesis</term>
    <term name="treaty">treaty</term>
    <term name="webpage">webpage</term>

    <!-- SHORT ITEM TYPE FORMS -->
    <term name="article-journal" form="short">journal art.</term>
    <term name="article-magazine" form="short">mag. art.</term>
    <term name="article-newspaper" form="short">newspaper art.</term>
    <term name="book" form="short">bk.</term>
    <term name="chapter" form="short">bk. chap.</term>
    <term name="document" form="short">doc.</term>
    <!-- figure is in the list of locator terms -->
    <term name="graphic" form="short">graph.</term>
    <term name="interview" form="short">interv.</term>
    <term name="manuscript" form="short">MS</term>
    <term name="motion_picture" form="short">video rec.</term>
    <term name="report" form="short">rep.</term>
    <term name="review" form="short">rev.</term>
    <term name="review-book" form="short">bk. rev.</term>
    <term name="song" form="short">audio rec.</term>

    <!-- HISTORICAL ERA TERMS -->
    <term name="ad">AD</term>
    <term name="bc">BC</term>
    <term name="bce">BCE</term>
    <term name="ce">CE</term>

    <!-- PUNCTUATION -->
    <term name="open-quote">“</term>
    <term name="close-quote">”</term>
    <term name="open-inner-quote">‘</term>
    <term name="close-inner-quote">’</term>
    <term name="page-range-delimiter">–</term>
    <term name="colon">:</term>
    <term name="comma">,</term>
    <term name="semicolon">;</term>

    <!-- ORDINALS -->
    <term name="ordinal">th</term>
    <term name="ordinal-01">st</term>
    <term name="ordinal-02">nd</term>
    <term name="ordinal-03">rd</term>
    <term name="ordinal-11">th</term>
    <term name="ordinal-12">th</term>
    <term name="ordinal-13">th</term>

    <!-- LONG ORDINALS -->
    <term name="long-ordinal-01">first</term>
    <term name="long-ordinal-02">second</term>
    <term name="long-ordinal-03">third</term>
    <term name="long-ordinal-04">fourth</term>
    <term name="long-ordinal-05">fifth</term>
    <term name="long-ordinal-06">sixth</term>
    <term name="long-ordinal-07">seventh</term>
    <term name="long-ordinal-08">eighth</term>
    <term name="long-ordinal-09">ninth</term>
    <term name="long-ordinal-10">tenth</term>

    <!-- LONG LOCATOR FORMS -->
    <term name="act">			 
      <single>act</single>
      <multiple>acts</multiple>						 
    </term>
    <term name="appendix">			 
      <single>appendix</single>
      <multiple>appendices</multiple>						 
    </term>
    <term name="article-locator">			 
      <single>article</single>
      <multiple>articles</multiple>						 
    </term>
    <term name="canon">			 
      <single>canon</single>
      <multiple>canons</multiple>						 
    </term>
    <term name="elocation">			 
      <single>location</single>
      <multiple>locations</multiple>						 
    </term>
    <term name="equation">			 
      <single>equation</single>
      <multiple>equations</multiple>						 
    </term>
    <term name="rule">			 
      <single>rule</single>
      <multiple>rules</multiple>						 
    </term>
    <term name="scene">			 
      <single>scene</single>
      <multiple>scenes</multiple>						 
    </term>
    <term name="table">			 
      <single>table</single>
      <multiple>tables</multiple>						 
    </term>
    <term name="timestamp"> <!-- generally blank -->
      <single></single>
      <multiple></multiple>						 
    </term>
    <term name="title-locator">			 
      <single>title</single>
      <multiple>titles</multiple>						 
    </term>
    <term name="book">
      <single>book</single>
      <multiple>books</multiple>
    </term>
    <term name="chapter">
      <single>chapter</single>
      <multiple>chapters</multiple>
    </term>
    <term name="column">
      <single>column</single>
      <multiple>columns</multiple>
    </term>
    <term name="figure">
      <single>figure</single>
      <multiple>figures</multiple>
    </term>
    <term name="folio">
      <single>folio</single>
      <multiple>folios</multiple>
    </term>
    <term name="issue">
      <single>number</single>
      <multiple>numbers</multiple>
    </term>
    <term name="line">
      <single>line</single>
      <multiple>lines</multiple>
    </term>
    <term name="note">
      <single>note</single>
      <multiple>notes</multiple>
    </term>
    <term name="opus">
      <single>opus</single>
      <multiple>opera</multiple>
    </term>
    <term name="page">
      <single>page</single>
      <multiple>pages</multiple>
    </term>
    <term name="number-of-pages">
      <single>page</single>
      <multiple>pages</multiple>
    </term>
    <term name="paragraph">
      <single>paragraph</single>
      <multiple>paragraphs</multiple>
    </term>
    <term name="part">
      <single>part</single>
      <multiple>parts</multiple>
    </term>
    <term name="section">
      <single>section</single>
      <multiple>sections</multiple>
    </term>
    <term name="sub-verbo">
      <single>sub verbo</single>
      <multiple>sub verbis</multiple>
    </term>
    <term name="verse">
      <single>verse</single>
      <multiple>verses</multiple>
    </term>
    <term name="volume">
      <single>volume</single>
      <multiple>volumes</multiple>
    </term>

    <!-- SHORT LOCATOR FORMS -->
    <term name="appendix" form="short">			 
      <single>app.</single>
      <multiple>apps.</multiple>						 
    </term>
    <term name="article-locator" form="short">			 
      <single>art.</single>
      <multiple>arts.</multiple>
    </term>
    <term name="elocation" form="short">			 
      <single>loc.</single>
      <multiple>locs.</multiple>
    </term>
    <term name="equation" form="short">			 
      <single>eq.</single>
      <multiple>eqs.</multiple>
    </term>
    <term name="rule" form="short">			 
      <single>r.</single>
      <multiple>rr.</multiple>						 
    </term>
    <term name="scene" form="short">			 
      <single>sc.</single>
      <multiple>scs.</multiple>						 
    </term>
    <term name="table" form="short">			 
      <single>tbl.</single>
      <multiple>tbls.</multiple>						 
    </term>
    <term name="timestamp" form="short"> <!-- generally blank -->
      <single></single>
      <multiple></multiple>						 
    </term>
    <term name="title-locator" form="short">			 
      <single>tit.</single>
      <multiple>tits.</multiple>
    </term>
    <term name="book" form="short">
      <single>bk.</single>
      <multiple>bks.</multiple>
    </term>
    <term name="chapter" form="short">
      <single>chap.</single>
      <multiple>chaps.</multiple>
    </term>
    <term name="column" form="short">
      <single>col.</single>
      <multiple>cols.</multiple>
    </term>
    <term name="figure" form="short">
      <single>fig.</single>
      <multiple>figs.</multiple>
    </term>
    <term name="folio" form="short">
      <single>fol.</single>
      <multiple>fols.</multiple>
    </term>
    <term name="issue" form="short">
      <single>no.</single>
      <multiple>nos.</multiple>
    </term>
    <term name="line" form="short">
      <single>l.</single>
      <multiple>ll.</multiple>
    </term>
    <term name="note" form="short">
      <single>n.</single>
      <multiple>nn.</multiple>
    </term>
    <term name="opus" form="short">
      <single>op.</single>
      <multiple>opp.</multiple>
    </term>
    <term name="page" form="short">
      <single>p.</single>
      <multiple>pp.</multiple>
    </term>
    <term name="number-of-pages" form="short">
      <single>p.</single>
      <multiple>pp.</multiple>
    </term>
    <term name="paragraph" form="short">
      <single>para.</single>
      <multiple>paras.</multiple>
    </term>
    <term name="part" form="short">
      <single>pt.</single>
      <multiple>pts.</multiple>
    </term>
    <term name="section" form="short">
      <single>sec.</single>
      <multiple>secs.</multiple>
    </term>
    <term name="sub-verbo" form="short">
      <single>s.v.</single>
      <multiple>s.vv.</multiple>
    </term>
    <term name="verse" form="short">
      <single>v.</single>
      <multiple>vv.</multiple>
    </term>
    <term name="volume" form="short">
      <single>vol.</single>
      <multiple>vols.</multiple>
    </term>

    <!-- SYMBOL LOCATOR FORMS -->
    <term name="paragraph" form="symbol">
      <single>¶</single>
      <multiple>¶¶</multiple>
    </term>
    <term name="section" form="symbol">
      <single>§</single>
      <multiple>§§</multiple>
    </term>

    <!-- LONG ROLE FORMS -->
    <term name="chair">
      <single>chair</single>
      <multiple>chairs</multiple>
    </term>
    <term name="compiler">
      <single>compiler</single>
      <multiple>compilers</multiple>
    </term>
    <term name="contributor">
      <single>contributor</single>
      <multiple>contributors</multiple>
    </term>
    <term name="curator">
      <single>curator</single>
      <multiple>curators</multiple>
    </term>
    <term name="executive-producer">
      <single>executive producer</single>
      <multiple>executive producers</multiple>
    </term>
    <term name="guest">
      <single>guest</single>
      <multiple>guests</multiple>
    </term>
    <term name="host">
      <single>host</single>
      <multiple>hosts</multiple>
    </term>
    <term name="narrator">
      <single>narrator</single>
      <multiple>narrators</multiple>
    </term>
    <term name="organizer">
      <single>organizer</single>
      <multiple>organizers</multiple>
    </term>
    <term name="performer">
      <single>performer</single>
      <multiple>performers</multiple>
    </term>
    <term name="producer">
      <single>producer</single>
      <multiple>producers</multiple>
    </term>
    <term name="script-writer">
      <single>writer</single>
      <multiple>writers</multiple>
    </term>
    <term name="series-creator">
      <single>series creator</single>
      <multiple>series creators</multiple>
    </term>
    <term name="director">
      <single>director</single>
      <multiple>directors</multiple>
    </term>
    <term name="editor">
      <single>editor</single>
      <multiple>editors</multiple>
    </term>
    <term name="editorial-director">
      <single>editor</single>
      <multiple>editors</multiple>
    </term>
    <term name="illustrator">
      <single>illustrator</single>
      <multiple>illustrators</multiple>
    </term>
    <term name="translator">
      <single>translator</single>
      <multiple>translators</multiple>
    </term>
    <term name="editortranslator">
      <single>editor &amp; translator</single>
      <multiple>editors &amp; translators</multiple>
    </term>

    <!-- SHORT ROLE FORMS -->
    <term name="compiler" form="short">
      <single>comp.</single>
      <multiple>comps.</multiple>
    </term>
    <term name="contributor" form="short">
      <single>contrib.</single>
      <multiple>contribs.</multiple>
    </term>
    <term name="curator" form="short">
      <single>cur.</single>
      <multiple>curs.</multiple>
    </term>
    <term name="executive-producer" form="short">
      <single>exec. prod.</single>
      <multiple>exec. prods.</multiple>
    </term>
    <term name="narrator" form="short">
      <single>narr.</single>
      <multiple>narrs.</multiple>
    </term>
    <term name="organizer" form="short">
      <single>org.</single>
      <multiple>orgs.</multiple>
    </term>
    <term name="performer" form="short">
      <single>perf.</single>
      <multiple>perfs.</multiple>
    </term>
    <term name="producer" form="short">
      <single>prod.</single>
      <multiple>prods.</multiple>
    </term>
    <term name="script-writer" form="short">
      <single>writ.</single>
      <multiple>writs.</multiple>
    </term>
    <term name="series-creator" form="short">
      <single>cre.</single>
      <multiple>cres.</multiple>
    </term>
    <term name="director" form="short">
      <single>dir.</single>
      <multiple>dirs.</multiple>
    </term>
    <term name="editor" form="short">
      <single>ed.</single>
      <multiple>eds.</multiple>
    </term>
    <term name="editorial-director" form="short">
      <single>ed.</single>
      <multiple>eds.</multiple>
    </term>
    <term name="illustrator" form="short">
      <single>ill.</single>
      <multiple>ills.</multiple>
    </term>
    <term name="translator" form="short">
      <single>tran.</single>
      <multiple>trans.</multiple>
    </term>
    <term name="editortranslator" form="short">
      <single>ed. &amp; tran.</single>
      <multiple>eds. &amp; trans.</multiple>
    </term>

    <!-- VERB ROLE FORMS -->
    <term name="chair" form="verb">chaired by</term>
    <term name="compiler" form="verb">compiled by</term>
    <term name="contributor" form="verb">with</term>
    <term name="curator" form="verb">curated by</term>
    <term name="executive-producer" form="verb">executive produced by</term>
    <term name="guest" form="verb">with guest</term>
    <term name="host" form="verb">hosted by</term>
    <term name="narrator" form="verb">narrated by</term>
    <term name="organizer" form="verb">organized by</term>
    <term name="performer" form="verb">performed by</term>
    <term name="producer" form="verb">produced by</term>
    <term name="script-writer" form="verb">written by</term>
    <term name="series-creator" form="verb">created by</term>
    <term name="container-author" form="verb">by</term>
    <term name="director" form="verb">directed by</term>
    <term name="editor" form="verb">edited by</term>
    <term name="editorial-director" form="verb">edited by</term>
    <term name="illustrator" form="verb">illustrated by</term>
    <term name="interviewer" form="verb">interview by</term>
    <term name="recipient" form="verb">to</term>
    <term name="reviewed-author" form="verb">by</term>
    <term name="translator" form="verb">translated by</term>
    <term name="editortranslator" form="verb">edited &amp; translated by</term>

    <!-- SHORT VERB ROLE FORMS -->
    <term name="compiler" form="verb-short">comp. by</term>
    <term name="contributor" form="verb-short">w.</term>
    <term name="curator" form="verb-short">cur. by</term>
    <term name="executive-producer" form="verb-short">exec. prod. by</term>
    <term name="guest" form="verb-short">w. guest</term>
    <term name="host" form="verb-short">hosted by</term>
    <term name="narrator" form="verb-short">narr. by</term>
    <term name="organizer" form="verb-short">org. by</term>
    <term name="performer" form="verb-short">perf. by</term>
    <term name="producer" form="verb-short">prod. by</term>
    <term name="script-writer" form="verb-short">writ. by</term>
    <term name="series-creator" form="verb-short">cre. by</term>
    <term name="director" form="verb-short">dir. by</term>
    <term name="editor" form="verb-short">ed. by</term>
    <term name="editorial-director" form="verb-short">ed. by</term>
    <term name="illustrator" form="verb-short">illus. by</term>
    <term name="translator" form="verb-short">trans. by</term>
    <term name="editortranslator" form="verb-short">ed. &amp; trans. by</term>

    <!-- LONG MONTH FORMS -->
    <term name="month-01">January</term>
    <term name="month-02">February</term>
    <term name="month-03">March</term>
    <term name="month-04">April</term>
    <term name="month-05">May</term>
    <term name="month-06">June</term>
    <term name="month-07">July</term>
    <term name="month-08">August</term>
    <term name="month-09">September</term>
    <term name="month-10">October</term>
    <term name="month-11">November</term>
    <term name="month-12">December</term>

    <!-- SHORT MONTH FORMS -->
    <term name="month-01" form="short">Jan.</term>
    <term name="month-02" form="short">Feb.</term>
    <term name="month-03" form="short">Mar.</term>
    <term name="month-04" form="short">Apr.</term>
    <term name="month-05" form="short">May</term>
    <term name="month-06" form="short">Jun.</term>
    <term name="month-07" form="short">Jul.</term>
    <term name="month-08" form="short">Aug.</term>
    <term name="month-09" form="short">Sep.</term>
    <term name="month-10" form="short">Oct.</term>
    <term name="month-11" form="short">Nov.</term>
    <term name="month-12" form="short">Dec.</term>

    <!-- SEASONS -->
    <term name="season-01">Spring</term>
    <term name="season-02">Summer</term>
    <term name="season-03">Autumn</term>
    <term name="season-04">Winter</term>
  </terms>
</locale>
`;
