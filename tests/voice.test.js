import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {parseSpokenLetters,mountVoiceSpelling} from '../src/voice-spelling.js';
test('spoken letter names are decoded without treating whole-word dictation as spelling',()=>{
  assert.deepEqual(parseSpokenLetters('S A I D'),{ok:true,letters:'said'});
  assert.equal(parseSpokenLetters('bee ee aitch a why').letters,'behay');
  assert.equal(parseSpokenLetters('double you, a, tee, ee, are').letters,'water');
  assert.equal(parseSpokenLetters('a double c o double m o d a t e').letters,'accommodate');
  for(const text of ['said','accommodate','cat','the letters are cat','', 'hello there'])assert.equal(parseSpokenLetters(text).ok,false);
});
test('microphone requires a tap and explicit transcript confirmation; dispose stops it',()=>{
  const dom=new JSDOM('<section></section>');globalThis.window=dom.window;let instance,starts=0,stops=0,confirmed='';
  window.SpeechRecognition=class {constructor(){instance=this;}start(){starts++;this.onstart?.();}stop(){stops++;this.onend?.();}abort(){this.onend?.();}};
  const root=window.document.querySelector('section'),view=mountVoiceSpelling(root,{onConfirm:x=>confirmed=x});
  assert.equal(starts,0);root.querySelector('[data-listen]').click();assert.equal(starts,1);
  instance.onresult({resultIndex:0,results:[Object.assign([{transcript:'s a i d'}],{isFinal:true})]});assert.equal(confirmed,'');assert(root.textContent.includes('S · A · I · D'));
  root.querySelector('[data-use]').click();assert.equal(confirmed,'said');assert(stops>0);view.dispose();root.querySelector('[data-listen]').click();assert.equal(starts,1);delete globalThis.window;
});
test('unsupported browsers get a typing fallback without a pretend microphone',()=>{const dom=new JSDOM('<section></section>');globalThis.window=dom.window;const root=window.document.querySelector('section');mountVoiceSpelling(root,{onConfirm(){}});assert.equal(root.querySelector('button'),null);assert(root.textContent.includes('type'));delete globalThis.window;});
