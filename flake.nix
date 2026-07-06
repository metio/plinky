# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

# The Plinky development environment. It consumes the shared metio devShell
# (`ci.lib.mkDevShell`), so the lint gate (reuse, typos, yamllint, actionlint,
# shellcheck, markdownlint) is defined once org-wide, and every CI gate runs
# through `nix develop --command …` — resolving the exact tool versions in
# flake.lock, identical to a local run. `inputs.nixpkgs.follows = "ci/nixpkgs"`
# keeps one nixpkgs pin across the org.
#
# The project's own JS tools (biome, knip, tsc, vitest, stryker, depcruise) come
# from `npm ci` and are pinned by package-lock.json; the flake supplies node and
# the browser the tests drive. Chromium arrives from `playwright-driver.browsers`
# (patched for the nix store, self-contained — no `playwright install --with-deps`
# and no registry image), wired through PLAYWRIGHT_BROWSERS_PATH for both the
# vitest browser project and dev/a11y.mjs. Its browser revision is fixed by the
# nixpkgs pin (inherited through the `ci` input), so the `playwright` npm
# dependency must match that driver version. Both stay Renovate-owned: a `ci`
# input update advances the driver, and the `playwright` npm bump self-gates on
# the browser check — a version ahead of the driver fails it and waits for the
# next driver bump to rebase green, so the two converge without a manual edit.
{
  description = "Plinky: a client-only React Router SPA for learning the piano";

  inputs = {
    ci.url = "github:metio/ci";
    nixpkgs.follows = "ci/nixpkgs";
  };

  outputs =
    { nixpkgs, ci, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (
        pkgs:
        let
          # One canonical command per CI gate. Each `ci-<name>` runs the gate
          # EXACTLY as its verify.yml job does — including a gate's special CI
          # invocation, like the per-locale build the size budget measures — so
          # `nix develop --command ci-<name>` is literally what CI runs, and the
          # same name works bare inside `nix develop`. The `ci-` prefix leaves the
          # raw tool (reuse, npm, biome) free for its other modes; the wrapper pins
          # only the CI mode. dev/check-ci-parity.mjs enforces that every gate job
          # calls one of these and that each name below is defined.
          #
          # The shared lint-gate wrappers (ci-reuse, ci-typos, ci-yaml,
          # ci-actionlint, ci-markdown) come from ci.lib.mkDevShell, defined once
          # org-wide; the wrappers below are the repo-specific gates.
          ciCommands = [
            (pkgs.writeShellScriptBin "ci-typecheck" ''exec npm run typecheck "$@"'')
            (pkgs.writeShellScriptBin "ci-test" ''exec npm run test "$@"'')
            (pkgs.writeShellScriptBin "ci-test-browser" ''exec npm run test:browser "$@"'')
            (pkgs.writeShellScriptBin "ci-arch" ''exec npm run arch "$@"'')
            (pkgs.writeShellScriptBin "ci-nav" ''exec npm run nav "$@"'')
            (pkgs.writeShellScriptBin "ci-knip" ''exec npm run knip "$@"'')
            (pkgs.writeShellScriptBin "ci-biome" ''exec npx biome check "$@"'')
            (pkgs.writeShellScriptBin "ci-messages-check" ''exec npm run messages:check "$@"'')
            (pkgs.writeShellScriptBin "ci-bake-check" ''exec npm run songs:bake -- --check "$@"'')
            (pkgs.writeShellScriptBin "ci-build" ''exec env PLINKY_LOCALE=en npm run build "$@"'')
            (pkgs.writeShellScriptBin "ci-size" ''exec npm run size "$@"'')
            (pkgs.writeShellScriptBin "ci-parity" ''exec npm run ci:parity "$@"'')
          ];
        in
        {
          default = ci.lib.mkDevShell {
            inherit pkgs;
            packages = [
              pkgs.nodejs_24
              pkgs.jq # the aggregate gate and a few dev scripts read job/JSON output
            ]
            ++ ciCommands;
            env = {
              # The browsers ship in the nix closure, so playwright must not try to
              # download its own into a read-only store path.
              PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            };
            menu = ''echo "  plus node ${pkgs.nodejs_24.version} and chromium + firefox ${pkgs.playwright-driver.version} for the vitest browser + a11y gates, and ci-* wrappers that run each gate the CI way (ci-parity checks the mapping)."'';
          };
        }
      );

      formatter = forAllSystems (pkgs: pkgs.nixfmt-rfc-style);
    };
}
