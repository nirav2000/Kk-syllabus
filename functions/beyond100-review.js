import { onCall,onRequest,HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash,randomBytes } from 'node:crypto';

const REGION='europe-west2';
const OWNER_UID='2AJSfYdtg5URWHv7HCzpNMmKIlg2';
const LEARNER_ID='sai-beyond100';
const APP_ID='beyond100';
const REVIEW_COLLECTION='beyond100_review_links';
const REVIEW_ENDPOINT='https://europe-west2-kk-syllabus.cloudfunctions.net/beyond100Review';
const ALLOWED_ACTIONS=new Set(['actioned','needs-user','open']);

const tokenHash=token=>createHash('sha256').update(String(token)).digest('hex');
const iso=()=>new Date().toISOString();

function assertOwner(request){
  if(request.auth?.uid!==OWNER_UID)throw new HttpsError('permission-denied','Parent account required.');
}
function cleanDays(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 7;
  return Math.min(30,Math.max(1,Math.round(n)));
}
function safeToken(value){
  const token=String(value||'');
  return /^[A-Za-z0-9_-]{40,120}$/.test(token)?token:null;
}
async function capability(db,token){
  const ref=db.doc(`${REVIEW_COLLECTION}/${tokenHash(token)}`),snap=await ref.get();
  if(!snap.exists)return null;
  const data=snap.data()||{},expires=data.expiresAt?.toDate?.()||new Date(data.expiresAt||0);
  if(data.revoked||!expires||expires.getTime()<=Date.now())return null;
  return {ref,data,expires};
}
function responseHeaders(res){
  res.set('Cache-Control','no-store, private');
  res.set('Pragma','no-cache');
  res.set('X-Robots-Tag','noindex, nofollow, noarchive');
  res.set('Referrer-Policy','no-referrer');
  res.set('Content-Type','application/json; charset=utf-8');
}
function reviewUrl(token,params={}){
  const u=new URL(REVIEW_ENDPOINT);u.searchParams.set('token',token);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
  return u.toString();
}

export const createBeyond100ReviewLink=onCall({region:REGION,cors:['https://nirav2000.github.io']},async request=>{
  assertOwner(request);
  const db=getFirestore(),days=cleanDays(request.data?.days),token=randomBytes(32).toString('base64url'),created=new Date(),expires=new Date(created.getTime()+days*86400000);
  await db.doc(`${REVIEW_COLLECTION}/${tokenHash(token)}`).set({
    app:APP_ID,ownerUid:OWNER_UID,learnerId:LEARNER_ID,createdAt:created,expiresAt:expires,revoked:false,lastAccessAt:null
  });
  return {url:reviewUrl(token),expiresAt:expires.toISOString(),days};
});

export const revokeBeyond100ReviewLink=onCall({region:REGION,cors:['https://nirav2000.github.io']},async request=>{
  assertOwner(request);
  const token=safeToken(request.data?.token);
  if(!token)throw new HttpsError('invalid-argument','Review token required.');
  const db=getFirestore(),ref=db.doc(`${REVIEW_COLLECTION}/${tokenHash(token)}`),snap=await ref.get();
  if(snap.exists)await ref.set({revoked:true,revokedAt:new Date()},{merge:true});
  return {revoked:true};
});

export const beyond100Review=onRequest({region:REGION,cors:false,maxInstances:2,timeoutSeconds:20},async(req,res)=>{
  responseHeaders(res);
  if(req.method!=='GET'){res.status(405).json({error:'GET only'});return;}
  const token=safeToken(req.query.token);
  if(!token){res.status(404).json({error:'Review link not found'});return;}
  const db=getFirestore(),cap=await capability(db,token);
  if(!cap){res.status(410).json({error:'Review link expired or revoked'});return;}
  await cap.ref.set({lastAccessAt:new Date()},{merge:true});

  const action=String(req.query.action||'');
  if(action){
    if(!ALLOWED_ACTIONS.has(action)){res.status(400).json({error:'Unsupported status action'});return;}
    const noteId=String(req.query.noteId||'');
    if(!/^[A-Za-z0-9_-]{8,120}$/.test(noteId)){res.status(400).json({error:'Invalid note id'});return;}
    const noteRef=db.doc(`families/${OWNER_UID}/learners/${LEARNER_ID}/progress/beyond100-note-${noteId}`);
    let changed=false;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(noteRef);if(!snap.exists)return;
      const data=snap.data()||{};if(data.app!==APP_ID||data.kind!=='note'||!data.value)return;
      const stamp=iso(),value={...data.value,status:action,updatedAt:stamp,reviewStatusUpdatedAt:stamp,reviewStatusUpdatedVia:'capability-link'};
      if(action==='actioned')value.reviewRequired=false;
      else value.reviewRequired=true;
      tx.set(noteRef,{...data,updatedAt:stamp,value});changed=true;
    });
    if(!changed){res.status(404).json({error:'Note not found'});return;}
    res.json({ok:true,noteId,status:action,refetch:reviewUrl(token)});return;
  }

  const snap=await db.collection(`families/${OWNER_UID}/learners/${LEARNER_ID}/progress`).get();
  const notes=snap.docs.map(d=>d.data()).filter(d=>d?.app===APP_ID&&d?.kind==='note'&&d?.value).map(d=>d.value)
    .filter(n=>n.reviewRequired!==false&&n.status!=='archived'&&n.status!=='actioned')
    .sort((a,b)=>Date.parse(a.updatedAt||a.createdAt||0)-Date.parse(b.updatedAt||b.createdAt||0))
    .map(n=>({
      id:n.id,
      status:n.status||'open',
      text:n.text||'',
      anchorId:n.anchorId||'',
      anchorLabel:n.anchorLabel||'',
      selectedText:n.selectedText||'',
      elementText:n.elementText||'',
      section:n.section||'',
      topic:n.topic||'',
      appVersion:n.version||'',
      page:n.page||'',
      createdAt:n.createdAt||null,
      updatedAt:n.updatedAt||null,
      actions:{
        markActioned:reviewUrl(token,{action:'actioned',noteId:n.id}),
        needsUser:reviewUrl(token,{action:'needs-user',noteId:n.id}),
        reopen:reviewUrl(token,{action:'open',noteId:n.id})
      }
    }));

  res.json({
    schema:'beyond100-review-v1',
    generatedAt:iso(),
    expiresAt:cap.expires.toISOString(),
    app:APP_ID,
    repository:'nirav2000/beyond100',
    workflow:{
      instruction:'Action safe, clear notes against the Beyond 100 repository. Mark a note actioned only after the requested change is committed and validation/deployment succeeds. Use needsUser when the note is ambiguous or requires a decision.',
      pendingCount:notes.length
    },
    notes
  });
});
