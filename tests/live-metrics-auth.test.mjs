import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/app/admin/(panel)/ao-vivo/actions.ts',import.meta.url),'utf8');
function actions(cookie, configured='server-session') {
  let calls=0;
  const module={exports:{}};
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,process:{env:{ADMIN_SESSION_TOKEN:configured}},require(name){
    if(name==='next/headers') return {cookies:async()=>({get:()=>({value:cookie})})};
    if(name==='@/lib/supabase/server') return {supabaseAdmin:()=>{calls++;return {rpc:async()=>({data:{kind:'test',title:'Fixture'},error:null})};}};
    return require(name);
  }});
  return {get:module.exports.getLiveDashboard,calls:()=>calls};
}
const id='10000000-0000-4000-8000-000000000001';
test('live metrics reject missing, forged and unconfigured admin sessions before reading data',async()=>{
  for(const [cookie,configured] of [[undefined,'server-session'],['forged','server-session'],[undefined,undefined],['','']]){
    const a=actions(cookie,configured);
    await assert.rejects(a.get('test',id),/Sessão expirada/);
    assert.equal(a.calls(),0);
  }
});
test('live metrics reject invalid targets and allow a valid admin to read the comparison',async()=>{
  const a=actions('server-session');
  assert.equal(await a.get('test','not-an-id'),null);
  assert.equal(await a.get('invalid',id),null);
  assert.equal(a.calls(),0);
  assert.equal((await a.get('test',id)).title,'Fixture');
  assert.equal(a.calls(),1);
});
