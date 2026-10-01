// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether a reload may happen yet, and the rule that it must not happen mid-run.
//
// A new build taking over reloads the tab. A practice run in progress holds that
// reload: the player is at the keyboard, and a reload would throw the take away. So the
// reload is remembered, and paid out when the run ends.
//
// The two failures are opposites and both silent. A reload that fires while the hold is
// on loses a run. One that is remembered and never paid leaves the tab on an evicted
// cache, where the next lazy chunk 404s. In here neither can happen, because that is
// what the model SAYS — the question is whether the real hold agrees, which is asked by
// replaying these runs against it.
module reloadHold {
  // A run is in progress.
  var hold: bool
  // A reload is waiting for the run to finish.
  var owed: bool
  // How many reloads have happened — the whole observable claim.
  var reloads: int

  action init = all {
    hold' = false,
    owed' = false,
    reloads' = 0,
  }

  // A new build took control: reload now, or remember it for when the run ends.
  action wants = all {
    reloads' = if (hold) reloads else reloads + 1,
    owed' = hold,
    hold' = hold,
  }

  // Asking again at the next opportunity, which the app does on every hold change: it
  // pays what is owed, and nothing when nothing is.
  action flushes = all {
    reloads' = if (owed and not(hold)) reloads + 1 else reloads,
    owed' = if (not(hold)) false else owed,
    hold' = hold,
  }

  action runStarts = all {
    not(hold),
    hold' = true,
    owed' = owed, reloads' = reloads,
  }

  action runEnds = all {
    hold,
    hold' = false,
    owed' = owed, reloads' = reloads,
  }

  action step = any {
    wants,
    flushes,
    runStarts,
    runEnds,
  }

  // The safety property — no reload while a run is in progress — is structural in here:
  // `wants` cannot increment the count while `hold` is true, because that is what the
  // model says. So there is no invariant worth asserting about it, and writing one that
  // happens to hold would say nothing. What the model is FOR is the orders it walks, and
  // whether the real hold agrees is checked by replaying these runs against it.
  //
  // This leaves a sanity check, and the positive control is the replay's: a hold mutated
  // to ignore the run fails at the step where the counts part.
  val countsUp: bool = reloads >= 0

  val inv = countsUp
}
