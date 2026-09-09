import test from 'node:test';
import assert from 'node:assert/strict';
import { gardenPicture } from '../src/garden-picture.js';

test('every supported rectangle has explicitly sized and painted tiles', () => {
  for (let w=1;w<=12;w++) for (let h=1;h<=12;h++) {
    const markup=gardenPicture(w,h);
    const tiles=[...markup.matchAll(/<rect data-tile="\d+" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"/g)];
    assert.equal(tiles.length,w*h);
    assert.equal(new Set(tiles.map(t=>t[1]+','+t[2])).size,w*h);
    for (const t of tiles) { assert.equal(+t[3],32);assert.equal(+t[4],32);assert(+t[1]>=5&&+t[1]+32<=5+w*32);assert(+t[2]>=5&&+t[2]+32<=5+h*32);assert(t[5]); }
    assert(markup.includes(`width="${w*32+10}" height="${h*32+10}"`));
    assert(!markup.includes('<i>'));
  }
});
test('boundary highlight traverses all four outside sides',()=>{
  const paths=Array.from({length:4},(_,edge)=>gardenPicture(6,4,'edge',edge).match(/<line[^>]+>/)[0]);
  assert.equal(new Set(paths).size,4);
  assert(paths[0].includes('x1="5" y1="5" x2="197" y2="5"'));
  assert(paths[2].includes('x1="197" y1="133" x2="5" y2="133"'));
  assert(!gardenPicture(6,4).includes('<line'));
});
