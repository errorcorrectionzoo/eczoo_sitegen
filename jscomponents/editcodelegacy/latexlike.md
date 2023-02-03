# LaTeX-inspired mini-language in text

In most text fields, you can make use of the following LaTeX-inspired
features.

## An example

Here's an example to get you started:

```latex
Text can contain some simple LaTeX macros, for instance
for \textbf{bold text} and \emph{italic text}.

Use two line breaks to start a new paragraph. You
can use inline math like \(\alpha=\sum_j\beta_j\) and
display equations like
\begin{align}
    S_1 &= I\,X\,Z\,Z\,X\ ;  \nonumber\\
    S_2, \ldots, S_4 &= \text{cyclical permutations of \(S_1\)}\ .
    \label{eq:stabilizers}
\end{align}

Refer to equations with \eqref{eq:stabilizers}, etc. ...
```

## Bold, emphasis, special characters

  - Leave a blank line to start a new paragraph.  Whitespace is
    simplified as usual in LaTeX, i.e., consecutive spaces will not
    insert more space.
    
  - The macros `\emph{...}`, `\textit{...}`, and `\textbf{...}` can be
    used for italic or for bold text.
    
  - Input accents, special characters, etc., directly as Unicode:
    `éàààé😅Á`.  Note that source files should always be encoded using
    the UTF-8 encoding.  You can use pretty quotes ``‘`` ``’`` ``“``
    ``”``; dashes ``—`` (em dash), ``–`` (en dash, for ranges); spaces
    `` `` (non-breaking space), `` `` (em space), `` `` (thin space),
    etc.
    
  - Protect characters that might have a special meaning using the
    following macros: `\textbackslash` (backslash character), `\ `
    (force a space), `\{` (open brace), `\}` (closing brace), `\%`
    (percent character), `\&` (ampersand), `\$` (dollar sign), `\#`
    (number sign).
    
## Math

  - Math expressions can be written as `\( ... \)`, they will be rendered
    into pretty formulas using MathJaX. You can use standard LaTeX
    math commands in equations, as supported e.g. by AMS-TeX (`\sim`,
    `\langle`, etc.).  You can also use `\bra{\phi}` and `\ket{\psi}`.
    
  - Use the `\begin{align} ... \end{align}` and `\begin{gather}
    ... \end{gather}` environments for display equations, and you can
    use `\begin{split} ... \end{split}` within a display equation.
    You can use `\label{eq:...}` inside the equation environments and
    you can refer to labeled equations with `\eqref{eq:...}`.  Do not
    use ~~`(\ref{eq:...})`~~. The label must start with the prefix
    `eq:`.  You can also use `\[ ... \]` for unnumbered display
    equations.

## Citations

  - Cite relevant papers by their arXiv number as
    `\cite{arxiv:XXXX.XXXXX}` or `\cite{arxiv:quant-ph/XXXXXXX}`, or
    using their DOI as `\cite{doi:10.ZZZZZZ}`.
    
    *DOIs are
    automatically retrieved for `arXiv` citations, so please use
    `arXiv` identifiers whenever possible.  If the DOI is not
    retreived correctly (e.g., it is not listed correctly on the
    arXiv page), then please add a line in the file
    `citation_extras/citation_hints.yml` (in the data repo),
    specifically in the `arxiv_to_doi_override:`
    section.  You can also file an issue in this repo so that we
    take care of this addition.*
    
    Citations can be combined as in LaTeX:
    `\cite{arxiv:XXX,arxiv:YYY,doi:ZZZ}`.  If there is neither an
    arxiv number nor a DOI number available, you can enter a citation
    manually as `\cite{manual:{A. Smith et al., \emph{Journal of Weird
    Stuff} 12:\textbf{A}, 1003--1592 (1943)}}`.
    
## References to other codes and external links

  - Reference other codes using `\ref{code:<other-code-id>}`.  To set
    a custom label to show, you can use
    `\hyperref[code:<other-code-id>]{link text}`.
    
  - Insert hyperlinks to other web pages as
    `\href{https://example.com/example/page}{shown link text}` or with
    `\url{https://example.com/example/page}`.
    
  - Insert references to figures and tables with `\ref{figure:my-figure-label}`
    and `\ref{table:my-table-label}`.  In contrast to LaTeX' usual
    behavior, the output of these commands includes the words “Figure”
    or “Table”, i.e., you get *Figure X* or *Table X*.
  
  - You can insert footnotes with `\footnote{...}`.  Footnotes should
    be avoided in general.

## Sections, paragraphs, and definition terms

  - *Sectioning*: Use ``\subsection{Title}`` and ``\paragraph{Title}`` to generate
    sub-headings and to split a long field (such as description) into
    logical sub-parts.  You can pin labels with
    ``\label{sec:label-name}`` (use ``sec:`` for both subsections and
    paragraphs; although see also ``topic:`` labels below).  Then
    ``\ref{sec:...}`` will expand to a link with the section/paragraph
    title, also from other pages in the zoo.  **The section label must
    be unique across the zoo!**
    
  - *Definition of technical terms*: Use ``\begin{defterm}{<term>}
    ... \end{defterm}`` to define a technical term (e.g.,
    *Knill-Laflamme conditions*).  You can then later refer to that
    term using the syntax ``\term{<term>}`` from anywhere else in the
    zoo.  You must provide the term with the exact same spelling
    (including character case).  If the term needs to be altered for
    integration in a sentence, use ``\term[<original term>]{display
    term}``.
    
  - *Topic labels*: You can pin down labels of the form
    ``\label{topic:<label-name>}``, with the prefix ``topic:``, to
    designate a location that discusses or explains a particular topic
    that you might want to refer to from somewhere else.  These labels
    can be pinned to sections, paragraphs, and ``defterm``
    environments.  Using `topic:` labels has the advantage of later
    changing the label target from, say, a `defterm` environment to a
    section heading, without having to change the label.  For
    instance, you can use
    ``\label{topic:CSS-to-homology-correspondence}`` in a `defterm`
    environment and then later decide to change the `defterm` into a
    section instead.


## Figures and tables

  - You can use the float environments ``\begin{figure}
    ... \end{figure}`` and ``\begin{table} ... \end{table}``.  The
    syntax of these environments is as follows:

    ```latex
    \begin{figure}
        \includegraphics{figure_file_name}
        \caption{Your figure can have a caption}
        \label{figure:my-figure-label}
    \end{figure}

    \begin{table}
        \begin{cells}
          \celldata{
            (... table content, see below...)
          }
        \end{cells}
        \caption{Your table can have a caption}
        \label{table:my-table-label}
    \end{table}
    ```
    
    Both of these environments produce a break in the text (they place their
    content immediately), in contrast to their standard LaTeX implementation.
    However, you should avoid counting on this behavior, and use the standard
    label-ref mechanism to refer to the figure from the main text.

    You may omit both ``\caption`` and ``\label`` commands to generate
    a figure without any caption.  If you specify a ``\label`` and
    omit the ``\caption`` command, a figure with the simple legend
    text “*Figure X*” or “*Table X*” will be generated.
    
    You can also use the label to reference the figure from the main
    text with ``\ref{figure:my-figure-label}``.  The label prefix
    `figure:` or `table:` must match the float environment name.  *In
    contrast to standard LaTeX, the ``\ref`` command will include the
    word “Figure” or “Table” along with the reference*.  In this
    regard, ``\ref`` acts more like
    LaTeX/[cleveref](https://ctan.org/pkg/cleveref)'s ``\cref``
    command.

    Our parser is very picky about the syntax of commands within float
    environments and will issue errors if you deviate from it.

  - *Figure images:* The ``figure_file_name`` must be the name of an
    image file that is in the code YAML file tree, which is searched
    relative to the code YAML file's path.  In ``figure_file_name``,
    the file name extension (e.g., ``.svg``) can be omitted.  The
    preferred file structure for codes that have image files is to
    place the code YAML file along with the image files in their own,
    separate folder that is specific to that code.
    
    You may not specify optional sizing/trimming/cropping arguments to
    the ``\includegraphics`` command.  Please prepare your figure
    directly at the correct size.  Bear in mind that if you have text
    elements in your figure, then resizing the figure will cause a
    visual mismatch with the article text appearance.  See notes on
    images below.

  - *Tables:* We now support an experimental mechanism for building
    pretty tables.  The table's data is given through the
    ``\begin{cells}...\end{cells}`` environment.  See below for a
    description of the syntax for specifying table contents.
    


### Image files
    
The preferred file format is a vector SVG file.
  
The size at which you place elements in your SVG file is important.
The stated physical dimensions that are present in the SVG file are
used to place the image at the correct size and resolution to match
the surrounding article.  General text should be typeset preferably
using the ‘Source Sans Pro’ at 10 point size, to match the typography
of the surrounding article.  (You can place smaller or bigger text for
axis markers, or use a different font if it's necessary, or etc.; use
your good judgment and common sense.  We'll come back at you in case
we'd prefer some changes.)
    
Be sure also to **set the page dimensions of your SVG document
correctly** to match the size of your graphic, with the correct scale
for rendering on our web page.  If you use Inkscape, you can select
“File” → “Document Properties” → “Resize page to drawing or selection”
and make sure you have reasonable figure dimensions.  Please keep your
figure width to *at most 12cm (5.5in)* to ensure a good page layout
without the user having to scroll the figure horizontally.

If you set the SVG image's dimensions in units of pixels ("px"), we'll
assume a resolution of 96 DPI (as per web standards).  [If you're
using Affinity Designer, set the document resolution to 96 dpi, and
uncheck ‘Set viewBox’ in the SVG export options.]
    
You can also use PNG or JPG/JPEG files.  **Please make sure you set
the physical resolution (DPI) correctly**, as this information is
honored to determine the figure size.  Most graphics software will
allow you to adjust this setting (look for "physical dimensions",
"dots-per-inch", "pixels-per-inch", or "DPI").  In
[GIMP](https://www.gimp.org/), you can set the resolution with "Image"
-> "Resize" and providing any two of physical dimensions (e.g.,
mm,cm,in,pt), pixel dimensions, and DPI.  Please keep your figure
width to *at most 12cm (5.5in)* to obtain a good page layout without
the user having to scroll the figure horizontally.




### Table Contents — Cells

The syntax for the table cells is as follows:

```latex
\begin{cells}
  \celldata{
     One & Two & Three \\
     Four & Five & Six
  }
  [ ... ]
\end{cells}
```

The ``{cells}`` environment may contain any number of calls to the
macros ``\celldata`` and ``\cell``.  Each such macro call adds new
cells to the table.  The macros have the following syntax:

- ``\cell{contents}``, ``\cell<style1 style2 ...>{contents}``,
  ``\cell[location]{contents}``,
  ``\cell<styles...>[location]{contents}``: Add a single cell to
  the table.  Unless a location is specified, the cell is added in
  the next column on the current row.
  
  The `[location]` can either specify a column `[COL]` (will use
  the current row) or a pair `[ROW;COL]`.  Each of `COL` and `ROW`
  can be:

  - a row/column number (row and column numbers start at 1);

  - left empty, or set to the character ``.``, to mean the current
    row/column;

  - a ``\merge{INDEXRANGE}`` command to create a merged cell
    spanning multiple rows/columns.  Here, the ``INDEXRANGE`` can
    be comma-separated numbers (e.g., ``1,2,3`` to include the
    given row/column numbers), including ranges specified as
    ``START-END`` (such as e.g. ``2-4`` for row/column indices 2
    through 4, included) as well as ``START+NUMBER`` to include
    ``NUMBER`` columns starting at index number ``START`` (e.g.,
    ``2+3`` will include column numbers ``2``, ``3`` and ``4``).
    Ranges can be combined, separated by commas, but in any case
    the `INDEXRANGE` must correspond to a contiguous set of
    indices.
    
  The ``<styles...>`` argument specifies the style that will be
  applied to the cell.  See information on cell styles below.  You
  can specify multiple styles by separating them with spaces.
  
  *Example:* ``\cell<H l>[1;\merge{3-4}]{Hi!}`` will create a
  left-aligned (``l``) header (``H``) cell at row ``1`` and
  spanning the columns ``3`` and ``4``, with the contents
  “``Hi!``”.
  
  
- ``\celldata{tabular data}``, ``\celldata<cellstyles>{tabular
  data}``, ``\celldata[locations]{tabular data}``,
  ``\celldata<cellstyles>[locations]{tabular data}``: A shorthand
  for sequentially adding multiple cells.
  
  The ``{tabular data}`` is specified as you'd do for the LaTeX
  ``\begin{tabular} ... \end{tabular}`` environment, by separating
  rows with ``\\`` and separating columns with ``&``.

  The cells can be placed at given locations, and each cell is
  styled according to the given styles.
  
  The optional ``[locations]`` is of the form of either
  ``[COLUMNS]`` or ``[ROWS;COLUMNS]``.  If ``ROWS`` are not
  specified, then rows are added sequentially starting from the
  current row.  Each of ``ROWS`` and ``COLUMNS`` specify a
  sequence of row/column indices to which the given data will be
  assigned.  For instance, ``\celldata[3,2,1]{A & B & C}`` will
  place ``A`` in the 3rd column, ``B`` in the 2nd column, and
  ``C`` in the 1st column.  More specifically, ``ROWS`` and
  ``COLUMNS`` are specified a comma-separated list of indices, of
  ranges of the form ``START-END`` or ``START+NUMBER`` (see
  above), and of ``\merge{}`` commands (see above).  Omitting
  ``START`` or ``END`` is interpreted as the current or the last
  index, respectively.  For instance:

  - ``\celldata[2-5]{A & B & C & D\\ E & F & G & H}`` will place
    ``A``, ``B``, ``C``, ``D`` in columns 2, 3, 4, 5 of the first
    row, and place ``E``, ``F``, ``G``, ``H`` in columns 2, 3, 4,
    5 of the following row;

  - ``\celldata[\merge{1,2},\merge{+2};4,6]{A & AA \\ B & BB}``
    will place ``A`` in a merged cell spanning rows ``1,2`` and in
    column ``4``, ``AA`` in a merged call spanning rows ``1,2``
    and in column ``6``, ``B`` in a merged call spanning rows
    ``3,4`` and in column ``4``, and ``BB`` in a merged call
    spanning rows ``3,4`` and in column ``6``.
  
  The ``styles`` is a comma-separated list of styles to apply to
  the different columns.  The same style is applied to all
  provided cells of that column.  The sequence corresponds to the
  given data, not the final column number.  If there are fewer
  style specifications than columns, then the last style is
  repeated as necessary.  For each column style you can specify
  multiple styles by separating them with spaces.  For instance:
  
  - ``\celldata<H>{One & Two & Three}`` Creates three header
    (``H``) cells on a single row.
    
  - ``\celldata<H l, H c>{One & Two & Three}`` Creates one
    left-aligned (``l``) header (``H``) cell with content
    “``One``”, and two centered (``c``) header (``H``) cells with
    respective content “``Two``” and “``Three``”.

  You can also override the style and/or location for individual cells
  in the tabular data by wrapping that cell's content in an explicit
  ``\cell`` call.  Styles are merged with any styles specified in the
  ``\celldata`` call.  For instance, ``\celldata<H>{A & B &
  \cell<green>[\merge{+2}]{C}}`` will generate a row with a header
  cell ``A`` in the first column, a header cell ``B`` in the second
  column, and a green-background header cell ``C`` spanning the third
  and fouth columns.


*Cell styles:*

- ``H`` — this cell is a column header.  It will be typeset in a
  more prominent form (e.g., boldface with a light bottom border);

- ``rH`` — this cell is a row header.  It will be typeset more
  prominently (e.g., boldface);
  
- ``l``, ``c``, ``r`` — align cell contents ``l``eft, ``c``entered
  or ``r``ight;
  
- ``lvert``, ``rvert`` — add a thin vertical border on the left or
  the right side of the cell;
  
- ``green``, ``blue``, ``yellow``, ``red`` — apply a background
  color to the cell to emphasize it in some way.



    
