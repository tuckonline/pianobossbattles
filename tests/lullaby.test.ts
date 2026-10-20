import {expect,it} from 'vitest';
import data from '../hosted/data/repertoire.json';
it('retains the active repertoire after the requested Lullaby removal',()=>{
 expect(data.map(e=>e.number)).toEqual([7003,7004,7005]);
});
