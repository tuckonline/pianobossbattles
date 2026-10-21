import {afterEach,expect,it,vi} from 'vitest';
import {configurePlatformSessionRecovery,platformRequest} from '../src/lib/platform-request';
afterEach(()=>{configurePlatformSessionRecovery();vi.unstubAllGlobals();});
it('leaves legacy requests and non-authentication errors unchanged',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('',{status:401}));vi.stubGlobal('fetch',fetch);
 await platformRequest({action:'gameState'});expect(fetch).toHaveBeenCalledTimes(1);
 const recover=vi.fn();configurePlatformSessionRecovery(recover);
 fetch.mockResolvedValue(new Response('',{status:503}));await platformRequest({action:'gameState'});
 expect(recover).not.toHaveBeenCalled();
});
it('retries the identical checkpoint once after recovery, including its identity and sequence',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response('',{status:401})).mockResolvedValue(new Response('{}'));
 vi.stubGlobal('fetch',fetch);const recover=vi.fn().mockResolvedValue(true);configurePlatformSessionRecovery(recover);
 const receipt={action:'gameSync',attemptId:'same-attempt',expectedUserId:'same-player',sequence:12,played:[60,64]};
 expect((await platformRequest(receipt)).status).toBe(200);expect(recover).toHaveBeenCalledTimes(1);
 expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1]);
});
it('coalesces concurrent recovery and never loops on a second 401',async()=>{
 let release!:(ok:boolean)=>void;
 const recover=vi.fn(()=>new Promise<boolean>(resolve=>{release=resolve;}));configurePlatformSessionRecovery(recover);
 const fetch=vi.fn().mockImplementation(async()=>new Response('',{status:401}));vi.stubGlobal('fetch',fetch);
 const first=platformRequest({action:'gameState'}),second=platformRequest({action:'gameState'});
 await vi.waitFor(()=>expect(recover).toHaveBeenCalledTimes(1));release(true);
 expect((await first).status).toBe(401);expect((await second).status).toBe(401);expect(fetch).toHaveBeenCalledTimes(4);
});
it.each([false,'error'])('keeps the rejected response when recovery cannot succeed (%s)',async(result)=>{
 const fetch=vi.fn().mockResolvedValue(new Response('',{status:401}));vi.stubGlobal('fetch',fetch);
 configurePlatformSessionRecovery(async()=>{if(result==='error')throw Error('offline');return false;});
 expect((await platformRequest({action:'gameSync'})).status).toBe(401);expect(fetch).toHaveBeenCalledTimes(1);
});
