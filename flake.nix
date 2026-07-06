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
# nixpkgs pin, so the `playwright` npm dependency is held to the matching version
# (Renovate lock-maintenance bumps nixpkgs; a paired npm bump follows).
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
      devShells = forAllSystems (pkgs: {
        default = ci.lib.mkDevShell {
          inherit pkgs;
          packages = [
            pkgs.nodejs_24
            pkgs.jq # the aggregate gate and a few dev scripts read job/JSON output
          ];
          env = {
            # The browsers ship in the nix closure, so playwright must not try to
            # download its own into a read-only store path.
            PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          };
          menu = ''echo "  plus node ${pkgs.nodejs_24.version} and chromium ${pkgs.playwright-driver.version} for the vitest browser + a11y gates."'';
        };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt-rfc-style);
    };
}
