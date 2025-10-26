// test our escaping routines for bibtex output

//import debug_module from 'debug';
//const debug = debug_module('eczoohelpers_eczcollectbib.test_generatebibtex');

import * as assert from 'assert';

import { _testing } from '../generatebibtex.js';

const { bibtexTextEscape, cheapTextLatexEscape } = _testing;

describe('generatebibtex', function () {
    describe('bibtexTextEscape', function () {

        it('should remove XML tags', function () {

            assert.strictEqual(
                bibtexTextEscape(`<inline-formula>
    <tex-math notation="LaTeX">$\\mathbb{Z}_m$ </tex-math>
    </inline-formula>`).trim(),
                `$\\mathbb{Z}_m$`
            );
        } );

        it('should escape special LaTeX symbols, keeping math if possible but conservatively', function () {
            assert.strictEqual(
                bibtexTextEscape(
                    `Test title <BACKSLASHCHAR/>emph{with} \\$%^weird_escapes and <BACKSLASHCHAR/>(a+<BACKSLASHCHAR/>frac{b}{2}=<BACKSLASHCHAR/>mathbb{Z}<BACKSLASHCHAR/>) math$`
                ),
                `Test title \\emph{with} \\$\\%{\\textasciicircum}weird\\_escapes and $a+\\frac{b}{2}=\\mathbb{Z}$ math\\$`
            );
            assert.strictEqual(
                bibtexTextEscape(
                    `Test title \\emph{with} \\$%^weird_escapes and \\(a+\\frac{b}{2}=\\mathbb{Z}\\) math$`
                ),
                `Test title \\emph{with} \\$\\%{\\textasciicircum}weird\\_escapes and $a+\\frac{b}{2}=\\mathbb{Z}$ math\\$`
            );
        } );

    } );

    describe('cheapTextLatexEscape', function () {

        it('should handle macros', function () {

            assert.strictEqual(cheapTextLatexEscape('test \\invalidmacro'), 'test \\string\\invalidmacro');

            assert.strictEqual(cheapTextLatexEscape('test \\emph{word}'), 'test \\emph{word}');

        } );

        it('should handle inline math', function () {

            assert.strictEqual(cheapTextLatexEscape('test $\\frac{a}{b}$'), 'test $\\frac{a}{b}$');
            assert.strictEqual(cheapTextLatexEscape('test \\(\\frac{a}{b}\\)'), 'test $\\frac{a}{b}$');

        } );

        it('should escape special chars', function () {

            assert.strictEqual(cheapTextLatexEscape('$%^weird_escapes'), '\\$\\%{\\textasciicircum}weird\\_escapes');

        } );
    } );
} );