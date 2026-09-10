import { objectives } from './content.js';
import { words } from './words-data.js';
import { escapeHTML as h } from './attempts.js';
import { requestExplanation } from './cloud-sync.js';
export const strategies={concrete:'Use objects and a small demonstration',steps:'Break the reasoning into smaller steps',contrast:'Compare a correct idea with a tempting mistake',transfer:'Try the idea in a different situation'};
export function explanationCatalog(){return [...objectives.flatMap(o=>o.items.map(i=>({id:i.id,title:o.title,question:i.stem,answer:i.answer,hint:i.hint}))),...words.map(w=>({id:w.id,title:'Word meaning and spelling',question:`Explain the word ${w.word}. Context: ${w.sentence}`,answer:w.meaning,hint:'Explain meaning, letter patterns and a new example.'}))];}
export function teachingPrompt(item,strategy){return `Create a short explanation for a parent to use with a child. Topic: ${item.title}. Question: ${item.question} Known answer: ${item.answer}. Approach: ${strategies[strategy]||strategies.concrete}. Start with a relatable example, explain why the idea works, then give one different problem to check transfer. Use calm language. Asking for help is welcome. Do not infer any diagnosis or ask for personal information. Keep it under 200 words.`;}
export function mountExplanationPanel(root,profile,onShow){
  const catalog=explanationCatalog(),recent=profile.events.filter(e=>e.data?.itemId||e.data?.wordId).at(-1),recentId=recent?.data.wordId||recent?.data.itemId;
  root.innerHTML=`<h3>Another way to explain</h3><p>Choose a question and teaching approach. Built-in hints work immediately. Live AI generation needs the optional Firebase function and server-held OpenAI key. Review generated explanations before showing them to the learner.</p><label>Question<select data-question>${catalog.map(i=>`<option value="${h(i.id)}" ${i.id===recentId?'selected':''}>${h(i.question)}</option>`).join('')}</select></label><label>Teaching approach<select data-strategy>${Object.entries(strategies).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><p data-hint></p><button data-generate>Generate an explanation</button> <button data-copy>Copy prompt for your own ChatGPT</button><p data-status role="status"></p><div data-preview></div>`;
  const selected=()=>catalog.find(i=>i.id===root.querySelector('[data-question]').value);
  const render=()=>{root.querySelector('[data-hint]').textContent=selected().hint;root.querySelector('[data-preview]').replaceChildren();};
  root.querySelector('[data-question]').onchange=render;root.querySelector('[data-strategy]').onchange=render;
  root.querySelector('[data-copy]').onclick=async()=>{const prompt=teachingPrompt(selected(),root.querySelector('[data-strategy]').value);try{await navigator.clipboard.writeText(prompt);root.querySelector('[data-status]').textContent='Prompt copied. Paste it into your own ChatGPT conversation and review the explanation together.';}catch{const area=document.createElement('textarea');area.value=prompt;area.readOnly=true;root.querySelector('[data-preview]').replaceChildren(area);area.select();}};
  root.querySelector('[data-generate]').onclick=async()=>{
    const button=root.querySelector('[data-generate]');button.disabled=true;root.querySelector('[data-status]').textContent='Requesting a different explanation…';
    try{const result=await requestExplanation(selected().id,root.querySelector('[data-strategy]').value);if(!root.isConnected)return;
      if(typeof result?.explanation!=='string'||typeof result?.check!=='string')throw Error('Invalid explanation');
      root.querySelector('[data-preview]').innerHTML=`<p>${h(result.explanation)}</p><p><b>Try next:</b> ${h(result.check)}</p><button data-show>Reviewed — show this explanation</button>`;
      root.querySelector('[data-show]').onclick=()=>onShow(result);root.querySelector('[data-status]').textContent='AI-generated draft: check the reasoning and wording before sharing.';
    }catch{root.querySelector('[data-status]').textContent='Live explanations are not available. Sign in to family cloud and deploy the optional explain function with its server secret. You can use the built-in hint or copy the prompt now.';}finally{button.disabled=false;}
  };render();
}
