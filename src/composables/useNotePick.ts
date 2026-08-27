import { computed, reactive } from 'vue';

import type { NotePick } from '../utils/notePick';
import { emptyPick, pickFromKey, pitchOf } from '../utils/notePick';

export type UseNotePick = ReturnType<typeof useNotePick>;

// The one pick behind every note input: widget taps and keydowns funnel
// through choose(), which hands back the finished pitch the moment letter and
// octave are both set, resetting itself for the next prompt.
export function useNotePick(options: { octaves: () => number[] }) {
  const pick = reactive(emptyPick());
  const octaves = computed(options.octaves);

  function reset() {
    Object.assign(pick, emptyPick());
  }

  // Applies a partial pick; returns the spelled pitch on completion, else null.
  function choose(partial: Partial<NotePick>): string | null {
    if (partial.octave !== undefined) {
      // An octave before any letter is a stray tap or keypress, not an answer;
      // an octave the layout does not offer never grades.
      if (!partial.letter && !pick.letter) return null;
      if (!octaves.value.includes(partial.octave)) return null;
    }
    Object.assign(pick, partial);
    const pitch = pitchOf(pick);
    if (pitch) reset();
    return pitch;
  }

  function onKeydown(key: string): string | null {
    if (key === 'Escape') {
      reset();
      return null;
    }
    const partial = pickFromKey(key);
    return partial ? choose(partial) : null;
  }

  return { pick, octaves, reset, choose, onKeydown };
}
