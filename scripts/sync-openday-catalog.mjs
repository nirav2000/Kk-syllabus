import crypto from 'node:crypto';

const project='kk-syllabus';
const secret=process.env.FIREBASE_SERVICE_ACCOUNT;
if(!secret)throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KK_SYLLABUS repository secret.');
const creds=JSON.parse(secret);

const sources={
  senior:'https://raw.githubusercontent.com/nirav2000/Openday/main/data/schools.json',
  primary:'https://raw.githubusercontent.com/nirav2000/Openday/main/data/primary-schools.json',
  enhancements:'https://raw.githubusercontent.com/nirav2000/Openday/main/data/enhancements.json',
  version:'https://raw.githubusercontent.com/nirav2000/Openday/main/version.json'
};
async function getText(url){
  const r=await fetch(url,{headers:{'User-Agent':'kk-syllabus-openday-sync'}});
  if(!r.ok)throw new Error(`Fetch failed ${r.status}: ${url}`);
  return r.text();
}
const [seniorText,primaryText,enhancementsText,versionText]=await Promise.all([
  getText(sources.senior),getText(sources.primary),getText(sources.enhancements),getText(sources.version)
]);
const senior=JSON.parse(seniorText),primary=JSON.parse(primaryText),enhancements=JSON.parse(enhancementsText),release=JSON.parse(versionText);
const hash=crypto.createHash('sha256').update([seniorText,primaryText,enhancementsText,versionText].join('\n---\n')).digest('hex');

const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const unsigned=enc({alg:'RS256',typ:'JWT'})+'.'+enc({
  iss:creds.client_email,
  scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
  aud:creds.token_uri||'https://oauth2.googleapis.com/token',
  iat:now,
  exp:now+3600
});
const sig=crypto.sign('RSA-SHA256',Buffer.from(unsigned),creds.private_key).toString('base64url');
const tokenResponse=await fetch(creds.token_uri||'https://oauth2.googleapis.com/token',{
  method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({
    grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion:unsigned+'.'+sig
  })
});
if(!tokenResponse.ok)throw new Error(`OAuth failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
const {access_token}=await tokenResponse.json();
if(!access_token)throw new Error('OAuth response contained no access token.');

const docUrl=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/app_private_state/openday`;
const currentResponse=await fetch(docUrl,{headers:{Authorization:`Bearer ${access_token}`}});
if(currentResponse.ok){
  const current=await currentResponse.json();
  const existingHash=current.fields?.catalogHash?.stringValue||'';
  if(existingHash===hash){
    console.log(`Openday catalogue already current (${release.version}, ${hash.slice(0,12)}). No Firestore write required.`);
    process.exit(0);
  }
}else if(currentResponse.status!==404){
  throw new Error(`Firestore read failed: ${currentResponse.status} ${await currentResponse.text()}`);
}

const fields={
  app:{stringValue:'openday'},
  catalogSenior:{stringValue:JSON.stringify(senior)},
  catalogPrimary:{stringValue:JSON.stringify(primary)},
  catalogEnhancements:{stringValue:JSON.stringify(enhancements)},
  catalogVersion:{stringValue:String(release.version)},
  catalogHash:{stringValue:hash},
  catalogUpdatedAt:{timestampValue:new Date().toISOString()}
};
const mask=Object.keys(fields).map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
const write=await fetch(docUrl+'?'+mask,{
  method:'PATCH',
  headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},
  body:JSON.stringify({fields})
});
if(!write.ok)throw new Error(`Firestore catalogue sync failed: ${write.status} ${await write.text()}`);
console.log(`Published Openday ${release.version} catalogue to kk-syllabus Firestore (${hash.slice(0,12)}).`);
