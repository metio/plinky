// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The on-screen keyboard's input protocol: who is holding which note, and how a hold
// begins and ends. A note sounds while at least one source holds it; a source is a
// pointer, the computer key that activates the roved key, or the click a screen reader
// synthesizes and then auto-releases.
//
// What this exists to check is the one failure a player would hear: a note still
// sounding when nothing is holding it any more.
module keybed {
  pure val NOTES = Set(60, 61, 62)
  pure val POINTERS = Set("p1", "p2")
  pure val NO_NOTE = -1

  // Which sources hold each note. Every note is a key of this map, holding the empty
  // set when it is silent.
  var heldBy: int -> Set[str]
  // The note each pointer currently sounds. A pointer that is down but off the keys —
  // in a gap, on the badge, past the edge — is down with NO_NOTE, and re-entering a key
  // presses it again.
  var at: str -> int
  // The pointers that are down, tracked apart from the note so a glide off the keys
  // releases the note yet stays live.
  var down: Set[str]
  // The note the computer key holds, and the note the screen reader's click holds.
  var keyNote: int
  var clickNote: int

  pure def holders(h: int -> Set[str], n: int): Set[str] = h.get(n)

  val sounding: Set[int] = NOTES.filter(n => holders(heldBy, n) != Set())

  action pressBy(src: str, n: int): bool = heldBy' = heldBy.set(n, heldBy.get(n).union(Set(src)))
  action releaseBy(src: str, n: int): bool = heldBy' = heldBy.set(n, heldBy.get(n).exclude(Set(src)))

  action init = all {
    heldBy' = NOTES.mapBy(n => Set()),
    at' = POINTERS.mapBy(p => NO_NOTE),
    down' = Set(),
    keyNote' = NO_NOTE,
    clickNote' = NO_NOTE,
  }

  // A pointer goes down on a key.
  action pointerDown(p: str, n: int): bool = all {
    not(down.contains(p)),
    down' = down.union(Set(p)),
    at' = at.set(p, n),
    pressBy(p, n),
    keyNote' = keyNote,
    clickNote' = clickNote,
  }

  // A press held while the finger slides across the keybed: the key it leaves is
  // released and the key it enters is pressed, by the same source.
  action pointerGlide(p: str, n: int): bool = {
    // A glide that starts off the keys — the press drifted into a gap and came back —
    // has no key to release, so only the entered one is pressed.
    val left = if (at.get(p) == NO_NOTE) heldBy else heldBy.set(at.get(p), heldBy.get(at.get(p)).exclude(Set(p)))
    all {
      down.contains(p),
      at.get(p) != n,
      at' = at.set(p, n),
      heldBy' = left.set(n, left.get(n).union(Set(p))),
      down' = down,
      keyNote' = keyNote,
      clickNote' = clickNote,
    }
  }

  // The same press dragged into a gap, onto the badge, or off the keybed: the note goes,
  // the press stays live.
  action pointerOff(p: str): bool = all {
    down.contains(p),
    at.get(p) != NO_NOTE,
    releaseBy(p, at.get(p)),
    at' = at.set(p, NO_NOTE),
    down' = down,
    keyNote' = keyNote,
    clickNote' = clickNote,
  }

  // Lifting, and cancelling, which the browser sends instead of a lift when it takes the
  // press away — a scroll starting, the page losing the pointer.
  action pointerUp(p: str): bool = all {
    down.contains(p),
    heldBy' = if (at.get(p) == NO_NOTE) heldBy else heldBy.set(at.get(p), heldBy.get(at.get(p)).exclude(Set(p))),
    at' = at.set(p, NO_NOTE),
    down' = down.exclude(Set(p)),
    keyNote' = keyNote,
    clickNote' = clickNote,
  }

  // Enter or Space on the roved key, and its release.
  action keyDown(n: int): bool = all {
    keyNote == NO_NOTE,
    keyNote' = n,
    pressBy("key", n),
    at' = at,
    down' = down,
    clickNote' = clickNote,
  }

  action keyUp: bool = all {
    keyNote != NO_NOTE,
    releaseBy("key", keyNote),
    keyNote' = NO_NOTE,
    at' = at,
    down' = down,
    clickNote' = clickNote,
  }

  // A screen reader's synthesized activation, which sounds a note and releases it on a
  // timer of its own rather than on an event.
  action clickPress(n: int): bool = all {
    clickNote == NO_NOTE,
    clickNote' = n,
    pressBy("click", n),
    at' = at,
    down' = down,
    keyNote' = keyNote,
  }

  action clickAutoRelease: bool = all {
    clickNote != NO_NOTE,
    releaseBy("click", clickNote),
    clickNote' = NO_NOTE,
    at' = at,
    down' = down,
    keyNote' = keyNote,
  }

  // The keyboard leaving the page mid-press: no release event will ever arrive for what
  // is held, so it is let go here.
  action unmount: bool = all {
    down != Set() or keyNote != NO_NOTE or clickNote != NO_NOTE or sounding != Set(),
    heldBy' = NOTES.mapBy(n => Set()),
    at' = POINTERS.mapBy(p => NO_NOTE),
    down' = Set(),
    keyNote' = NO_NOTE,
    clickNote' = NO_NOTE,
  }

  action step = any {
    nondet p = POINTERS.oneOf() nondet n = NOTES.oneOf() pointerDown(p, n),
    nondet p = POINTERS.oneOf() nondet n = NOTES.oneOf() pointerGlide(p, n),
    nondet p = POINTERS.oneOf() pointerOff(p),
    nondet p = POINTERS.oneOf() pointerUp(p),
    nondet n = NOTES.oneOf() keyDown(n),
    keyUp,
    nondet n = NOTES.oneOf() clickPress(n),
    clickAutoRelease,
    unmount,
  }

  // The failure a player would hear: nothing is holding anything, and a note is still
  // sounding.
  val noStuckNote: bool =
    (down == Set() and keyNote == NO_NOTE and clickNote == NO_NOTE) implies sounding == Set()

  // A note is held only by sources that are really holding it: a pointer that is down
  // and on that key, the computer key, or the click.
  val holdersAreReal: bool = NOTES.forall(n =>
    heldBy.get(n).forall(src =>
      if (src == "key") keyNote == n
      else if (src == "click") clickNote == n
      else down.contains(src) and at.get(src) == n))

  // Every pointer that is down sounds at most one note, and that note knows about it.
  val pointerHoldsItsOwnNote: bool = POINTERS.forall(p =>
    (down.contains(p) and at.get(p) != NO_NOTE) implies heldBy.get(at.get(p)).contains(p))

  val inv = noStuckNote and holdersAreReal and pointerHoldsItsOwnNote
}
