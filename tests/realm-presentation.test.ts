import { expect, it } from "vitest";
import { animationDuration, clockRestoration, completePresentation, emptyPresentation, readPresentation, type RealmAnimation } from "../src/domains/realms/presentation";
import { emptyProgress } from "../src/domains/realms/registry";

const events: RealmAnimation[] = [
  {type:"realm-enter",firstVisit:true},{type:"realm-enter",firstVisit:false},
  {type:"trial-enter",trialId:"steady-pulse",firstVisit:true},{type:"trial-enter",trialId:"steady-pulse",firstVisit:false},
  {type:"trial-complete",trialId:"steady-pulse",difficulty:1,firstClear:true,stars:3,goldEarned:2,accuracy:100,improved:false},
  {type:"trial-complete",trialId:"steady-pulse",difficulty:1,firstClear:false,stars:3,goldEarned:0,accuracy:100,improved:true},
  {type:"trial-failed",trialId:"steady-pulse"},
];
it("uses bounded Balanced sequences, immediate retries and an immediate reduced-motion path", () => {
  expect(emptyPresentation().preference).toBe("balanced");
  expect(events.map(e=>animationDuration(e,"balanced",false))).toEqual([6500,2300,2800,0,4600,2600,1300]);
  expect(events.map(e=>animationDuration(e,"cinematic",false))).toEqual(events.map(e=>animationDuration(e,"balanced",false)));
  expect(events.every(e=>animationDuration(e,"minimal",false)===0&&animationDuration(e,"balanced",true)===0)).toBe(true);
});
it("marks visits only when completion/skip is acknowledged and leaves reward data untouched", () => {
  const initial=emptyPresentation(), snapshot=structuredClone(events);
  expect(readPresentation(JSON.stringify(initial)).seen).toEqual([]);
  let seen=completePresentation(initial,events[0]);
  seen=completePresentation(seen,events[2]);
  seen=completePresentation(seen,events[4]);
  expect(seen.seen).toEqual(["realm:clockwork-kingdom","entry:steady-pulse","clear:1:steady-pulse"]);
  expect(initial.seen).toEqual([]);
  expect(completePresentation(seen,events[4])).toBe(seen);
  expect(completePresentation(seen,events[6])).toBe(seen);
  expect(events).toEqual(snapshot);
  expect(readPresentation("corrupt")).toEqual(initial);
  expect(readPresentation(JSON.stringify({...initial,preference:"invalid",seen:[1,"entry:steady-pulse"]}))).toEqual({...initial,seen:["entry:steady-pulse"]});
});
it("derives the clock entirely from saved trial completions and the boss flag", () => {
  const progress=emptyProgress();
  expect(clockRestoration(progress)).toEqual({completedTrials:0,bossDefeated:false});
  const record={completed:true,bestStars:1,bestAccuracy:75,bestPitch:75,bestRhythm:75,bestStreak:8,attempts:1,lastConfig:{version:1 as const,challengeId:"steady-pulse",key:"C" as const,tempo:50,seed:1}};
  progress.challenges["steady-pulse"]=record;
  progress.challenges["broken-clockwork"]={...record,completed:false,attempts:10};
  progress.rewards.push("Brass Gear");
  expect(clockRestoration(progress)).toEqual({completedTrials:1,bossDefeated:false});
  for(const id of ["broken-clockwork","syncopation-trap","hands-of-time","perfect-mechanism"])progress.challenges[id]=record;
  progress.bossDefeated=true;
  expect(clockRestoration(progress)).toEqual({completedTrials:5,bossDefeated:true});
});
