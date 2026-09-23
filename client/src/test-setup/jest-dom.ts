// Setup for the client-dom vitest project: registers @testing-library/jest-dom
// matchers (toBeInTheDocument, …). Imported from a local file rather than
// listing the bare specifier in setupFiles so it resolves like any other
// module import (a bare setupFiles specifier is loaded by realpath and fails
// when node_modules is a symlink, e.g. in a git worktree).
import "@testing-library/jest-dom/vitest";
