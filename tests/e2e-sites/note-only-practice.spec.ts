import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups,practicePass,type Exercise} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes,sendMidi} from './helpers/midi';
const bach=JSON.parse(readFileSync('hosted/data/bach.json','utf8'))[0] as Exercise;

test.beforeEach(async({page})=>{
  const id=`untimed-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
});

test('Bach accepts fast notes, staggered chords and long pauses with the clock frozen',async({page})=>{
  await page.goto('/student/practice?collection=bach');
  await page.locator('.notation .note').first().waitFor();
  await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByLabel('Show note hints').check();
  await page.clock.install({time:new Date("2026-10-14T12:00:00Z")});await page.clock.pauseAt(new Date("2026-10-14T12:00:01Z"));
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const groups=noteGroups(bach,'both');
  const progress=page.getByRole('progressbar',{name:'Exercise progress'});
  await sendMidi(page,[[0x80,74,0],[0x90,74,0],[0xb0,64,127]]);
  await expect(progress).toHaveAttribute('value','0');
  await playNotes(page,[groups[0].pitches[0]]);
  await expect(progress).toHaveAttribute('value','0');
  await page.clock.fastForward(120000);
  await expect(progress).toHaveAttribute('value','0');
  await playNotes(page,[127]);
  await expect(page.locator('.practice-progress')).toContainText('1 incorrect');
  await playNotes(page,groups[0].pitches.slice(1).reverse());
  await expect(progress).toHaveAttribute('value','1');
  await expect(page.getByText(/^Hold ·/)).toHaveCount(0);
  await playNotes(page,groups[1].pitches);
  await expect(progress).toHaveAttribute('value','2');
  await page.clock.fastForward(120000);
  await expect(progress).toHaveAttribute('value','2');
  // All remaining notes, including grace notes, rests and repeats, arrive in one
  // burst. No clock advances or note-duration waits are involved.
  await playNotes(page,groups.slice(2).flatMap(g=>g.pitches));
  await expect(page.getByText(/Saved · .*1 incorrect notes/)).toBeVisible();
  await page.reload();
  await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
  await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('1 learning');
});

test('continuous Schmitt passes cross boundaries in one MIDI burst and save exactly once per pass',async({page})=>{
  const saves:{omitClosing:boolean;played:number[]}[]=[];
  page.on('request',r=>{if(r.url().endsWith('/api/platform')&&r.method()==='POST'&&r.postDataJSON()?.action==='sightAttempt')saves.push(r.postDataJSON());});
  await page.goto('/student/practice?collection=schmitt');
  await page.getByLabel('Exercise',{exact:true}).selectOption('2010');
  await page.getByLabel('Practice passes').fill('3');
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.clock.install({time:new Date("2026-10-14T12:00:00Z")});await page.clock.pauseAt(new Date("2026-10-14T12:00:01Z"));
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const ex=schmittLibrary[9];
  const body=noteGroups(practicePass(ex,true),'both').flatMap(g=>g.pitches);
  const final=noteGroups(ex,'both').flatMap(g=>g.pitches);
  await playNotes(page,[...body,...body,...final]);
  await expect(page.getByText(/3 passes complete · Saved · 100%/)).toBeVisible();
  expect(saves.map(s=>s.omitClosing)).toEqual([true,true,false]);
  expect(saves.map(s=>s.played)).toEqual([body,body,final]);
  await playNotes(page,final);
  expect(saves).toHaveLength(3);
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await page.getByRole('button',{name:'Stop practice',exact:true}).click();
  await playNotes(page,final);
  await expect(page.getByText('Practice stopped. Start again when ready.')).toBeVisible();
  expect(saves).toHaveLength(3);
});
