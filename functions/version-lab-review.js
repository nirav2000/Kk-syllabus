import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

const APP_MONITOR='https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor';
const ALLOWED_ORIGIN='https://nirav2000.github.io';
const choices=new Set(['keep','revert','rework','unsure']);

function cors(res){
  res.set('Access-Control-Allow-Origin',ALLOWED_ORIGIN);
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Headers','Content-Type,X-App-Monitor-Session');
  res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.set('Cache-Control','no-store');
}
function clean(v,n=4000){return String(v??'').trim().slice(0,n)}
function validAppId(v){return /^[A-Za-z0-9._-]{1,80}$/.test(v||'')}
async function requireDeveloper(req){
  const token=clean(req.get('X-App-Monitor-Session'),500);
  if(!token)throw Object.assign(new Error('Developer session required'),{status:401});
  const r=await fetch(APP_MONITOR+'/auth/session',{headers:{'X-App-Monitor-Session':token},cache:'no-store'});
  if(!r.ok)throw Object.assign(new Error('Developer session invalid or expired'),{status:401});
  return r.json();
}
function decisionId(versionId,areaId){
  return crypto.createHash('sha256').update(versionId+'\0'+areaId).digest('hex').slice(0,40);
}
function stateRefs(db,appId){
  const root=db.collection('version_lab_reviews').doc(appId);
  return {root,notes:root.collection('notes'),decisions:root.collection('decisions')};
}
async function readState(db,appId){
  const {notes,decisions}=stateRefs(db,appId);
  const [n,d]=await Promise.all([notes.orderBy('createdAt','asc').limit(1000).get(),decisions.limit(2000).get()]);
  return {
    comparisonNotes:n.docs.map(x=>({id:x.id,...x.data()})),
    decisions:Object.fromEntries(d.docs.map(x=>{const v=x.data();return [v.key,{choice:v.choice||'',note:v.note||'',updatedAt:v.updatedAt?.toDate?.().toISOString?.()||v.updatedAt||''}]}))
  };
}

export const versionLabReview=onRequest({
  region:'europe-west2',
  maxInstances:2,
  concurrency:20,
  timeoutSeconds:30,
  cors:false
},async(req,res)=>{
  cors(res);
  if(req.method==='OPTIONS'){res.status(204).end();return}
  if(req.get('Origin')&&req.get('Origin')!==ALLOWED_ORIGIN){res.status(403).json({error:'Origin not allowed'});return}
  try{
    await requireDeveloper(req);
    const db=getFirestore();
    const appId=clean(req.method==='GET'?req.query.appId:req.body?.appId,80);
    if(!validAppId(appId)){res.status(400).json({error:'Invalid appId'});return}

    if(req.method==='GET'){
      res.json(await readState(db,appId));
      return;
    }
    if(req.method!=='POST'){res.status(405).json({error:'Method not allowed'});return}

    const action=clean(req.body?.action,40),refs=stateRefs(db,appId);
    if(action==='addNote'){
      const note=req.body?.note||{},id=clean(note.id,100),versions=Array.isArray(note.versions)?note.versions.map(v=>clean(v,180)).filter(Boolean).slice(0,2):[];
      const focus=clean(note.focus,180),text=clean(note.text,4000),createdAt=clean(note.createdAt,80)||new Date().toISOString();
      if(!/^[A-Za-z0-9._-]{8,100}$/.test(id)||versions.length!==2||!text){res.status(400).json({error:'Invalid comparison note'});return}
      await refs.notes.doc(id).set({versions,focus,text,createdAt,updatedAt:FieldValue.serverTimestamp()});
      res.json({ok:true});return;
    }
    if(action==='removeNote'){
      const id=clean(req.body?.id,100);
      if(!/^[A-Za-z0-9._-]{8,100}$/.test(id)){res.status(400).json({error:'Invalid note id'});return}
      await refs.notes.doc(id).delete();res.json({ok:true});return;
    }
    if(action==='upsertDecision'){
      const versionId=clean(req.body?.versionId,180),areaId=clean(req.body?.areaId,180),choice=clean(req.body?.choice,20),note=clean(req.body?.note,4000);
      if(!versionId||!areaId||(choice&&!choices.has(choice))){res.status(400).json({error:'Invalid decision'});return}
      const key=versionId+':'+areaId,id=decisionId(versionId,areaId);
      await refs.decisions.doc(id).set({key,versionId,areaId,choice,note,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      res.json({ok:true});return;
    }
    res.status(400).json({error:'Unknown action'});
  }catch(e){
    console.error('versionLabReview',e);
    res.status(e.status||500).json({error:e.status===401?e.message:'Version Lab review storage failed'});
  }
});
