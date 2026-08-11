# Codex repository instructions

## Git safety

- Never run `git push` while the current branch is `main` or its name starts with `dev` or `prod`.
- If a push is requested from one of those protected branches, stop and ask the user to create or switch to an appropriate feature branch.
- Before every push, verify the current branch with `git branch --show-current`.
