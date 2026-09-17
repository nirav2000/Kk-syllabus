import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {createHash,timingSafeEqual} from 'node:crypto';

const syncToken=defineSecret('OPENDAY_SYNC_TOKEN');
const allowedOrigin='https://nirav2000.github.io';
const stateRef=()=>getFirestore().doc('app_private_state/openday');

function hash(value){return createHash('sha256').update(String(value||''),'utf8').digest()}
function authorised(given){
  const expected=syncToken.value();
  if(!expected||!given)return false;
  return timingSafeEqual(hash(given),hash(expected));
}
function sanitiseState(input){
  const state=input&&typeof input==='object'?input:{};
  const notes={};
  for(const [key,value] of Object.entries(state.notes||{}))notes[String(key).slice(0,120)]=String(value??'').slice(0,10000);
  const booked={};for(const [key,value] of Object.entries(state.booked||{}))booked[String(key).slice(0,120)]=!!value;
  return {
    saved:Array.isArray(state.saved)?state.saved.slice(0,250).map(x=>String(x).slice(0,120)):[],
    booked,
    notes,
    watchBooking:Array.isArray(state.watchBooking)?state.watchBooking.slice(0,250).map(x=>String(x).slice(0,120)):[],
    updatedAt:typeof state.updatedAt==='string'?state.updatedAt:new Date().toISOString()
  };
}

export const opendaySync=onRequest({
  region:'europe-west2',
  secrets:[syncToken],
  cors:[allowedOrigin],
  maxInstances:2,
  concurrency:20,
  timeoutSeconds:20
},async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!authorised(req.get('X-OpenDay-Token'))){res.status(401).json({error:'Token not recognised'});return}
  const ref=stateRef();
  if(req.method==='GET'){
    const snap=await ref.get();
    res.status(200).json({state:snap.exists?(snap.data()?.state||null):null});return;
  }
  if(req.method==='POST'){
    const state=sanitiseState(req.body?.state);
    if(Buffer.byteLength(JSON.stringify(state),'utf8')>180000){res.status(413).json({error:'State too large'});return}
    await ref.set({app:'openday',state,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    res.status(200).json({ok:true});return;
  }
  res.set('Allow','GET, POST');res.status(405).json({error:'Method not allowed'});
});
