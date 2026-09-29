// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A new build taking over the tab, and the rule that it must not do so mid-run.
//
// The watcher learns a build is waiting, the player accepts it or a natural boundary
// takes it, the service worker changes control, and the tab reloads onto the new build.
// A practice run in progress holds that reload: the player is at the keyboard, and a
// reload would throw the take away. So the reload is parked, and paid out when the run
// ends.
//
// What the model is for is the interleavings, not the invariant: in here a reload
// cannot fire while the hold is on, because that is what the model SAYS. The question
// is whether the real watcher agrees, and that is asked by replaying these runs against
// it — the reload count and the parked flag are compared after every step, so a real
// reload that fires a step early shows up as a count the model never reached.
module swUpdate {
  var applying: bool
  var ready: bool
  var parked: bool
  var hold: bool
  var reloads: int

  action init = all {
    applying' = false,
    ready' = false,
    parked' = false,
    hold' = false,
    reloads' = 0,
  }

  // A newer build finishes installing and parks itself.
  action offer = all {
    ready' = true,
    applying' = applying, parked' = parked, hold' = hold,
    reloads' = reloads,
  }

  // The player accepts it.
  action apply = all {
    ready,
    applying' = true,
    ready' = ready, parked' = parked, hold' = hold,
    reloads' = reloads,
  }

  // A natural boundary takes it, but only while nothing is in progress.
  action applyIfIdle = all {
    ready, not(hold),
    applying' = true,
    ready' = ready, parked' = parked, hold' = hold,
    reloads' = reloads,
  }

  // Control passes to a new build — this tab's doing, or another tab's. The reload it
  // asks for fires now, or waits for the run.
  action controlChanges = all {
    applying' = false,
    reloads' = if (hold) reloads else reloads + 1,
    parked' = hold,
    ready' = ready, hold' = hold,
  }

  action runStarts = all {
    not(hold),
    hold' = true,
    applying' = applying, ready' = ready, parked' = parked,
    reloads' = reloads,
  }

  // The run ends, and whatever waited is paid out — once.
  action runEnds = all {
    hold,
    hold' = false,
    reloads' = if (parked) reloads + 1 else reloads,
    parked' = false,
    applying' = applying, ready' = ready,
  }

  // dispose is deliberately absent from the exploration. A disposed watcher does
  // nothing, so a run that disposes on its second step spends the remaining nineteen
  // exploring an inert machine — which is exactly what happened, and it left the one
  // interleaving the rule is about (a control change arriving mid-run) unreached in
  // every trace. The teardown has its own test; the model is for the orders.
  action step = any {
    offer,
    apply,
    applyIfIdle,
    controlChanges,
    runStarts,
    runEnds,
  }

  // Nothing is owed once the run is over: a parked reload survives only as long as the
  // hold it waits for.
  val paysWhatItOwes: bool = parked implies hold
  val countsUp: bool = reloads >= 0

  val inv = paysWhatItOwes and countsUp
}
