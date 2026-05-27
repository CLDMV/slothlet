# Not a slothlet module

This subfolder has no `slothlet.module.json` and no `package.json`. Folder-mode
discovery walks immediate subdirectories of the scanRoot and only treats those
with a manifest as candidates — this one is silently skipped, exercising the
"subfolder without manifest" branch.
