import {expect,it,vi} from 'vitest';
import {createApi} from '../public-app/api';
const {getUser}=vi.hoisted(()=>({getUser:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser}})}));
it.each([0,429,503])('does not label provider failure %s as an expired/unverified account',async(status)=>{
 getUser.mockResolvedValue({data:{user:null},error:{status}});
 const api=createApi('https://example.test','https://example.supabase.co','fixture');
 const r=await api(new Request('https://example.test/api/auth/session',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({accessToken:'fixture'})}),null);
 expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'Account verification is temporarily unavailable. Your progress remains queued.'});
});
it('retains authentication enforcement for a rejected token',async()=>{
 getUser.mockResolvedValue({data:{user:null},error:{status:401}});
 const api=createApi('https://example.test','https://example.supabase.co','fixture');
 const r=await api(new Request('https://example.test/api/auth/session',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({accessToken:'fixture'})}),null);
 expect(r.status).toBe(401);expect((await r.json()).error).toContain('Sign in again');expect(r.headers.has('set-cookie')).toBe(false);
});
