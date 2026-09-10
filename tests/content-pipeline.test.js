import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mathsPacks} from '../src/maths-data.js';
import {words} from '../src/words-data.js';
test('generated sources match the builder',()=>{execFileSync(process.execPath,['content/build.mjs','--check'],{cwd:new URL('..',import.meta.url)});});
test('independent checker re-derives every new numeric answer from its question',()=>{
  for(const o of mathsPacks){assert.equal(o.items.length,9);for(const tier of [1,2,3])assert.equal(o.items.filter(i=>i.tier===tier).length,3);
    for(const i of o.items){let a,match;
      if(match=i.stem.match(/^Round (\d+) to the nearest (\d+)\.$/)){const value=+match[1],unit=+match[2],low=value-value%unit;a=value-low<unit/2?low:low+unit;}
      else if(match=i.stem.match(/^(\d+) tenths \+ (\d+) tenths/)){a=+match[1]+ +match[2];}
      else if(match=i.stem.match(/^What is (\d+)\/(\d+) of (\d+)\?$/)){a=+match[3]*(+match[1]/+match[2]);}
      else if(match=i.stem.match(/^What is (\d+)% of (\d+)\?$/)){a=+match[2]/100* +match[1];}
      else if(match=i.stem.match(/^How many minutes from (\d+):(\d+) to (\d+):(\d+)/)){a=(+match[3]- +match[1])*60+ +match[4]- +match[2];}
      else if(match=i.stem.match(/^Red to blue beads are (\d+):(\d+)\. There are (\d+)/)){let red=0;while(red<=+match[3]&&red* +match[2] !== (+match[3]-red)* +match[1])red++;a=red;}
      else if(match=i.stem.match(/^Find x: (\d+) × x = (\d+)\.$/)){a=+match[2]/+match[1];}
      else assert.fail('Unrecognised question: '+i.stem);
      assert(Math.abs(+i.answer-a)<1e-8,i.id);
    }
  }
});
test('word bands have original context, unique IDs and definitions',()=>{assert.equal(new Set(words.map(w=>w.id)).size,words.length);for(let year=1;year<=7;year++)assert(words.filter(w=>w.year===year).length>=12);for(const w of words){assert(w.sentence.toLowerCase().includes(w.word));assert(w.meaning.length>8);assert(w.word.match(/^[a-z]+$/));}});
