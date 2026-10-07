import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { openContextMenu } from './contextMenu.js';

/** The three repeat modes, in the order shown to the user. */
const OPTIONS = [
  { mode: 'off', label: 'No repeat' },
  { mode: 'all', label: 'Repeat all (loop)' },
  { mode: 'one', label: 'Repeat one track' },
];

/**
 * Opens the repeat picker anchored to `anchor`.
 *
 * Exposing the modes as named choices avoids the old blind cycling button,
 * where it was impossible to tell "repeat one" from "repeat all".
 */
export function openRepeatMenu(anchor, { placement = 'above' } = {}) {
  const current = player.state.repeatMode;
  const rect = anchor.getBoundingClientRect();

  const items = [
    { header: true, label: `Repeat · ${OPTIONS.find((o) => o.mode === current)?.label ?? 'No repeat'}` },
    ...OPTIONS.map((option) => ({
      label: option.label,
      icon: icon(current === option.mode ? 'check' : option.mode === 'one' ? 'repeatOne' : 'repeat'),
      onClick: () => player.setRepeatMode(option.mode),
    })),
  ];

  const x = Math.max(8, rect.left - 60);
  const y = placement === 'above' ? rect.top - 190 : rect.bottom + 8;
  openContextMenu(x, y, items);
}
