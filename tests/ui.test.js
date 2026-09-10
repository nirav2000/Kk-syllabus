import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<button id="parent">Grown-up view</button><main id="app"></main><div id="live"></div>',{url:'https://test.invalid',pretendToBeVisual:true});
for(const key of ['window','document','localStorage','CustomEvent','FormData'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
// A fake PIN and speech service belong only to this isolated test environment.
localStorage.setItem('curious-pin','2468');
globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
window.speechSynthesis={speak(u){u.onstart?.();},cancel(){}};
const {profiles,profileKey}=await import('../src/profiles.js');
const {objectives}=await import('../src/content.js');
await import('../src/app.js');
const $=selector=>document.querySelector(selector);
const click=selector=>{assert($(selector),'Missing '+selector);$(selector).click();};
const stored=()=>JSON.parse(localStorage.getItem(profileKey(profiles.activeId))).profile;
const submit=form=>$(form).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));

test('real UI answer reaches durable storage with timing/order; parent replay reads it',()=>{
  click('[data-start]');const stem=$('.prompt').textContent,item=objectives.flatMap(o=>o.items).find(i=>i.stem===stem);
  const choices=[...document.querySelectorAll('[data-choice]')].map(b=>b.textContent);
  document.querySelectorAll('[data-choice]')[0].click();const event=stored().events.at(-1);
  assert.equal(event.data.stem,stem);assert.deepEqual(event.data.choices,choices);assert.equal(event.data.response,choices[0]);assert.equal(event.data.expected,item.answer);assert(Number.isFinite(event.data.responseMs));
  click('#parent');assert(!$('#reports-panel'));$('.pin input').value='0000';submit('.pin');assert(!$('#reports-panel'));$('.pin input').value='2468';submit('.pin');
  assert($('#reports-panel').textContent.includes(stem));assert($('[data-replay]').textContent.includes(choices[0]));click('.close');click('[data-finish]');click('[data-home]');
});
test('word form stores typed recall; hint practise is supported and cannot be silently counted twice',()=>{
  click('[data-spelling]');assert($('[data-check]').disabled);click('[data-hear]');assert(!$('[data-check]').disabled);click('[data-help]');$('input[name="spelling"]').value='said';submit('#app form');
  const event=stored().events.at(-1);assert.equal(event.type,'word-answer');assert.equal(event.data.wordId,'word-said');assert(event.data.correct);assert(event.data.supported);const count=stored().events.length;submit('#app form');assert.equal(stored().events.length,count);
  click('[data-finish]');click('[data-home]');
});
test('vocabulary, word filters and parent practice range work through UI',()=>{
  click('[data-meaning]');const choice=$('[data-choice]').textContent;click('[data-choice]');assert.equal(stored().events.at(-1).data.mode,'meaning');assert.equal(stored().events.at(-1).data.response,choice);click('[data-finish]');click('[data-home]');
  click('#parent');$('.pin input').value='2468';submit('.pin');const mode=$('#word-panel [data-mode]');mode.value='meaning';mode.dispatchEvent(new window.Event('change'));assert($('#word-panel [data-counts]').textContent.includes('learning'));
  $('#word-panel select[name="min"]').value='7';$('#word-panel select[name="max"]').value='7';submit('#word-panel form');assert.equal(stored().events.at(-1).type,'word-settings');assert.equal(stored().events.at(-1).data.minYear,7);click('.close');
  click('[data-meaning]');assert.equal($('#app h2').textContent,'benevolent');click('[data-finish]');click('[data-home]');
});
test('question replay escapes stored text rather than creating executable markup',async()=>{
  const {mountReports}=await import('../src/reports.js');const r=document.createElement('div');document.body.append(r);mountReports(r,{events:[{ts:'2026-01-01',data:{correct:false,itemId:'safe',stem:'<img src=x onerror=alert(1)>',response:'<script>bad</script>'}}]});assert.equal(r.querySelector('img'),null);assert.equal(r.querySelector('script'),null);assert(r.textContent.includes('<script>bad</script>'));r.remove();
});
test('profile switch shows actual type separately from new-profile defaults',()=>{
  click('#profile-badge button');assert(!$('#profile-select'));$('.pin input').value='2468';submit('.pin');assert($('#profiles-panel').closest('details').open);assert($('.active-profile-card').textContent.includes('Test sandbox'));assert.equal($('#new-profile select[name="kind"]').value,'learner');
  $('#profile-select').value='learner-clean-v1';$('#profile-select').dispatchEvent(new window.Event('change'));assert($('.active-profile-card').textContent.includes('Learner profile'));assert($('#profile-badge').textContent.includes('LEARNER'));assert(!$('#reset-test'));click('.close');
});
test('parent opt-in exposes confirmed voice spelling and records the input method',()=>{
  let recognition;window.SpeechRecognition=class {constructor(){recognition=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){this.onend?.();}};
  click('#parent');$('.pin input').value='2468';submit('.pin');$('#word-panel input[name="voice"]').checked=true;submit('#word-panel form');click('.close');
  click('[data-spelling]');click('[data-hear]');click('[data-listen]');recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'s a i d'}],{isFinal:true})]});assert.equal($('input[name="spelling"]').value,'');click('[data-use]');assert.equal($('input[name="spelling"]').value,'said');submit('#app form');assert.equal(stored().events.at(-1).data.inputMethod,'voice-confirmed');assert(stored().events.at(-1).data.correct);assert(!stored().events.at(-1).data.supported);click('[data-finish]');click('[data-home]');
});
