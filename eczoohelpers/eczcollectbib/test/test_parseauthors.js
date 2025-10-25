//import debug_module from 'debug';
//const debug = debug_module('eczoohelpers_eczcollectbib.test_parseauthors');

import * as assert from 'assert';

import { _testing, parseAuthorsYearInfo } from '../parseauthors.js';
const { _TokenConsumer } = _testing;


function testConsumeAuthor({ testName, given, family, suffix })
{
    let t = new _TokenConsumer(testName);
    let toklist = [];
    assert.ok(
        t.consumeAuthor(toklist)
    );
    let correctauthor = { given, family };
    if (suffix) {
        correctauthor.suffix = suffix;
    }
    assert.deepStrictEqual(toklist, [correctauthor]);
}

function testConsumeAuthorList(str, correctAuthorList, { assumptions, remainingString }={})
{
    let t = new _TokenConsumer(str);
    let toklist = [];
    assert.ok(
        t.consumeAuthorList(toklist, { assumptions })
    );
    assert.deepStrictEqual(toklist, correctAuthorList);
    if (remainingString != null) {
        assert.strictEqual(t.remainingString(), remainingString);
    }
}



describe('parseauthors', function () {

    describe('_TokenConsumer', function () {

        it('should consume initials correctly', function () {

            let t = new _TokenConsumer('A. B. C.');
            let toklist = [];

            assert.ok(
                t.consumeInitial(toklist)
            );

            assert.ok(
                t.consumeInitial(toklist)
            );

            assert.ok(
                t.consumeInitial(toklist)
            );

            assert.deepStrictEqual(toklist, ['A.', 'B.', 'C.']);
        });

        it('should consume more initials correctly', function () {

            let t = new _TokenConsumer('A. Yu. Kitaev');
            let toklist = [];

            assert.ok(
                t.consumeInitial(toklist)
            );

            assert.ok(
                t.consumeInitial(toklist)
            );

            assert.ok(
                ! t.consumeInitial(toklist)
            );

            assert.deepStrictEqual(toklist, ['A.', 'Yu.',]);
        });

        it('should consume various full author names correctly', function () {
            testConsumeAuthor({
                testName: 'A. Yu. Kitaev',
                given: 'A. Yu.',
                family: 'Kitaev',
            });
            testConsumeAuthor({
                testName: 'Alexey Kitaev',
                given: 'Alexey',
                family: 'Kitaev',
            });
            testConsumeAuthor({
                testName: 'Alexey Yu. Kitaev',
                given: 'Alexey Yu.',
                family: 'Kitaev',
            });

            testConsumeAuthor({
                testName: 'John P. Preskill',
                given: 'John P.',
                family: 'Preskill',
            });
            testConsumeAuthor({
                testName: 'J. Preskill',
                given: 'J.',
                family: 'Preskill',
            });

            testConsumeAuthor({
                testName: 'A. B. Sullivan Smith',
                given: 'A. B.',
                family: 'Sullivan Smith',
            });
            testConsumeAuthor({
                testName: 'Doe, John',
                given: 'John',
                family: 'Doe',
            });
            testConsumeAuthor({
                testName: 'Doe Jr., John',
                given: 'John',
                family: 'Doe',
                suffix: 'Jr.',
            });
            testConsumeAuthor({
                testName: 'Sullivan Smith, A. B.',
                given: 'A. B.',
                family: 'Sullivan Smith',
            });
            testConsumeAuthor({
                testName: 'Sullivan Smith Sr., Alice',
                given: 'Alice',
                family: 'Sullivan Smith',
                suffix: 'Sr.',
            });
        });

        it('should parse author name lists correctly', function () {

            testConsumeAuthorList(
                'John Doe, Felix Hanserstadt',
                [
                    {given: 'John', family: 'Doe'},
                    {given: 'Felix', family: 'Hanserstadt'},
                ]
            );

            testConsumeAuthorList(
                'J. Doe, F. Hanserstadt',
                [
                    {given: 'J.', family: 'Doe'},
                    {given: 'F.', family: 'Hanserstadt'},
                ]
            );

            testConsumeAuthorList(
                'Doe, J., Hanserstadt, F.',
                [
                    {given: 'J.', family: 'Doe'},
                    {given: 'F.', family: 'Hanserstadt'},
                ]
            );

            testConsumeAuthorList(
                'Doe, J. & Hanserstadt, F.',
                [
                    {given: 'J.', family: 'Doe'},
                    {given: 'F.', family: 'Hanserstadt'},
                ]
            );

            testConsumeAuthorList(
                'Doe, J., and Hanserstadt, F.',
                [
                    {given: 'J.', family: 'Doe'},
                    {given: 'F.', family: 'Hanserstadt'},
                ]
            );

            testConsumeAuthorList(
                'P. Aliferis, D. Gottesman, and J. Preskill, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );

            testConsumeAuthorList(
                'Aliferis, P., Gottesman, D., and Preskill, J., “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );

            // with custom \and separator
            testConsumeAuthorList(
                'Aliferis, P. \\and Gottesman, D. \\and Preskill, J., “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );

            // semicolumn separator
            testConsumeAuthorList(
                'Aliferis, P.; Gottesman, D.; Preskill, J., “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );
            testConsumeAuthorList(
                'Aliferis, P.; Gottesman, D.; and Preskill, J., “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );

            // & separator
            testConsumeAuthorList(
                'Aliferis, P. & Gottesman, D. & Preskill, J., “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );
            testConsumeAuthorList(
                'Aliferis, P & Gottesman, D & Preskill, J, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P', family: 'Aliferis'},
                    {given: 'D', family: 'Gottesman'},
                    {given: 'J', family: 'Preskill'},
                ]
            );
            testConsumeAuthorList(
                'P. Aliferis & D. Gottesman & J. Preskill, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ]
            );
            testConsumeAuthorList(
                'P Aliferis & D Gottesman & J Preskill, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P', family: 'Aliferis'},
                    {given: 'D', family: 'Gottesman'},
                    {given: 'J', family: 'Preskill'},
                ]
            );

            // bibtex-like "and"
            testConsumeAuthorList(
                'Aliferis, P. and Gottesman, D. and Preskill, J., “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ],
                {
                    remainingString: '“Quantum accuracy threshold for concatenated distance-3 codes”,'
                }
            );
            testConsumeAuthorList(
                'Aliferis, P and Gottesman, D and Preskill, J, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P', family: 'Aliferis'},
                    {given: 'D', family: 'Gottesman'},
                    {given: 'J', family: 'Preskill'},
                ],
                {
                    remainingString: '“Quantum accuracy threshold for concatenated distance-3 codes”,'
                }
            );
            testConsumeAuthorList(
                'P. Aliferis and D. Gottesman and J. Preskill, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P.', family: 'Aliferis'},
                    {given: 'D.', family: 'Gottesman'},
                    {given: 'J.', family: 'Preskill'},
                ],
                {
                    remainingString: '“Quantum accuracy threshold for concatenated distance-3 codes”,'
                }
            );
            testConsumeAuthorList(
                'P Aliferis and D Gottesman and J Preskill, “Quantum accuracy threshold for concatenated distance-3 codes”,',
                [
                    {given: 'P', family: 'Aliferis'},
                    {given: 'D', family: 'Gottesman'},
                    {given: 'J', family: 'Preskill'},
                ],
                {
                    remainingString: '“Quantum accuracy threshold for concatenated distance-3 codes”,'
                }
            );

            testConsumeAuthorList(
                'C. W. von Keyserlingk, F. J. Burnell, and S. H. Simon, “Three-dimensional topological lattice models with surface anyons”,',
                [
                    {given: 'C. W.', family: 'von Keyserlingk'},
                    {given: 'F. J.', family: 'Burnell'},
                    {given: 'S. H.', family: 'Simon'},
                ],
                {
                    remainingString: '“Three-dimensional topological lattice models with surface anyons”,'
                }
            );
        });

        it('should parse some nasty formatted author name lists correctly', function() {
            // A particularly nasty one.
            testConsumeAuthorList(
                'Andries E. Brouwer, Bounds on linear codes, in: Vera S. Pless and W. Cary Huffman (Eds.), Handbook of Coding Theory, pp. 295-461, Elsevier, 1998.',
                [
                    {given: 'Andries E.', family: 'Brouwer'},
                ],
                {
                    remainingString: 'Bounds on linear codes, in: Vera S. Pless and W. Cary Huffman (Eds.), Handbook of Coding Theory, pp. 295-461, Elsevier, 1998.',
                }
            );
            testConsumeAuthorList(
                'N. N. Andreev, Location of points on a sphere with minimal energy.',
                [
                    {given: 'N. N.', family: 'Andreev'},
                ],
                {
                    remainingString: 'Location of points on a sphere with minimal energy.',
                }
            );

            // don't mistake V and I initials for suffixes
            testConsumeAuthorList(
                'Arnold, Paul V. I. (1999).',
                [
                    {given: 'Paul V. I.', family: 'Arnold'},
                ],
            );
            testConsumeAuthorList(
                'B. I. Belov, V. N. Logachev, V. P. Sandimirov, “Construction of a Class of Linear Binary Codes...”',
                [
                    {given: 'B. I.', family: 'Belov'},
                    {given: 'V. N.', family: 'Logachev'},
                    {given: 'V. P.', family: 'Sandimirov'},
                ],
            );
            testConsumeAuthorList(
                'Berman, A., Dor, A., Shany, Y., Shapir, I., and Doubchak, A. (2023).',
                [
                    {given: 'A.', family: 'Berman'},
                    {given: 'A.', family: 'Dor'},
                    {given: 'Y.', family: 'Shany'},
                    {given: 'I.', family: 'Shapir'},
                    {given: 'A.', family: 'Doubchak'},
                ]
            );
            // includes short last name "Li" that might be seen as an initial.
            testConsumeAuthorList(
                'C. Huang, H. Simitci, Y. Xu, A. Ogus, B. Calder, P. Gopalan, J. Li, and S. Yekhanin. \\emph{Erasure coding in Windows Azure Storage}.  In ...',
                [
                    {given: 'C.', family: 'Huang'},
                    {given: 'H.', family: 'Simitci'},
                    {given: 'Y.', family: 'Xu'},
                    {given: 'A.', family: 'Ogus'},
                    {given: 'B.', family: 'Calder'},
                    {given: 'P.', family: 'Gopalan'},
                    {given: 'J.', family: 'Li'},
                    {given: 'S.', family: 'Yekhanin'},
                ]
            );

            // Dashes and apostrophes abound
            testConsumeAuthorList(
                "T. Jochym-O'Connor, (2022)",
                [
                    {given: "T.", family: "Jochym-O'Connor"},
                ]
            );
            testConsumeAuthorList(
                "C. O'Hara, (2018)", // O is not an initial
                [
                    {given: "C.", family: "O'Hara"},
                ]
            );
            testConsumeAuthorList(
                "C. A-Hoy, J. Li (2018)", // O is not an initial
                [
                    {given: "C.", family: "A-Hoy"},
                    {given: "J.", family: "Li"},
                ]
            );

            // Make sure suffix rx is well anchored to the start of the string and doesn't
            // find a "II" later in the string
            testConsumeAuthorList(
                'Borrelli, Chris. "IEEE 802.3 cyclic redundancy check." application note: Virtex Series and Virtex-II Family, XAPP209 (v1. 0) (2001).',
                [
                    {given: "Chris", family: "Borrelli"},
                ]
            );

            // Nasty title with "and" which looks like an author separator.
            testConsumeAuthorList(
                'R. de Budaand W. Kassem, About lattices and the random coding theorem, in Abstracts of Papers, IEEE Inter. Symp. Info. Theory 1981, IEEE Press, NY 1981, p. 145',
                [
                    {given: "R.", family: "de Budaand W. Kassem"},
                ]
            );

            // composite initials with dots
            testConsumeAuthorList(
                'P. Gaborit, W. C. Huffman, J.-L. Kim, and V. Pless, “On additive GF(4) codes,” in Codes and Association Schemes (DIMACS Workshop, November 9–12, 1999), eds. A. Barg and S. Litsyn. Providence, RI: American Mathematical Society, 2001, pp. 135–149.',
                [
                    {given: "P.", family: "Gaborit"},
                    {given: "W. C.", family: "Huffman"},
                    {given: "J.-L.", family: "Kim"},
                    {given: "V.", family: "Pless"},
                ]
            );
            testConsumeAuthorList(
                'P. Gaborit, W. C. Huffman, J-L Kim, and V. Pless, “On additive GF(4) codes,” in Codes and Association Schemes (DIMACS Workshop, November 9–12, 1999), eds. A. Barg and S. Litsyn. Providence, RI: American Mathematical Society, 2001, pp. 135–149.',
                [
                    {given: "P.", family: "Gaborit"},
                    {given: "W. C.", family: "Huffman"},
                    {given: "J-L", family: "Kim"},
                    {given: "V.", family: "Pless"},
                ]
            );

        });

        it('should run the specific test I WANT TO DEBUG RIGHT NOW', function () {
            // paste a single test to debug here, and run 'DEBUG=* yarn test -g "DEBUG"'
            
            // once the test is debugged, move it where it belongs.

            // Here I might collect some cases that we might hope to support later on,
            // but I don't know how to handle right now.
            // 
            //testConsumeAuthorList(
            //    'Andreev, N. N. Location of points on a sphere with minimal energy.',
            //    [
            //        {given: 'N. N.', family: 'Andreev'},
            //    ],
            //    {
            //        remainingString: 'Location of points on a sphere with minimal energy.',
            //    }
            //);
        });


        it('should handle "et al" correctly', function () {

            testConsumeAuthorList(
                'John Doe, Felix Hanserstadt et al.',
                [
                    {given: 'John', family: 'Doe'},
                    {given: 'Felix', family: 'Hanserstadt'},
                    {family: 'others'},
                ]
            );

            testConsumeAuthorList(
                'John Doe, Felix Hanserstadt \\emph{et al}.',
                [
                    {given: 'John', family: 'Doe'},
                    {given: 'Felix', family: 'Hanserstadt'},
                    {family: 'others'},
                ]
            );

            testConsumeAuthorList(
                'John Doe, Felix Hanserstadt \\textit{et al.}',
                [
                    {given: 'John', family: 'Doe'},
                    {given: 'Felix', family: 'Hanserstadt'},
                    {family: 'others'},
                ]
            );

            testConsumeAuthorList(
                'John Doe, Felix Hanserstadt, et al.',
                [
                    {given: 'John', family: 'Doe'},
                    {given: 'Felix', family: 'Hanserstadt'},
                    {family: 'others'},
                ]
            );

        });

        it('backtracks as necessary to re-parse author list as first last', function () {
            // gets this one wrong, not much we can do!
            testConsumeAuthorList(
                'John Doe, Google',
                [
                    {given: 'Google', family: 'John Doe'},
                ]
            );
            // Protected name in braces forces the brace content to be a single author,
            // giving the correct result here: 
            testConsumeAuthorList(
                'John Doe, {Google}',
                [
                    {given: 'John', family: 'Doe'},
                    {family: 'Google'},
                ]
            );
            // In this case, an additional name fixes the parse as well, because we cannot
            // parse the entire author list in "last, first" format (backtracking must have
            // happened here).
            testConsumeAuthorList(
                'John Doe, Google, Brian Smith',
                [
                    {given: 'John', family: 'Doe'},
                    {family: 'Google'},
                    {given: 'Brian', family: 'Smith'},
                ]
            );
        });
    });

    describe('parseAuthorsYearInfo', function () {
        it('can parse author-year info of a standard citation', function () {
            assert.deepStrictEqual(
                parseAuthorsYearInfo(
                    'P. Aliferis, D. Gottesman, and J. Preskill, “Quantum accuracy threshold for concatenated distance-3 codes”, (2005) arXiv:quant-ph/0504218.',
                    { assumeFirstLast: true }
                ),
                {
                    author_list: [
                        {given: 'P.', family: 'Aliferis'},
                        {given: 'D.', family: 'Gottesman'},
                        {given: 'J.', family: 'Preskill'},
                    ],
                    year: 2005,
                    remaining_string: '“Quantum accuracy threshold for concatenated distance-3 codes”, (2005) arXiv:quant-ph/0504218.',
                    remaining_string_no_year: '“Quantum accuracy threshold for concatenated distance-3 codes”,  arXiv:quant-ph/0504218.',
                }
            );
        });
    });

});
