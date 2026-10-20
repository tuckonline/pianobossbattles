import type {Page} from '@playwright/test';

// Exercise the same Web MIDI event path as a physical keyboard, including bursts
// arriving before React renders. No application-only test hooks are needed.
export async function installMidiKeyboard(page:Page) {
  await page.addInitScript(()=>{
    const input={id:'test-piano',name:'Test piano',state:'connected',onmidimessage:null as null|((event:{data:Uint8Array;timeStamp:number})=>void)};
    Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>({inputs:new Map([[input.id,input]]),onstatechange:null})});
    Object.assign(window,{sendMidi:(messages:number[][])=>{
      for(const message of messages) input.onmidimessage?.({data:new Uint8Array(message),timeStamp:performance.now()});
    }});
  });
}
export async function sendMidi(page:Page,messages:number[][]) {
  await page.evaluate(messages=>(window as unknown as {sendMidi:(messages:number[][])=>void}).sendMidi(messages),messages);
}
export async function playNotes(page:Page,pitches:number[]) {
  await sendMidi(page,pitches.flatMap(pitch=>[[0x90,pitch,90],[0x80,pitch,0]]));
}
