echo 'Do not run me! I am a markdown file!'; return
... that was just in case I blindly ran '. ./YARN_UP_CMDS.md'


Yarn upgrade commands for my packages:

```bash
yarn up -i @phfaist/zoodb@https://github.com/phfaist/zoodb.git
yarn up -i '@phfaist/zoodbtools_previewremote@https://github.com/phfaist/zoodbtools.git#workspace=@phfaist/zoodbtools_previewremote'
yarn up -i '@phfaist/zoodbtools_gitpreview@https://github.com/phfaist/zoodbtools.git#workspace=@phfaist/zoodbtools_gitpreview'
yarn up -i '@phfaist/zoodbtools_search@https://github.com/phfaist/zoodbtools.git#workspace=@phfaist/zoodbtools_search'
yarn up -i '@phfaist/zoodbtools_preview@https://github.com/phfaist/zoodbtools.git#workspace=@phfaist/zoodbtools_preview'
```
