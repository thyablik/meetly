(() => {
  const $ = id => document.getElementById(id);
  const state = { peer:null, id:null, name:'Гость', stream:null, calls:new Map(), data:new Map(), mic:true, cam:true, screen:false, started:0, timer:null, unread:0, host:false, room:'' };
  const welcome=$('welcome'), meeting=$('meeting'), grid=$('videoGrid');
  function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300)}
  function setStatus(s){$('connectionStatus').textContent=s}
  function safeName(){return ($('displayName').value.trim()||'Гость').slice(0,24)}
  function roomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
  function showMeeting(code){welcome.classList.add('hidden');meeting.classList.remove('hidden');$('roomCode').textContent=code;$('roomTitle').textContent='Встреча '+code;$('localName').textContent=state.name;history.replaceState({},'',`?room=${code}`);state.started=Date.now();state.timer=setInterval(()=>{const s=Math.floor((Date.now()-state.started)/1000);$('callTimer').textContent=[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).slice(-2).join(':')},1000)}
  async function getMedia(){try{return await navigator.mediaDevices.getUserMedia({video:true,audio:true})}catch(e){toast('Нет доступа к камере/микрофону. Проверьте разрешения.');throw e}}
  function createPeer(id){return new Promise((resolve,reject)=>{const p=new Peer(id,{debug:1});p.on('open',resolve);p.on('error',e=>{setStatus('Ошибка соединения: '+e.type);reject(e)});state.peer=p;})}
  function addVideo(stream,name,id,muted=false){let card=document.getElementById('card-'+id);if(!card){card=document.createElement('article');card.className='video-card';card.id='card-'+id;const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=muted;const label=document.createElement('div');label.className='video-label';const n=document.createElement('span');n.textContent=name;label.append(n);card.append(v,label);grid.append(card);v.srcObject=stream;}else{const v=card.querySelector('video');v.srcObject=stream;}updateCount()}
  function removePeer(id){const c=$('card-'+id);if(c)c.remove();state.calls.delete(id);state.data.delete(id);updateCount()}
  function updateCount(){const n=grid.querySelectorAll('.video-card').length;$('participantCount').textContent=n+' '+(n===1?'участник':'участников')}
  function sendAll(payload){for(const c of state.data.values())if(c.open)c.send(payload)}
  function broadcastRoster(){sendAll({type:'roster',peers:[...state.data.keys()],name:state.name})}
  function setupData(conn){state.data.set(conn.peer,conn);conn.on('open',()=>{conn.send({type:'hello',name:state.name,peer:state.peer.id,host:state.host});if(state.host){conn.send({type:'roster',peers:[...state.data.keys()],name:state.name});broadcastRoster()} });conn.on('data',msg=>handleData(conn.peer,msg));conn.on('close',()=>{removePeer(conn.peer);if(state.host)broadcastRoster()})}
  function handleData(from,msg){if(!msg||!msg.type)return;
    if(msg.type==='hello'){if(state.host){broadcastRoster();const c=state.data.get(from);if(c?.open)c.send({type:'welcome',peers:[...state.data.keys()],name:state.name})}return}
    if(msg.type==='roster'||msg.type==='welcome'){(msg.peers||[]).forEach(id=>{if(id!==state.peer.id&&!state.calls.has(id))callPeer(id)});return}
    if(msg.type==='chat'){addMessage(msg.name,msg.text);return}
    if(msg.type==='reaction'){showReaction(msg.emoji,msg.name);return}
    if(msg.type==='leave'){removePeer(from)}
  }
  function callPeer(id){if(!id||id===state.peer.id||state.calls.has(id)||!state.stream)return;const call=state.peer.call(id,state.stream,{metadata:{name:state.name}});if(call)setupCall(call,id)}
  function setupCall(call,id){state.calls.set(id,call);call.on('stream',stream=>addVideo(stream,call.metadata?.name||'Участник',id));call.on('close',()=>removePeer(id));call.on('error',()=>removePeer(id))}
  async function start(host,code){state.name=safeName();state.room=code;state.host=host;try{state.stream=await getMedia();$('localVideo').srcObject=state.stream;showMeeting(code);setStatus('Получаем соединение…');if(host){const id='meetly-'+code.toLowerCase();await createPeer(id);state.id=id;setStatus('Комната готова. Отправьте ссылку друзьям.');}else{await createPeer();state.id=state.peer.id;const conn=state.peer.connect('meetly-'+code.toLowerCase(),{reliable:true});setupData(conn);state.peer.on('call',call=>{call.answer(state.stream);setupCall(call,call.peer)});setStatus('Подключаемся к комнате…');}state.peer.on('call',call=>{call.answer(state.stream);setupCall(call,call.peer)});state.peer.on('connection',conn=>{if(state.host)setupData(conn)});if(host)state.peer.on('connection',conn=>setupData(conn));}catch(e){console.error(e);if(state.stream)state.stream.getTracks().forEach(t=>t.stop());}}
  $('createBtn').onclick=()=>start(true,roomCode());
  $('joinBtn').onclick=()=>{const code=$('roomInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<4){toast('Введите корректный код комнаты');return}start(false,code)};
  $('copyBtn').onclick=$('copyCodeBtn').onclick=()=>{const url=location.origin+location.pathname+'?room='+state.room;navigator.clipboard?.writeText(url).then(()=>toast('Ссылка скопирована!')).catch(()=>toast('Код комнаты: '+state.room))};
  $('micBtn').onclick=()=>{state.mic=!state.mic;state.stream.getAudioTracks().forEach(t=>t.enabled=state.mic);$('micBtn').classList.toggle('off',!state.mic);$('micBtn').querySelector('span').textContent=state.mic?'Микрофон':'Выключен'};
  $('camBtn').onclick=()=>{state.cam=!state.cam;state.stream.getVideoTracks().forEach(t=>t.enabled=state.cam);$('camBtn').classList.toggle('off',!state.cam);$('camBtn').querySelector('span').textContent=state.cam?'Камера':'Выключена'};
  $('screenBtn').onclick=async()=>{try{if(!state.screen){const screen=await navigator.mediaDevices.getDisplayMedia({video:true});const track=screen.getVideoTracks()[0];state.calls.forEach(call=>{const sender=call.peerConnection.getSenders().find(s=>s.track?.kind==='video');if(sender)sender.replaceTrack(track)});$('localVideo').srcObject=new MediaStream([track,...state.stream.getAudioTracks()]);track.onended=()=>stopScreen();state.screen=true;$('screenBtn').classList.add('off');}else stopScreen()}catch(e){toast('Не удалось включить демонстрацию экрана')}};
  function stopScreen(){state.screen=false;const track=state.stream.getVideoTracks()[0];state.calls.forEach(call=>{const sender=call.peerConnection.getSenders().find(s=>s.track?.kind==='video');if(sender)sender.replaceTrack(track)});$('localVideo').srcObject=state.stream;$('screenBtn').classList.remove('off')}
  $('chatBtn').onclick=()=>$('chatPanel').classList.toggle('hidden');$('closeChat').onclick=()=>$('chatPanel').classList.add('hidden');
  function addMessage(name,text){const empty=$('.empty-chat');if(empty)empty.remove();const row=document.createElement('div');row.className='message';const b=document.createElement('b');b.textContent=name;const p=document.createElement('p');p.textContent=text;row.append(b,p);$('messages').append(row);$('messages').scrollTop=$('messages').scrollHeight;if($('chatPanel').classList.contains('hidden')){state.unread++;$('chatBadge').textContent=state.unread;$('chatBadge').classList.remove('hidden')}}
  $('chatForm').onsubmit=e=>{e.preventDefault();const text=$('chatInput').value.trim();if(!text)return;const msg={type:'chat',name:state.name,text};addMessage(state.name,text);sendAll(msg);$('chatInput').value=''};
  $('chatBtn').addEventListener('click',()=>{state.unread=0;$('chatBadge').classList.add('hidden')});
  $('reactBtn').onclick=()=>$('reactionPicker').classList.toggle('hidden');
  document.querySelectorAll('.reaction-picker button').forEach(b=>b.onclick=()=>{sendAll({type:'reaction',emoji:b.textContent,name:state.name});showReaction(b.textContent,state.name);$('reactionPicker').classList.add('hidden')});
  function showReaction(emoji,name){const el=document.createElement('div');el.textContent=emoji;el.style.cssText='position:fixed;left:50%;top:35%;font-size:70px;z-index:9;transform:translateX(-50%);filter:drop-shadow(0 5px 15px #0008);animation:pop .9s ease forwards';document.body.append(el);setTimeout(()=>el.remove(),950);toast(name+' отправил(а) реакцию')}
  $('leaveBtn').onclick=()=>{sendAll({type:'leave'});state.calls.forEach(c=>c.close());state.data.forEach(c=>c.close());if(state.peer)state.peer.destroy();if(state.stream)state.stream.getTracks().forEach(t=>t.stop());clearInterval(state.timer);location.href=location.pathname};
  $('themeBtn').onclick=()=>document.body.classList.toggle('light');
  const params=new URLSearchParams(location.search);const invite=params.get('room');if(invite){$('roomInput').value=invite;setTimeout(()=>toast('Введите имя и нажмите «Войти»'),400)}
  if(!navigator.mediaDevices?.getUserMedia){$('homeStatus').textContent='Для видеозвонков откройте сайт через localhost или HTTPS.'}
})();