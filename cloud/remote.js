'use strict';
// Only a publishable key belongs in this file. No privileged keys or sample data.
(() => {
 const url='https://knmnonnyjibgyieeisvi.supabase.co';
 const publishable='sb_publishable_mOp3LSXneYLwGtcKNQVmeg_j2a6j3Te';
 const sessionKey='ria-supabase-session-v1';
 const study=new URLSearchParams(location.search).get('study')==='reliability'?'reliability':'synthetic';
 let session,refreshing;
 try{session=JSON.parse(sessionStorage.getItem(sessionKey)||'null')}catch{session=null}
 function remember(s){session=s?s:null;if(session)session.expires_at=Date.now()+session.expires_in*1000;sessionStorage.setItem(sessionKey,JSON.stringify(session))}
 async function request(path,body,token){
  const response=await fetch(url+path,{method:'POST',headers:{apikey:publishable,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{}),cache:'no-store',credentials:'omit'});
  const text=await response.text();let result;try{result=JSON.parse(text)}catch{result={message:text}}
  if(!response.ok){const e=new Error(result.message||result.msg||result.error_description||result.error||'Сбой сервера');e.status=result.code==='23505'?409:response.status;throw e}return result;
 }
 async function token(){
  if(!session){const e=new Error('Войдите в аккаунт');e.status=401;throw e}
  if(session.expires_at<Date.now()+60000){
   if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(remember).finally(()=>{refreshing=null});
   await refreshing;
  }
  return session.access_token;
 }
 window.RIA_REMOTE={study,async api(action,data={}){
  if(action==='login'){
   if(!['coder_1','coder_2','admin'].includes(data.user))throw Error('Введите coder_1, coder_2 или admin');
   remember(await request('/auth/v1/token?grant_type=password',{email:data.user+'@ria-coding.invalid',password:data.password}));return {ok:true};
  }
  if(action==='logout'){await request('/auth/v1/logout?scope=local',{},await token());remember(null);return {ok:true}}
  return request('/rest/v1/rpc/ria_api',{action,payload:{...data,study}},await token());
 },async exportToDisk(){
  const result=await this.api('export');const zip=new JSZip();const sums=[];
  for(const file of result.files){const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file.content)))].map(v=>v.toString(16).padStart(2,'0')).join('');if(actual!==file.sha256)throw Error('SHA-256 экспорта не совпадает');zip.file(file.name,file.content);sums.push(file.sha256+'  '+file.name)}
  zip.file('SHA256SUMS.txt',sums.join('\n')+'\n');
  const blob=await zip.generateAsync({type:'blob'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='RIA_'+study+'_locked_results.zip';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),30000);
  return result.export_id;
 }};
})();
