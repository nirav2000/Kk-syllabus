import { onCall,HttpsError } from 'firebase-functions/v2/https';
import { defineSecret,defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import { allowedRequest,modelRequest } from './policy.js';
initializeApp();
const key=defineSecret('OPENAI_API_KEY'),model=defineString('OPENAI_MODEL');
const catalog=JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url),'utf8'));
const owner='2AJSfYdtg5URWHv7HCzpNMmKIlg2';
export const explain=onCall({region:'europe-west2',secrets:[key],maxInstances:1,concurrency:5,timeoutSeconds:40,cors:['https://nirav2000.github.io']},async request=>{
  if(request.auth?.uid!==owner)throw new HttpsError('permission-denied','Parent account required.');
  let item;try{item=allowedRequest(request.data,catalog);}catch{throw new HttpsError('invalid-argument','Choose a curriculum item and approach.');}
  const db=getFirestore(),date=new Date().toISOString().slice(0,10),ref=db.doc(`explanation_limits/${owner}-${date}`);
  await db.runTransaction(async tx=>{const old=await tx.get(ref),count=old.data()?.count||0;if(count>=20)throw new HttpsError('resource-exhausted','Daily explanation limit reached.');tx.set(ref,{count:count+1});});
  // Only public curriculum content goes to OpenAI. No Firebase UID, events,
  // child nickname, free text, timestamps, audio or performance is transmitted.
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key.value()}`,'Content-Type':'application/json'},body:JSON.stringify(modelRequest(item,request.data.strategy,model.value())),signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error('Provider failed');const body=await response.json();
    const text=(body.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');const result=JSON.parse(text);
    if(typeof result.explanation!=='string'||typeof result.check!=='string'||result.explanation.length>4000||result.check.length>1000)throw Error('Invalid output');
    return result;
  }catch{throw new HttpsError('unavailable','Explanation unavailable. Use the built-in teaching card.');}
});
