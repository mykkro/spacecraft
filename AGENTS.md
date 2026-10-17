# Working in this repository

The user reported that browser tests were clogging their PC.

- Default to lightweight source and syntax checks.
- Browser/WebGL suites are opt-in: do not launch them unless the user asks or gives the go-ahead.
- Never run browser test suites concurrently. Use one browser at a time and close its processes when finished or interrupted.
- Avoid repeated full-suite runs and large screenshot batches. Choose the smallest check needed for a concrete issue.
