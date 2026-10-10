import test from 'node:test';
import assert from 'node:assert/strict';
import { appendReasoning, reasoningAt, reasoningRound } from './reasoning-spiral.js';
const origin = { kind:'propose', id:'a', forWhom:'readers', relation:{subject:'Sat',verb:'is',object:'existence'}, witnesses:['book#20-35'] };
const support=(id,witnesses=['book#20-35'])=>({kind:'assess',id,verdict:'supported',method:'testimony',by:'independent-byte-auditor',basis:'source span verified',witnesses});
const dependent={kind:'propose',id:'b',forWhom:'reader',relation:{subject:'Sat',verb:'implies',object:'existence'},premises:['a']};
const assessDeduct=(id,verdict='supported')=>({kind:'assess',id,method:'deduction',verdict,by:'rule-evaluator',license:'modus-ponens',basis:'under this license'});
const push=(log,events)=>events.reduce((acc,e)=>appendReasoning(acc,e),log);
test('a refuted derivative becomes suspended when its premise is withdrawn',()=>{
 let l=push([],[origin,support('a'),dependent,assessDeduct('b','refuted')]);
 assert.equal(reasoningAt(l).claims.find(x=>x.id==='b').standing,'refuted');
 l=appendReasoning(l,{kind:'withdraw',id:'a',basis:'counterexample'});
 assert.equal(reasoningAt(l).claims.find(x=>x.id==='b').standing,'suspended');
});
test('nested metadata are not mutable across append boundaries',()=>{
 const e={...origin,ext:{nested:{weights:[1,2]}}};
 const l=appendReasoning([],e);
 e.ext.nested.weights.push(3);
 assert.throws(()=>l[0].ext.nested.weights.push(4),TypeError);
 assert.deepEqual(l[0].ext.nested.weights,[1,2]);
});
test('a verdict callback cannot overwrite assessment event type or target identity',async()=>{
 const r=await reasoningRound([], [origin], {assess:()=>({kind:'withdraw',id:'phantom',verdict:'supported',method:'testimony',by:'auditor',basis:'raw bytes',witnesses:['book#20-35']})});
 assert.equal(r.fold.claims.find(x=>x.id==='a').standing,'supported');
 assert.equal(r.fold.refused.length,0);
 assert.equal(r.log[1].id,'a');assert.equal(r.log[1].kind,'assess');
});
test('a reversed source span never satisfies the witness low gate',()=>{
 const l=appendReasoning([],{...origin,id:'bad',witnesses:['book#40-20']});
 assert.equal(reasoningAt(l).claims[0].standing,'unlicensed');
});
test('a naked named giver does not become verified empirical testimony',()=>{
 const l=push([],[{...origin,id:'axiom',witnesses:[],giver:'named norm'},assessDeduct('axiom')]);
 assert.notEqual(reasoningAt(l).claims[0].standing,'supported');
});
