const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const quiet = { error() {}, log() {}, warn() {} };
const loan = { condo:'1',bank:'2',tower:'A',unit:'1',floor:'1',buyerName:'Test Buyer',coBuyerName:'NA',email:'test@example.com',phone:'09171234567',isAgreed:true };
const customer = { firstName:'Test',lastName:'Buyer',email:'test@example.com',phone:'09171234567',project:'1',typeOfInquiry:'Customer Support',message:'Help' };
const forms = [
  ['loan_application','app/actions/loan.ts','submitLoanPreApplicationAction',loan],
  ['inquiry','app/actions/admin_fetchers.ts','submitInquiryAction',customer],
  ['contact','app/actions/admin_fetchers.ts','submitContactAction',customer],
];

function load(file, imports = {}, env = {}, fetchImpl) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const module = {exports:{}};
  new Function('require','module','exports','process','fetch','console',code)(
    name=>Object.hasOwn(imports,name)?imports[name]:require(name),module,module.exports,{env},fetchImpl,quiet,
  );
  return module.exports;
}

function harness(form, options = {}) {
  const [action,file,name,data] = form;
  const requests=[], queries=[], writes=[];
  const env = { NODE_ENV:'production',TURNSTILE_SECRET_KEY:'fixture-server-secret',...options.env };
  let reused=false;
  const verifier=load('lib/security/form-turnstile.ts',{},env,async(url,request)=>{
    requests.push({url,body:JSON.parse(request.body)});
    if(options.throw)throw new Error('PRIVATE network detail');
    const body=options.replay&&reused ? {success:false,'error-codes':['timeout-or-duplicate']}
      : options.body ?? {success:true,action,hostname:'goldentopper.vercel.app'};
    reused=true;
    return {ok:options.httpOK!==false,json:async()=>{if(options.badJSON)throw new Error('PRIVATE JSON detail');return body;}};
  });
  class Query {
    constructor(table){this.table=table;queries.push(table);}
    select(){return this;} eq(){return this;} ilike(){return this;} order(){return this;} limit(){return this;} is(){return this;}
    insert(value){this.value=value;writes.push({table:this.table,value});return this;}
    update(value){writes.push({table:this.table,value});return this;}
    async maybeSingle(){return {data:this.table==='client'?null:{id:1},error:null};}
    async single(){return {data:{id:1,...this.value},error:null};}
    then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject);}
  }
  const actions=load(file,{
    '@supabase/supabase-js':{createClient:()=>({from:table=>new Query(table)})},
    '@/lib/security/form-turnstile':verifier,
    '@/lib/validations/loan':load('lib/validations/loan.ts'),
    '@/lib/customer-inbox':{},'./auth':{},
  },env);
  return {submit:token=>actions[name](data,token),requests,queries,writes};
}

for(const form of forms){
  const action=form[0];
  test(`${action}: missing/malformed CAPTCHA is rejected before any database access`,async()=>{
    for(const token of [undefined,null,'','  ',123,{},'x'.repeat(2049)]){
      const h=harness(form);const result=await h.submit(token);
      assert.equal(result.success,false);assert.match(result.error,/verification/);
      assert.equal(h.requests.length,0);assert.deepEqual(h.queries,[]);
    }
  });
  test(`${action}: verified request saves expected data without persisting CAPTCHA`,async()=>{
    const h=harness(form);assert.deepEqual(await h.submit('single-use-token'),{success:true});
    assert.equal(h.requests.length,1);
    assert.deepEqual(h.requests[0].body,{secret:'fixture-server-secret',response:'single-use-token'});
    assert.ok(h.writes.length>0);
    assert.equal(JSON.stringify(h.writes).includes('single-use-token'),false);
  });
  test(`${action}: failures, reused tokens, cross-form tokens and bad hosts never query/write the database`,async()=>{
    for(const options of [
      {body:{success:false,'error-codes':['timeout-or-duplicate']}},
      {body:{success:false}}, {body:{success:'true',action,hostname:'goldentopper.vercel.app'}},
      {body:{success:true,action:action==='inquiry'?'contact':'inquiry',hostname:'goldentopper.vercel.app'}},
      {body:{success:true,action,hostname:'attacker.example'}}, {body:{success:true,action}},
      {httpOK:false},{throw:true},{badJSON:true}, {env:{TURNSTILE_SECRET_KEY:''}},
    ]){
      const h=harness(form,options);const result=await h.submit('token');
      assert.equal(result.success,false,JSON.stringify(options));assert.match(result.error,/verification/i);
      assert.equal(result.error.includes('PRIVATE'),false);assert.deepEqual(h.queries,[]);
    }
    const h=harness(form,{replay:true});assert.equal((await h.submit('token')).success,true);
    const before=h.queries.length;assert.equal((await h.submit('token')).success,false);
    assert.equal(h.queries.length,before);
  });
}

test('production and preview reject Cloudflare test secrets before verification',async()=>{
  for(const secret of ['1x0000000000000000000000000000000AA','2x0000000000000000000000000000000AA','3x0000000000000000000000000000000AA']){
    for(const env of [{NODE_ENV:'production'},{NODE_ENV:'development',VERCEL_ENV:'preview'}]){
      const h=harness(forms[0],{env:{...env,TURNSTILE_SECRET_KEY:secret}});
      assert.equal((await h.submit('token')).success,false);assert.equal(h.requests.length,0);assert.deepEqual(h.queries,[]);
    }
  }
});
test('local dummy keys support the documented dummy action while real keys require the expected action',async()=>{
  const body={success:true,hostname:'localhost',action:'test'};
  const local=harness(forms[0],{env:{NODE_ENV:'development',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'},body});
  assert.equal((await local.submit('XXXX.DUMMY.TOKEN.XXXX')).success,true);
  const real=harness(forms[0],{env:{NODE_ENV:'development'},body});assert.equal((await real.submit('token')).success,false);
});
test('custom production and preview hosts require exact allowed hostnames',async()=>{
  const custom=harness(forms[1],{env:{TURNSTILE_ALLOWED_HOSTNAMES:'www.example.com, example.com'},body:{success:true,action:'inquiry',hostname:'www.example.com'}});
  assert.equal((await custom.submit('token')).success,true);
  const previewEnv={VERCEL_ENV:'preview',VERCEL_URL:'preview-123.vercel.app',ALLOW_PREVIEW_CAPTCHA_HOSTS:'true'};
  for(const [hostname,allowed] of [['preview-123.vercel.app',true],['other.vercel.app',false],['preview-123.vercel.app.attacker.com',false]]){
    const h=harness(forms[2],{env:previewEnv,body:{success:true,action:'contact',hostname}});
    assert.equal((await h.submit('token')).success,allowed);
  }
  const disabled=harness(forms[2],{env:{...previewEnv,ALLOW_PREVIEW_CAPTCHA_HOSTS:'false'},body:{success:true,action:'contact',hostname:'preview-123.vercel.app'}});
  assert.equal((await disabled.submit('token')).success,false);assert.deepEqual(disabled.queries,[]);
});

function clientSubmit(file, options={}){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='onSubmit')initializer=node.initializer.getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(initializer);
  const requests=[],notices=[],resets=[],errors=[],formResets=[];
  let reads=0;
  const verification={getToken:()=>{reads++;return reads===1?(options.initialToken===undefined?'initial':options.initialToken):(options.currentToken===undefined?'fresh-current':options.currentToken);},reset:()=>resets.push(true)};
  const action=async(...args)=>{requests.push(args);if(options.throw)throw new Error('Transport failed');return options.result??{success:true};};
  const dependencies={verification,projects:[{id:1,title:'Project'}],initialBanks:[{id:2,bank_name:'Bank'}],
    selectedProjectId:'1',projectFromUrl:null,
    requestFormConsent:async notice=>{notices.push(notice);return options.accepted!==false;},
    submitLoanPreApplicationAction:action,submitInquiryAction:action,submitContactAction:action,
    setErrorMessage:value=>errors.push(value),setSuccessMessage(){},setIsSuccess(){},
    setModalConfig:value=>{if(value.type==='error'||value.isOpen&&file.includes('contact'))errors.push(value.message);},
    reset:()=>formResets.push(true),setIsModalOpen(){},setTimeout(){},console:quiet,process:{env:{NODE_ENV:'production'}},
  };
  const module={exports:{}};
  const code=ts.transpileModule(`module.exports=${initializer}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('module',...Object.keys(dependencies),code)(module,...Object.values(dependencies));
  return {submit:module.exports,requests,notices,resets,errors,formResets};
}

for(const [name,file,data] of [
  ['loan','app/partnerbanks/partnerbanksclient.tsx',loan],
  ['inquiry','app/inquire/inquireclient.tsx',customer],
  ['contact','app/contact/contactclient.tsx',customer],
]){
  test(`${name} client: missing or expired verification stops submission before or after privacy review`,async()=>{
    const missing=clientSubmit(file,{initialToken:null});await missing.submit(data);
    assert.deepEqual(missing.requests,[]);assert.deepEqual(missing.notices,[]);
    const expired=clientSubmit(file,{currentToken:null});await expired.submit(data);
    assert.equal(expired.notices.length,1);assert.deepEqual(expired.requests,[]);assert.deepEqual(expired.formResets,[]);
  });
  test(`${name} client: cancelling privacy preserves form and CAPTCHA; acceptance uses the latest token`,async()=>{
    const cancelled=clientSubmit(file,{accepted:false});await cancelled.submit(data);
    assert.deepEqual(cancelled.requests,[]);assert.deepEqual(cancelled.resets,[]);assert.deepEqual(cancelled.formResets,[]);
    const accepted=clientSubmit(file);await accepted.submit(data);
    assert.deepEqual(accepted.requests,[[data,'fresh-current']]);assert.equal(accepted.resets.length,1);assert.equal(accepted.formResets.length,1);
  });
  test(`${name} client: rejection and transport failures preserve entered data and reset the consumed token`,async()=>{
    for(const options of [{result:{success:false,error:'Verification failed'}},{throw:true}]){
      const ui=clientSubmit(file,options);await ui.submit(data);
      assert.equal(ui.requests.length,1);assert.equal(ui.resets.length,1);assert.deepEqual(ui.formResets,[]);
      assert.ok(ui.errors.some(Boolean));
    }
  });
}
