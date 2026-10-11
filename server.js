const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const questions = [
 {q:'Which planet is known as the Red Planet?',a:['Venus','Mars','Jupiter','Mercury'],correct:1,cat:'Science'},
 {q:'What is the capital of Japan?',a:['Seoul','Beijing','Tokyo','Bangkok'],correct:2,cat:'Geography'},
 {q:'How many sides does a hexagon have?',a:['Five','Six','Seven','Eight'],correct:1,cat:'General Knowledge'},
 {q:'Which ocean is the largest?',a:['Atlantic','Indian','Arctic','Pacific'],correct:3,cat:'Geography'},
 {q:'Who painted the Mona Lisa?',a:['Van Gogh','Picasso','Leonardo da Vinci','Michelangelo'],correct:2,cat:'Arts'},
 {q:'Which gas do plants absorb from the atmosphere?',a:['Oxygen','Carbon dioxide','Nitrogen','Hydrogen'],correct:1,cat:'Science'},
 {q:'In football (soccer), how many players start on the field per team?',a:['9','10','11','12'],correct:2,cat:'Sports'},
 {q:'Which is the smallest prime number?',a:['0','1','2','3'],correct:2,cat:'Math'},
 {q:'What is the chemical symbol for gold?',a:['Ag','Gd','Au','Go'],correct:2,cat:'Science'},
 {q:'Which film franchise features the character Darth Vader?',a:['Star Trek','Star Wars','Dune','The Matrix'],correct:1,cat:'Entertainment'}
];
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase();}
function safeRoom(code){return rooms.get(String(code||'').toUpperCase());}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(obj));}
function publicRoom(r){return {code:r.code,hostId:r.hostId,phase:r.phase,category:r.category,round:r.round,totalRounds:r.totalRounds,players:r.players.map(p=>({id:p.id,name:p.name,score:p.score,ready:p.ready,connected:p.connected,role:p.role})),question:['question','results'].includes(r.phase)?{q:r.current.q,a:r.current.a,cat:r.current.cat,endsAt:r.endsAt,number:r.round+1}:null,results:r.phase==='results'?{correct:r.current.correct,answers:r.players.map(p=>({id:p.id,name:p.name,answer:p.lastAnswer,correct:p.lastCorrect,earned:p.lastEarned}))}:null,winner:r.winner||null,message:r.message||''};}
function broadcast(r){r.updated=Date.now();}
const server=http.createServer((req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET' && (url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(__dirname,'public/index.html')).pipe(res);}
 if(req.method==='GET' && url.pathname==='/api/room'){const r=safeRoom(url.searchParams.get('code'));return r?json(res,200,publicRoom(r)):json(res,404,{error:'Room not found'});}
 if(req.method!=='POST'){res.writeHead(404);return res.end('Not found');}
 let body='';req.on('data',c=>body+=c);req.on('end',()=>{let d;try{d=JSON.parse(body||'{}')}catch{return json(res,400,{error:'Invalid JSON'})}
 const action=url.pathname;
 if(action==='/api/create'){
  let c=code();while(rooms.has(c))c=code();const id=crypto.randomUUID();const name=String(d.name||'Host').trim().slice(0,18)||'Host';
  const r={code:c,hostId:id,phase:'lobby',category:d.category||'Mixed Quiz',round:0,totalRounds:5,players:[{id,name,score:0,ready:true,connected:true,role:['Speedster','Guardian','Trickster','Scholar'][Math.floor(Math.random()*4)]}],usedQuestions:[],current:null,endsAt:null,updated:Date.now(),winner:null};rooms.set(c,r);return json(res,200,{playerId:id,room:publicRoom(r)});
 }
 const r=safeRoom(d.code);if(!r)return json(res,404,{error:'Room not found. Check the room code.'});
 if(action==='/api/join'){
  const name=String(d.name||'Player').trim().slice(0,18)||'Player';if(r.phase!=='lobby')return json(res,409,{error:'This game has already started.'});if(r.players.length>=8)return json(res,409,{error:'Room is full (8 players maximum).'});
  const id=crypto.randomUUID();r.players.push({id,name,score:0,ready:true,connected:true,role:['Speedster','Guardian','Trickster','Scholar'][Math.floor(Math.random()*4)]});broadcast(r);return json(res,200,{playerId:id,room:publicRoom(r)});
 }
 const p=r.players.find(x=>x.id===d.playerId);if(!p)return json(res,403,{error:'Player session not found. Rejoin the room.'});
 if(action==='/api/ready'){p.ready=!!d.ready;broadcast(r);return json(res,200,{room:publicRoom(r)});}
 if(action==='/api/start'){
  if(d.playerId!==r.hostId)return json(res,403,{error:'Only the host can start the game.'});if(r.players.length<2)return json(res,400,{error:'At least 2 players are required.'});if(r.phase!=='lobby')return json(res,409,{error:'Game already started.'});
  r.phase='question';r.round=0;r.usedQuestions=[];r.message='Round 1 of 5';nextQuestion(r);broadcast(r);return json(res,200,{room:publicRoom(r)});
 }
 if(action==='/api/answer'){
  if(r.phase!=='question')return json(res,409,{error:'This question is closed.'});if(p.lastRound===r.round)return json(res,409,{error:'You already answered this question.'});
  const answer=Number(d.answer);if(!Number.isInteger(answer)||answer<0||answer>3)return json(res,400,{error:'Choose an answer.'});p.lastRound=r.round;p.lastAnswer=answer;p.lastCorrect=answer===r.current.correct;
  if(p.lastCorrect){const remaining=Math.max(0,r.endsAt-Date.now());let bonus=Math.round(500*Math.min(1,remaining/15000));if(p.sabotagedRound===r.round)bonus=Math.floor(bonus/2);p.lastEarned=1000+bonus;p.score+=p.lastEarned;}else p.lastEarned=0;
  if(r.players.every(x=>x.lastRound===r.round))finishQuestion(r);broadcast(r);return json(res,200,{room:publicRoom(r)});
 }
 if(action==='/api/power'){
  if(r.phase!=='question')return json(res,409,{error:'Power-ups can only be used during a question.'});const target=r.players.find(x=>x.id===d.targetId);if(!target||target.id===p.id)return json(res,400,{error:'Choose another player.'});p.powers=p.powers||{};if(p.powers[d.kind])return json(res,409,{error:'You have already used this power.'});
  if(d.kind==='sabotage'){p.powers.sabotage=true;target.sabotagedRound=r.round;return json(res,200,{room:publicRoom(r),message:`Sabotage armed against ${target.name} for this question.`});}
  if(d.kind==='steal'){if(p.lastSteal)return json(res,409,{error:'You already used your steal.'});p.lastSteal=true;const amount=Math.min(300,target.score);target.score-=amount;p.score+=amount;broadcast(r);return json(res,200,{room:publicRoom(r),message:`Stole ${amount} points from ${target.name}.`});}
  return json(res,400,{error:'Unknown power-up.'});
 }
 if(action==='/api/next'){
  if(d.playerId!==r.hostId)return json(res,403,{error:'Only the host can continue.'});if(r.phase!=='results')return json(res,409,{error:'Wait for the question to finish.'});
  if(r.round+1>=r.totalRounds){r.phase='finished';r.players.sort((a,b)=>b.score-a.score);r.winner=r.players[0]?.name||'';r.message='Quiz complete!';broadcast(r);return json(res,200,{room:publicRoom(r)});}
  r.round++;r.phase='question';nextQuestion(r);broadcast(r);return json(res,200,{room:publicRoom(r)});
 }
 if(action==='/api/rematch'){
  if(d.playerId!==r.hostId)return json(res,403,{error:'Only the host can start a rematch.'});r.phase='lobby';r.round=0;r.winner=null;r.message='Ready for a rematch';r.players.forEach(x=>{x.score=0;x.lastAnswer=null;x.lastCorrect=null;x.lastEarned=0;x.lastRound=-1;x.lastSteal=false;x.powers={};x.sabotagedRound=null;x.ready=true});broadcast(r);return json(res,200,{room:publicRoom(r)});
 }
 if(action==='/api/leave'){r.players=r.players.filter(x=>x.id!==p.id);if(!r.players.length)rooms.delete(r.code);else if(r.hostId===p.id)r.hostId=r.players[0].id;return json(res,200,{ok:true});}
 json(res,404,{error:'Unknown action'});
 });
});
function nextQuestion(r){let available=questions.map((q,i)=>i).filter(i=>!r.usedQuestions.includes(i));if(!available.length){r.usedQuestions=[];available=questions.map((q,i)=>i)}const idx=available[Math.floor(Math.random()*available.length)];r.usedQuestions.push(idx);r.current={...questions[idx]};r.endsAt=Date.now()+15000;r.players.forEach(p=>{p.lastAnswer=null;p.lastCorrect=null;p.lastEarned=0;p.lastRound=-1;});setTimeout(()=>{if(r.phase==='question'&&Date.now()>=r.endsAt){finishQuestion(r);broadcast(r)}},15100);}
function finishQuestion(r){if(r.phase!=='question')return;r.phase='results';r.message='Answers revealed';}
server.listen(PORT,'0.0.0.0',()=>console.log(`Quiz Clash running at http://localhost:${PORT}`));
