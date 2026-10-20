import type { Exercise, SoundNote } from "./sight-library";

// Transcribed from the Schirmer/Knecht edition supplied by the site owner.
// Digits are scale degrees C–G, not finger numbers. Each character is one
// sixteenth note; spaces only separate beams. Held voices last the full bar.
const degrees = [0, 0, 2, 4, 5, 7, 9, 11];
const exercises: Exercise[] = [];
const pageEnds = [
  10, 21, 32, 50, 68, 86, 104, 124, 142, 160, 171, 189, 205, 213,
];
function register(
  number: number,
  events: SoundNote[],
  duration: number,
  meter = 4,
) {
  const bars = Math.ceil(duration / meter);
  const notes = (hand: "right" | "left") =>
    Array.from({ length: bars }, (_, i) =>
      events
        .filter(
          (n) =>
            n.hand === hand && n.beat >= i * meter && n.beat < (i + 1) * meter,
        )
        .map((n) => ({ pitch: n.pitch, beats: n.beats, tie: false })),
    );
  exercises.push({
    number: 2000 + number,
    title: `Schmitt Op. 16 · Exercise ${number}`,
    right: notes("right"),
    left: notes("left"),
    polyphony: events,
    durationBeats: duration,
    beatsPerMeasure: meter,
    sourcePage: pageEnds.findIndex((end) => number <= end) + 1,
    collection: "schmitt-op16",
  });
}
function add(
  number: number,
  pattern: string,
  end: string,
  held = "",
  step = 0.25,
) {
  const groups = pattern
    .trim()
    .split(/\s+/)
    .join("")
    .match(/\[[1-7]+\]|[1-7]/g)!;
  const length = groups.length * step;
  const events: SoundNote[] = [];
  for (const hand of ["right", "left"] as const) {
    const pitch = (digit: string) =>
      (hand === "right" ? 60 : 48) + degrees[Number(digit)];
    groups.forEach((g, i) => {
      for (const d of g.replace(/[\[\]]/g, ""))
        events.push({ hand, pitch: pitch(d), beat: i * step, beats: step });
    });
    for (const d of held)
      events.push({ hand, pitch: pitch(d), beat: 0, beats: length });
    for (const d of end)
      events.push({ hand, pitch: pitch(d), beat: length, beats: 1 });
  }
  const duration = length + (end ? 1 : 0);
  register(number, events, duration, number === 19 || number === 20 ? 3 : 4);
}

add(1, "12345432".repeat(4), "1");
add(2, "54321234".repeat(4), "5");
add(3, "12435423".repeat(2), "1");
add(4, "54231243".repeat(2), "5");
add(5, "13243542".repeat(2), "1");
add(6, "53423124".repeat(2), "5");
add(7, "14253243".repeat(2), "1");
add(8, "52413423".repeat(2), "1");
add(9, "15453423".repeat(2), "1");
add(10, "51213243".repeat(2), "5");
add(11, "15323542".repeat(2), "1");
add(12, "51345324".repeat(2), "5");
add(13, "31425324".repeat(2), "5");
add(14, "35243124".repeat(2), "5");
add(15, "13425324".repeat(2), "5");
add(16, "53241342".repeat(2), "1");
add(17, "1212121212121234 5454545454545432", "1");
add(18, "1232323232323234 5434343434343432", "1");
add(19, "212132324343 545443433232", "1");
add(20, "213243543423", "1");
add(21, "1323123453435432", "1");
add(22, "5343543213231234", "5");
add(23, "1232123212321234 5434543454345432", "1");
add(24, "1323132313231234 5343534353435432", "1");
add(25, "2313231323134342 4535453545352324", "3");
add(26, "1213232434352324", "1");
add(27, "5454343232314342", "1");
add(28, "2131324243534345", "1");
add(29, "4535342423132321", "3");
add(30, "1231234234532342", "1");
add(31, "5435432432134324", "5");
add(32, "3213432454354324", "3");
add(33, "3453234212312342", "1");
add(34, "54323234".repeat(2), "5", "1");
add(35, "3542".repeat(4), "3", "1");
add(36, "3425".repeat(4), "3", "1");
add(37, "34342525".repeat(2), "3", "1");
add(38, "32432545".repeat(2), "3", "1");
add(39, "3524".repeat(4), "3", "1");
add(40, "3232434354543434", "3", "1");
add(41, "3541".repeat(4), "3", "2");
add(42, "4351".repeat(4), "3", "2");
add(43, "4153".repeat(4), "4", "2");
add(44, "4343434341354135", "4", "2");
add(45, "5454545451315131", "5", "2");
add(46, "21215454".repeat(2), "1", "3");
add(47, "2154".repeat(4), "1", "3");
add(48, "4215".repeat(4), "4", "3");
add(49, "42421515".repeat(2), "4", "3");
add(50, "1545".repeat(4), "1", "3");
add(51, "5241".repeat(4), "4", "3");
add(52, "5131".repeat(4), "5", "4");
add(53, "13231352".repeat(2), "3", "4");
add(54, "3152".repeat(4), "3", "4");
add(55, "2315".repeat(4), "3", "4");
add(56, "2121323253532323", "1", "4");
add(57, "43423231".repeat(2), "4", "5");
add(58, "4231".repeat(4), "4", "5");
add(59, "2413".repeat(4), "2", "5");
add(60, "2314".repeat(4), "2", "5");
add(61, "31234324".repeat(2), "3", "5");
add(62, "43434213".repeat(2), "4", "5");
add(63, "23232313".repeat(2), "2", "5");
add(64, "12121342".repeat(2), "1", "5");
add(65, "32123212".repeat(2), "3", "45");
add(66, "1232".repeat(4), "1", "45");
add(67, "3121".repeat(4), "3", "45");
add(68, "1323".repeat(4), "1", "45");
add(69, "2313".repeat(4), "2", "45");
add(70, "2131".repeat(4), "2", "45");
add(71, "23232313".repeat(2), "2", "45");
add(72, "21212131".repeat(2), "2", "45");
add(73, "2123".repeat(4), "2", "45");
add(74, "2321".repeat(4), "2", "45");
add(75, "1212121252525252", "5", "34");
add(76, "21212125".repeat(2), "1", "34");
add(77, "1215".repeat(4), "1", "34");
add(78, "5251".repeat(4), "5", "34");
add(79, "4545454545154515", "4", "23");
add(80, "4141414141454145", "4", "23");
add(81, "5154".repeat(4), "5", "23");
add(82, "1545".repeat(4), "1", "23");
add(83, "3454".repeat(4), "3", "12");
add(84, "5434".repeat(4), "5", "12");
add(85, "3545".repeat(4), "3", "12");
add(86, "5343".repeat(4), "5", "12");
add(87, "45434345".repeat(2), "4", "12");
add(88, "4535".repeat(4), "4", "12");
add(89, "4353".repeat(4), "4", "12");
add(90, "3434343434343435", "3", "12");
add(91, "3454545454545454", "3", "12");
add(92, "54343454".repeat(2), "3", "12");
add(93, "34354535".repeat(2), "3", "12");
add(94, "2454".repeat(4), "3", "13");
add(95, "5424".repeat(4), "3", "13");
add(96, "2425".repeat(4), "3", "13");
add(97, "4252".repeat(4), "3", "13");
add(98, "54545242".repeat(2), "5", "13");
add(99, "24242425".repeat(2), "2", "13");
add(100, "1353".repeat(4), "1", "24");
add(101, "3151".repeat(4), "3", "24");
add(102, "3515".repeat(4), "3", "24");
add(103, "3135".repeat(4), "3", "24");
add(104, "4121".repeat(4), "4", "35");
add(105, "2141".repeat(4), "2", "35");
add(106, "42424212".repeat(2), "4", "35");
add(107, "21212124".repeat(2), "2", "35");
add(108, "1242".repeat(4), "1", "35");
add(109, "1424".repeat(4), "1", "35");
add(110, "2414".repeat(4), "2", "35");
add(111, "11111111", "", "2345", 0.5);
add(112, "22222222", "", "1345", 0.5);
add(113, "33333333", "", "1245", 0.5);
add(114, "44444444", "", "1235", 0.5);
add(115, "55555555", "", "1234", 0.5);
add(116, "55551111", "", "234", 0.5);
add(117, "44442222", "", "135", 0.5);
add(118, "33335555", "", "124", 0.5);
add(119, "[13][24][35][24]".repeat(4), "13");
add(120, "[35][24][13][24]".repeat(4), "35");
add(121, "[24][13][24][35]".repeat(4), "24");
add(122, "[24][35][24][13]".repeat(4), "24");
add(123, "[13][24]".repeat(6) + "[13][24][35][24]", "13");
add(124, "[35][24]".repeat(6) + "[35][24][13][24]", "35");
add(125, "[24][13]".repeat(6) + "[24][13][24][35]", "24");
add(126, "[24][35]".repeat(6) + "[24][35][24][13]", "24");
add(127, "[24][13][24][13][24][35][24][35]".repeat(2), "24");
add(128, "[24][35]".repeat(8), "24", "1");
add(129, "[35][24]".repeat(8), "35", "1");
add(130, "[35]1".repeat(8), "35", "2");
add(131, "5[13]".repeat(8), "5", "2");
add(132, "1[35]4[35]".repeat(4), "1", "2");
add(133, "5[13]4[13]".repeat(4), "5", "2");
add(134, "[24][15]".repeat(8), "24", "3");
add(135, "[15][24]".repeat(8), "15", "3");
add(136, "1[24]5[24]".repeat(4), "1", "3");
add(137, "5[24]1[24]".repeat(4), "5", "3");
add(138, "1[45]2[45]".repeat(4), "1", "3");
add(139, "5[12]4[12]".repeat(4), "5", "3");
add(140, "[13][25]".repeat(8), "13", "4");
add(141, "[25][13]".repeat(8), "25", "4");
add(142, "[24][13]".repeat(8), "24", "5");
add(143, "[13][24]".repeat(8), "13", "5");
add(144, "2[13]".repeat(8), "2", "45");
add(145, "[13]2".repeat(8), "13", "45");
add(146, "[12]5".repeat(8), "12", "34");
add(147, "5[12]".repeat(8), "5", "34");
add(148, "1[45]".repeat(8), "1", "23");
add(149, "[45]1".repeat(8), "45", "23");
add(150, "3[45]".repeat(8), "3", "12");
add(151, "[45]3".repeat(8), "45", "12");
add(152, "45".repeat(8), "4", "123");
add(153, "21".repeat(8), "2", "345");
add(154, "15".repeat(8), "1", "234");
add(155, "51".repeat(8), "5", "234");
add(156, "24".repeat(8), "2", "135");
add(157, "42".repeat(8), "4", "135");
add(158, "1[35]".repeat(8), "1", "24");
add(159, "[35]1".repeat(8), "35", "24");
add(160, "[45]".repeat(8), "", "123", 0.5);
add(161, "[12]".repeat(8), "", "345", 0.5);
add(162, "[15]".repeat(8), "", "234", 0.5);
add(163, "[24]".repeat(8), "", "135", 0.5);
add(164, "[35]".repeat(8), "", "124", 0.5);
add(165, "[14]".repeat(8), "", "235", 0.5);
add(166, "[13]".repeat(8), "", "245", 0.5);
add(167, "[135]".repeat(8), "", "24", 0.5);
add(168, "[124]".repeat(8), "", "35", 0.5);
add(169, "[345]".repeat(8), "", "12", 0.5);

// White-key indices relative to middle C, for passages that change position.
const white = (index: number) =>
  60 +
  Math.floor(index / 7) * 12 +
  [0, 2, 4, 5, 7, 9, 11][((index % 7) + 7) % 7];
function passage(number: number, indices: number[], finalQuarter = false) {
  const events: SoundNote[] = [];
  for (const hand of ["right", "left"] as const)
    indices.forEach((index, i) =>
      events.push({
        pitch: white(index) - (hand === "left" ? 12 : 0),
        hand,
        beat: i * 0.25,
        beats: finalQuarter && i === indices.length - 1 ? 1 : 0.25,
      }),
    );
  register(number, events, indices.length * 0.25 + (finalQuarter ? 0.75 : 0));
}
const ascending = [0, 2, 3, 4, 5, 4, 3, 2];
const descending = [0, -2, -3, -4, -5, -4, -3, -2];
passage(
  170,
  [
    ...Array.from({ length: 9 }, (_, i) => ascending.map((n) => n + i)).flat(),
    ...ascending.slice(0, 5).map((n) => n + 9),
  ],
  true,
);
passage(
  171,
  [
    ...Array.from({ length: 9 }, (_, i) =>
      descending.map((n) => n + 14 - i),
    ).flat(),
    ...descending.slice(0, 5).map((n) => n + 5),
  ],
  true,
);
function twoPositions(
  number: number,
  base: number,
  offsets: number[],
  direction: number,
) {
  passage(number, [
    ...offsets.map((n) => n + base),
    ...offsets.map((n) => n + base + direction),
  ]);
}
twoPositions(172, 0, [0, 1, 3, 4, 5, 4, 3, 2], 1);
twoPositions(173, 14, [0, -1, -3, -4, -5, -4, -3, -2], -1);
twoPositions(174, 0, [0, 1, 2, 4, 5, 4, 3, 2], 1);
twoPositions(175, 14, [0, -1, -2, -4, -5, -4, -3, -2], -1);
twoPositions(176, 0, [0, 1, 2, 3, 5, 4, 3, 2], 1);
twoPositions(177, 14, [0, -1, -2, -3, -5, -4, -3, -2], -1);
twoPositions(178, 0, [0, 1, 3, 2, 5, 4, 2, 3], 1);
twoPositions(179, 14, [0, -1, -3, -2, -5, -4, -2, -3], -1);
twoPositions(180, 4, [0, -1, -3, -2, -4, -2, 0, -1], 1);
twoPositions(181, 10, [0, 1, 3, 2, 4, 2, 0, 1], -1);
twoPositions(182, 0, [0, 3, 2, 4, 3, 5, 4, 2], 1);
twoPositions(183, 14, [0, -3, -2, -4, -3, -5, -4, -2], -1);
twoPositions(184, 4, [0, -2, -1, -3, -2, -4, -2, 0], 1);
twoPositions(185, 12, [0, 2, -1, 1, 0, 2, 0, -2], -1);
twoPositions(186, 0, [0, 4, 2, 5, 3, 2, 4, 3], 1);
twoPositions(187, 14, [0, -4, -2, -5, -3, -4, -2, -3], -1);
twoPositions(188, 0, [0, 5, 4, 5, 3, 4, 2, 3], 1);
twoPositions(189, 14, [0, -5, -4, -5, -3, -4, -2, -3], -1);
twoPositions(190, 4, [0, -4, -3, -4, -2, -3, -1, -2], 1);
twoPositions(191, 10, [0, 4, 3, 4, 2, 3, 1, 2], -1);
twoPositions(192, 0, [0, 5, 3, 2, 3, 5, 4, 2], 1);
twoPositions(193, 14, [0, -5, -3, -2, -3, -5, -4, -2], -1);
twoPositions(194, 5, [0, -5, -2, -1, 0, -2, -3, -1], 1);
twoPositions(195, 9, [0, 5, 2, 3, 4, 2, 1, 3], -1);
twoPositions(196, 2, [0, -2, 2, 0, 3, 1, 0, 2], 1);
twoPositions(197, 12, [0, 2, -2, 0, -3, -1, 0, -2], -1);
twoPositions(198, 2, [0, 2, -1, 1, 0, -2, 0, 2], 1);
twoPositions(199, 14, [0, -2, -1, -3, -2, 0, -2, -4], -1);
twoPositions(200, 0, [0, 2, 3, 1, 5, 3, 2, 4], 1);
twoPositions(201, 14, [0, -2, -3, -1, -5, -3, -2, -4], -1);
twoPositions(202, 4, [0, -2, -3, -1, -4, -1, 0, -2], 1);
twoPositions(203, 10, [0, 2, 3, 1, 4, 1, 2, 0], -1);
passage(204, [
  ...[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 2, 3, 4],
  ...[5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 3, 2],
]);
passage(
  205,
  [
    14, 13, 14, 13, 14, 13, 14, 13, 14, 13, 14, 13, 14, 12, 11, 10, 9, 10, 9,
    10, 9, 10, 9, 10, 9, 10, 9, 10, 9, 10, 11, 12,
  ],
);
passage(
  206,
  [
    0, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 4, 5, 4, 3, 4, 3, 4, 3, 4, 3,
    4, 3, 4, 3, 4, 3, 2,
  ],
);
passage(
  207,
  [
    14, 12, 11, 12, 11, 12, 11, 12, 11, 12, 11, 12, 11, 12, 11, 10, 9, 10, 11,
    10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 12,
  ],
);
passage(
  208,
  [
    1, 0, 1, 0, 3, 2, 3, 2, 3, 2, 3, 2, 4, 3, 4, 3, 4, 3, 4, 3, 5, 4, 5, 4, 3,
    4, 3, 4, 2, 3, 2, 3,
  ],
);
passage(
  209,
  [
    13, 14, 13, 14, 11, 12, 11, 12, 11, 12, 11, 12, 10, 11, 10, 11, 10, 11, 10,
    11, 9, 10, 9, 10, 11, 10, 11, 10, 12, 11, 12, 11,
  ],
);
passage(
  210,
  [
    0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 3, 4, 5, 4, 3, 4, 5, 4, 3, 4, 5,
    4, 3, 4, 5, 4, 3, 2,
  ],
);
passage(
  211,
  [
    14, 13, 12, 13, 14, 13, 12, 13, 14, 13, 12, 13, 14, 12, 11, 10, 9, 10, 11,
    10, 9, 10, 11, 10, 9, 10, 11, 10, 9, 10, 11, 12,
  ],
);
passage(
  212,
  [
    1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 3, 4, 2, 4, 3, 4, 3, 5, 3, 4, 3, 5, 3,
    4, 3, 5, 3, 4, 2, 4,
  ],
);
passage(
  213,
  [
    13, 12, 14, 12, 13, 12, 14, 12, 13, 12, 14, 12, 11, 10, 12, 10, 11, 10, 11,
    9, 11, 10, 11, 9, 11, 10, 11, 9, 11, 10, 12, 10,
  ],
);

export const schmittLibrary = exercises;
