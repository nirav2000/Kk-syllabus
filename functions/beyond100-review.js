import { onCall,onRequest,HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash,randomBytes } from 'node:crypto';

const REGION='europe-west2';
const OWNER_UID='2AJSfYdtg5URWHv7HCzpNMmKIlg2';
const LEARNER_ID='sai-beyond100';
const APP_ID='beyond100';
const REVIEW_COLLECTION='beyond100_review_links';
const CONFIRM_COLLECTION='beyond100_review_confirmations';
const REVIEW_ENDPOINT='https://europe-west2-kk-syllabus.cloudfunctions.net/beyond100Review';
const ALLOWED_ACTIONS=new Set(['actioned','needs-user','open']);

const hash=value=>createHash('sha256').update(String(value)).digest('hex');
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
function safeNoteId(value){
  const noteId=String(value||'');
  return /^[A-Za-z0-9_-]{8,120}$/.test(noteId)?noteId:null;
}
async function capability(db,token){
  const ref=db.doc(`${REVIEW_COLLECTION}/${hash(token)}`),snap=await ref.get();
  if(!snap.exists)return null;
  const data=snap.data()||{};
  if(data.revoked)return null;
  const permanent=data.permanent===true;
  const expires=permanent?null:(data.expiresAt?.toDate?.()||new Date(data.expiresAt||0));
  if(!permanent&&(!expires||expires.getTime()<=Date.now()))return null;
  return {ref,data,expires,permanent};
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
  const db=getFirestore(),permanent=request.data?.permanent===true,days=cleanDays(request.data?.days),token=randomBytes(32).toString('base64url'),created=new Date(),expires=permanent?null:new Date(created.getTime()+days*86400000);
  await db.doc(`${REVIEW_COLLECTION}/${hash(token)}`).set({
    app:APP_ID,ownerUid:OWNER_UID,learnerId:LEARNER_ID,createdAt:created,expiresAt:expires,permanent,revoked:false,lastAccessAt:null
  });
  return {url:reviewUrl(token),expiresAt:expires?.toISOString()||null,permanent,days:permanent?null:days};
});

export const revokeBeyond100ReviewLink=onCall({region:REGION,cors:['https://nirav2000.github.io']},async request=>{
  assertOwner(request);
  const token=safeToken(request.data?.token);
  if(!token)throw new HttpsError('invalid-argument','Review token required.');
  const db=getFirestore(),ref=db.doc(`${REVIEW_COLLECTION}/${hash(token)}`),snap=await ref.get();
  if(snap.exists)await ref.set({revoked:true,revokedAt:new Date()},{merge:true});
  return {revoked:true};
});

async function requestAction(db,token,action,noteId){
  if(!ALLOWED_ACTIONS.has(action))return {error:'Unsupported status action',status:400};
  if(!safeNoteId(noteId))return {error:'Invalid note id',status:400};
  const noteRef=db.doc(`families/${OWNER_UID}/learners/${LEARNER_ID}/progress/beyond100-note-${noteId}`),note=await noteRef.get();
  if(!note.exists||note.data()?.app!==APP_ID||note.data()?.kind!=='note'||!note.data()?.value)return {error:'Note not found',status:404};
  const confirm=randomBytes(24).toString('base64url'),created=new Date(),expires=new Date(created.getTime()+10*60*1000);
  await db.doc(`${CONFIRM_COLLECTION}/${hash(confirm)}`).set({
    capabilityHash:hash(token),noteId,action,createdAt:created,expiresAt:expires,used:false
  });
  return {
    status:200,
    body:{
      ok:true,
      requiresConfirmation:true,
      noteId,
      requestedStatus:action,
      expiresAt:expires.toISOString(),
      instruction:'Open confirmUrl only if this status change is intentional. Merely opening the request URL does not change the note.',
      confirmUrl:reviewUrl(token,{confirm})
    }
  };
}

async function confirmAction(db,token,confirm){
  if(!safeToken(confirm))return {error:'Invalid confirmation',status:400};
  const confirmRef=db.doc(`${CONFIRM_COLLECTION}/${hash(confirm)}`),tokenDigest=hash(token);
  let outcome={error:'Confirmation expired, already used, or invalid',status:410};
  await db.runTransaction(async tx=>{
    const confirmation=await tx.get(confirmRef);
    if(!confirmation.exists)return;
    const c=confirmation.data()||{},expires=c.expiresAt?.toDate?.()||new Date(c.expiresAt||0);
    if(c.used||c.capabilityHash!==tokenDigest||!expires||expires.getTime()<=Date.now()||!ALLOWED_ACTIONS.has(c.action)||!safeNoteId(c.noteId))return;
    const noteRef=db.doc(`families/${OWNER_UID}/learners/${LEARNER_ID}/progress/beyond100-note-${c.noteId}`),note=await tx.get(noteRef);
    if(!note.exists)return;
    const data=note.data()||{};
    if(data.app!==APP_ID||data.kind!=='note'||!data.value)return;
    const stamp=iso(),value={...data.value,status:c.action,updatedAt:stamp,reviewStatusUpdatedAt:stamp,reviewStatusUpdatedVia:'confirmed-capability-link'};
    if(c.action==='actioned'){
      value.reviewRequired=false;
      value.actionedAt=stamp;
    }else{
      value.reviewRequired=true;
      delete value.actionedAt;
    }
    tx.set(noteRef,{...data,updatedAt:stamp,value});
    tx.set(confirmRef,{...c,used:true,usedAt:new Date()});
    outcome={status:200,body:{ok:true,noteId:c.noteId,status:c.action,refetch:reviewUrl(token)}};
  });
  return outcome;
}

export const beyond100Review=onRequest({region:REGION,cors:false,maxInstances:2,timeoutSeconds:20},async(req,res)=>{
  responseHeaders(res);
  if(req.method!=='GET'){res.status(405).json({error:'GET only'});return;}
  const token=safeToken(req.query.token);
  if(!token){res.status(404).json({error:'Review link not found'});return;}
  const db=getFirestore(),cap=await capability(db,token);
  if(!cap){res.status(410).json({error:'Review link expired or revoked'});return;}
  await cap.ref.set({lastAccessAt:new Date()},{merge:true});

  const confirm=String(req.query.confirm||'');
  if(confirm){
    const result=await confirmAction(db,token,confirm);
    res.status(result.status).json(result.body||{error:result.error});return;
  }

  const action=String(req.query.action||'');
  if(action){
    const result=await requestAction(db,token,action,String(req.query.noteId||''));
    res.status(result.status).json(result.body||{error:result.error});return;
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
        requestMarkActioned:reviewUrl(token,{action:'actioned',noteId:n.id}),
        requestNeedsUser:reviewUrl(token,{action:'needs-user',noteId:n.id}),
        requestReopen:reviewUrl(token,{action:'open',noteId:n.id})
      }
    }));

  res.json({
    schema:'beyond100-review-v1',
    generatedAt:iso(),
    expiresAt:cap.expires?.toISOString()||null,
    permanent:cap.permanent,
    app:APP_ID,
    repository:'nirav2000/beyond100',
    workflow:{
      instruction:'Action safe, clear notes against the Beyond 100 repository. To change a note status, first open the relevant request action URL. It returns a short-lived confirmUrl. Open that confirmUrl only after the requested change is committed and validation/deployment succeeds. Use needs-user when the note is ambiguous or requires a decision.',
      pendingCount:notes.length
    },
    notes
  });
});