import {afterEach,expect,it,vi} from 'vitest';
import {RequestBackoff} from '../hosted/request-backoff';
afterEach(()=>vi.useRealTimers());
it('backs off repeated outages to one retry per minute and restores immediate service on success',()=>{
 vi.useFakeTimers();vi.setSystemTime(0);const retry=new RequestBackoff();
 expect(retry.remaining()).toBe(0);
 for(const delay of [3000,6000,12000,24000,48000,60000,60000]){
  retry.failed();expect(retry.remaining()).toBe(delay);
  vi.advanceTimersByTime(delay-1);expect(retry.remaining()).toBe(1);
  vi.advanceTimersByTime(1);expect(retry.remaining()).toBe(0);
 }
 retry.succeeded();expect(retry.remaining()).toBe(0);
 retry.failed();expect(retry.remaining()).toBe(3000);
});
