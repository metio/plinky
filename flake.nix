# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: AGPL-3.0-or-later

# The Plinky development environment. It consumes the shared metio devShell
# (`devshell.lib.mkDevShell`), so the lint gate (reuse, typos, yamllint, actionlint,
# shellcheck, markdownlint) is defined once org-wide, and every CI gate runs
# through `nix develop --command …` — resolving the exact tool versions in
# flake.lock, identical to a local run. `inputs.nixpkgs.follows = "devshell/nixpkgs"`
# keeps one nixpkgs pin across the org.
#
# The project's own JS tools (biome, knip, tsc, vitest, stryker, depcruise) come
# from `npm ci` and are pinned by package-lock.json; the flake supplies node and
# the browser the tests drive. Chromium arrives from `playwright-driver.browsers`
# (patched for the nix store, self-contained — no `playwright install --with-deps`
# and no registry image), wired through PLAYWRIGHT_BROWSERS_PATH for both the
# vitest browser project and dev/a11y.mjs. Its browser revision is fixed by the
# nixpkgs pin (inherited through the `devshell` input), so the `playwright` npm
# dependency must match that driver version. Both stay Renovate-owned: a `devshell`
# input update advances the driver, and the `playwright` npm bump self-gates on
# the browser check — a version ahead of the driver fails it and waits for the
# next driver bump to rebase green, so the two converge without a manual edit.
{
  description = "Plinky: a client-only React Router SPA for learning the piano";

  inputs = {
    devshell.url = "github:metio/nix-devshell";
    nixpkgs.follows = "devshell/nixpkgs";
  };

  outputs =
    { nixpkgs, devshell, ... }:
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
          # ci-actionlint, ci-markdown) come from devshell.lib.mkDevShell, defined once
          # org-wide; the wrappers below are the repo-specific gates.
          ciCommands = [
            (pkgs.writeShellScriptBin "ci-typecheck" ''exec npm run typecheck "$@"'')
            (pkgs.writeShellScriptBin "ci-test" ''exec npm run test "$@"'')
            (pkgs.writeShellScriptBin "ci-test-browser" ''exec npm run test:browser "$@"'')
            (pkgs.writeShellScriptBin "ci-arch" ''exec npm run arch "$@"'')
            (pkgs.writeShellScriptBin "ci-nav" ''exec npm run nav "$@"'')
            (pkgs.writeShellScriptBin "ci-bytes" ''exec npm run bytes "$@"'')
            (pkgs.writeShellScriptBin "ci-tailwind" ''exec npm run tailwind "$@"'')
            (pkgs.writeShellScriptBin "ci-tokens" ''exec npm run tokens "$@"'')
            (pkgs.writeShellScriptBin "ci-knip" ''exec npm run knip "$@"'')
            # npm run lint, not a bare biome call: the script carries --error-on-warnings
            # (a warning nobody has to fix is a rule nobody enforces) and its prelint
            # node_modules check, so this wrapper is what CI runs rather than something
            # close to it.
            (pkgs.writeShellScriptBin "ci-biome" ''exec npm run lint "$@"'')
            (pkgs.writeShellScriptBin "ci-messages-check" ''exec npm run messages:check "$@"'')
            (pkgs.writeShellScriptBin "ci-bake-check" ''exec npm run songs:bake -- --check "$@"'')
            (pkgs.writeShellScriptBin "ci-news-check" ''exec npm run news:check "$@"'')
            (pkgs.writeShellScriptBin "ci-twip" ''exec npm run twip -- "$@"'')
            # The locale lives in package.json's build:single, which the a11y sweeps and
            # ci-lighthouse also run — so every per-visitor budget measures the same tree.
            (pkgs.writeShellScriptBin "ci-build" ''exec npm run build:single "$@"'')
            # Builds the site it audits, so Lighthouse can never read an all-locales tree
            # left behind by something else. CI uses the pinned lhci action against the
            # build job's artifact; this is the local equivalent of that pairing.
            (pkgs.writeShellScriptBin "ci-lighthouse" ''
              set -e
              npm run build:single
              node dev/single-locale-build.mjs "the lighthouse gate"
              exec npx --yes @lhci/cli autorun "$@"
            '')
            (pkgs.writeShellScriptBin "ci-size" ''exec npm run size "$@"'')
            (pkgs.writeShellScriptBin "ci-parity" ''exec npm run ci:parity "$@"'')
          ];
        in
        {
          default = devshell.lib.mkDevShell {
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
