export const notationPresets = {
  classic: {label: 'Classic Paper', paper: '#F7F3E8', ink: '#191917', current: '#1765CF', correct: '#116B59', incorrect: '#B91C1C'},
  studio: {label: 'Studio Light', paper: '#FFFFFF', ink: '#101010', current: '#0866E6', correct: '#116B59', incorrect: '#B91C1C'},
  slate: {label: 'Slate Focus', paper: '#D6E2EE', ink: '#15273B', current: '#0755C5', correct: '#075E4D', incorrect: '#AA1825'},
  night: {label: 'Night Mode', paper: '#091727', ink: '#F5F9FF', current: '#39DFFF', correct: '#64E5B9', incorrect: '#FF8595'},
} as const;
export type NotationPreset = keyof typeof notationPresets;
export const defaultNotationPreset: NotationPreset = 'studio';
