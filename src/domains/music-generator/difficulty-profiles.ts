export const difficultyProfiles = [
  { name: "Beginner", span: 7, leap: 5, rhythms: [[1, 1, 2], [2, 1, 1], [1, 1, 1, 1]] },
  { name: "Elementary", span: 9, leap: 7, rhythms: [[1, .5, .5, 1, 1], [.5, .5, 1, 1, 1], [1, 1, 2]] },
  { name: "Intermediate", span: 11, leap: 7, rhythms: [[1.5, .5, 1, 1], [.5, 1, .5, 1, 1], [.5, .5, .5, .5, 1, 1]] },
  { name: "Advanced", span: 13, leap: 9, rhythms: [[.25, .25, .25, .25, .5, .5, 1, 1], [1.5, .5, .5, .5, .5, .5], [.5, .5, 1, .25, .25, .25, .25, 1]] },
  { name: "Expert", span: 14, leap: 12, rhythms: [[.25, .25, .25, .25, .5, .5, .25, .25, .25, .25, 1], [.75, .25, .5, .5, .25, .25, .25, .25, 1], [.5, .5, .25, .25, .25, .25, .5, .5, 1]] },
] as const;

// Musical curriculum presets are independent of MIDI timing forgiveness.
// Keep v1 generator profiles above intact so old seeds still reconstruct.
export const musicalTiers = [
  {name:"Novice",tempo:50,range:[40,60],description:"Fixed five-note position, quarter/half notes and one held bass note per bar."},
  {name:"Beginner",tempo:65,range:[55,75],description:"Short stepwise phrases, introductory eighth notes and simple accompaniment."},
  {name:"Intermediate",tempo:80,range:[70,100],description:"Dotted rhythms, gentle syncopation and two-hand patterns."},
  {name:"Advanced",tempo:105,range:[90,125],description:"Sixteenth-note figures, wider movement and richer harmony."},
  {name:"Maestro",tempo:130,range:[110,160],description:"Denser subdivisions, wider registers and demanding coordination."},
] as const;
export const noviceProfile = {span:2,leap:4,rhythms:[[2,2],[1,1,2],[2,1,1]]} as const;
