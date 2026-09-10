const names={a:'a',ay:'a',b:'b',bee:'b',be:'b',c:'c',see:'c',sea:'c',d:'d',dee:'d',e:'e',ee:'e',f:'f',ef:'f',eff:'f',g:'g',gee:'g',h:'h',aitch:'h',haitch:'h',i:'i',eye:'i',j:'j',jay:'j',k:'k',kay:'k',l:'l',el:'l',ell:'l',m:'m',em:'m',n:'n',en:'n',o:'o',oh:'o',p:'p',pee:'p',q:'q',cue:'q',queue:'q',r:'r',ar:'r',are:'r',s:'s',ess:'s',es:'s',t:'t',tee:'t',tea:'t',u:'u',you:'u',v:'v',vee:'v',w:'w',x:'x',ex:'x',y:'y',why:'y',z:'z',zed:'z',zee:'z'};
export function parseSpokenLetters(transcript){
  const tokens=transcript.toLowerCase().replace(/double[ -]+(u|you)\b/g,'w').replace(/[.,;:!?-]/g,' ').trim().split(/\s+/).filter(Boolean);
  if(!tokens.length||tokens.length>40)return {ok:false,letters:''};
  let letters='';for(let i=0;i<tokens.length;i++){
    if(tokens[i]==='double'&&names[tokens[i+1]]){letters+=names[tokens[++i]].repeat(2);continue;}
    if(!Object.hasOwn(names,tokens[i]))return {ok:false,letters:''};letters+=names[tokens[i]];
  }
  return {ok:!!letters,letters};
}
// Browser-owned speech recognition is optional and may use a remote service.
// No audio recording or raw transcript is persisted by this app.
export function mountVoiceSpelling(root,{onConfirm,onError}){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  root.innerHTML=Recognition?'<button type="button" data-listen>Say the letters</button> <button type="button" data-stop-voice>Stop microphone</button><p data-voice-status role="status">Say one letter at a time. Check the letters before using them.</p><div data-transcript></div>':'<p class="small">Letter recognition is unavailable in this browser. You can still type the spelling.</p>';
  if(!Recognition)return {stop(){},dispose(){}};
  let recognition,disposed=false,finalText='',hadError=false;
  const status=text=>{if(!disposed)root.querySelector('[data-voice-status]').textContent=text;};
  const stop=()=>{try{recognition?.stop();}catch{}};
  root.querySelector('[data-stop-voice]').onclick=stop;
  root.querySelector('[data-listen]').onclick=()=>{
    if(disposed)return;
    try{recognition?.abort();}catch{}finalText='';hadError=false;root.querySelector('[data-transcript]').replaceChildren();
    recognition=new Recognition();recognition.lang='en-GB';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
    const current=recognition,live=()=>!disposed&&recognition===current;
    root.querySelector('[data-listen]').disabled=true;
    recognition.onstart=()=>{if(live())status('Listening for letters. You can stop at any time.');};
    recognition.onresult=event=>{
      if(!live())return;for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)finalText+=' '+event.results[i][0].transcript;
      const parsed=parseSpokenLetters(finalText);
      if(!parsed.ok){status('I could not separate those letters. Try saying each letter on its own, or type your spelling.');return;}
      status('Check what the microphone heard. Recognition can make mistakes.');
      const panel=root.querySelector('[data-transcript]');panel.innerHTML='<p data-letters></p><button type="button" data-use>I said these letters — use them</button> <button type="button" data-retry>Try speaking again</button>';
      panel.querySelector('[data-letters]').textContent=parsed.letters.toUpperCase().split('').join(' · ');
      panel.querySelector('[data-use]').onclick=()=>{stop();onConfirm(parsed.letters);panel.replaceChildren();status('Letters copied into your spelling box. Check them, then check your spelling.');};
      panel.querySelector('[data-retry]').onclick=()=>{stop();panel.replaceChildren();status('Tap Say the letters when you are ready.');};
    };
    recognition.onerror=event=>{if(!live())return;hadError=true;status(event.error==='not-allowed'?'Microphone access was not granted. You can type instead.':'The microphone could not recognise that attempt. Try again or type instead.');onError?.();};
    recognition.onend=()=>{if(live()){root.querySelector('[data-listen]').disabled=false;if(!finalText&&!hadError)status('Listening stopped. You can try again or type.');}};
    try{recognition.start();}catch{root.querySelector('[data-listen]').disabled=false;status('Microphone could not start. Try typing instead.');}
  };
  return {stop,dispose(){disposed=true;try{recognition?.abort();}catch{}root.querySelectorAll('button').forEach(b=>b.disabled=true);}};
}
