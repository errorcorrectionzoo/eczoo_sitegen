# Error Correction Zoo - Site Generation Code

This repository contains the necessary code to generate the error correction zoo
website files.

The contents of the error correction zoo (information about the codes and their
relations) are stored in the [`eczoo_data`
repository](https://github.com/errorcorrectionzoo/eczoo_data).  If you'd like to
contribute to the zoo by updating information about codes, the relevant files to
modify will be in that repository.  Check out also the [README
file](https://github.com/errorcorrectionzoo/eczoo_data/blob/main/README.md)
for that repository for more information about how to edit code information.

The scripts to actually generate the error correction zoo website files are
developed in the present `eczoo_sitegen` repository.

The scripts in this repository will allow you to:

- Preview your changes on the fly as you edit the YAML files for the codes;

- Perform a complete build of the error correction zoo website files locally.

## Setup

This section describes the one-time setup steps you need to perform in order to
generate the zoo contents locally on your computer.

You should clone the git repositories `eczoo_data` and `eczoo_sitegen` in two
sibling folders somewhere on your computer:
```
> git clone https://github.com/errorcorrectionzoo/eczoo_data.git
> git clone https://github.com/errorcorrectionzoo/eczoo_sitegen.git
```

You also need to install a recent version of [Node.js](https://nodejs.org/).

You'll also need to enable the package manager *Yarn 3* which is provided with
recent versions of Node.js. Check the node docs; usually, this entails running the
command
```
> corepack enable
```

Once the above setup is complete, you can finally install the script
dependencies to generate the error correction zoo website files.  Navigate to
the *eczoo_sitegen/* folder and run *yarn install*:
```
> cd eczoo_sitegen
> yarn install
```

This command might take a moment to complete as it installs all the necessary
software dependencies.


## Live preview while editing the zoo contents

To start the live preview, navigate to *eczoo_sitegen/site* and run *yarn preview*:
```
> cd eczoo_sitegen/site
> yarn preview
```

The script will build the a simple website previewer.  The site pages can be
previewed in your browser at the address displayed by the `yarn preview` script
in the terminal; this address is normally http://localhost:8087/ .
If you make changes to your source YAML files, you can click the "RELOAD" button
in the browser preview to pick up the modifications and update the displayed zoo
page.

The initial build can take a while and might freeze your browser page for a
couple minutes, so please be patient.  Reloads should happen much faster.

If you notice bugs in how the site is rebuilt, or if the page fails to rebuild
properly, perform a full reload of your browser web page (e.g. Ctrl+Shift+R).
If you found a bug, please let me know (create a github issue) so that I can fix
it.


## Run a complete build of the zoo website files

To run a complete build of the website, navigate to *eczoo_sitegen/site* and run *yarn build*:
```
> cd eczoo_sitegen/
> yarn build
```

Once the script is done, the website files will be written to the folder
`eczoo_sitegen/site/_site/`.  If you'd like to view the site at this point,
you may run (in the same folder as the previous commands):
```
> yarn serve
```
and point your browser to the location printed by the script in your terminal
(usually http://localhost:8080/ ). Note that in this case, changes to your YAML
files are not monitored; you'll need to re-run `yarn build` to reflect any
changes in your browser.


