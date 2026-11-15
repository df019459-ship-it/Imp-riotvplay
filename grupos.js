import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomInt} from 'node:crypto';
import {downloadMediaMessage, jidNormalizedUser} from '@whiskeysockets/baileys';
import sharp from 'sharp';

export const secoes={
 '📋 Principal':'menu ajuda dono ping status infobot regras',
 '👑 Administração':'b d p ban kick promover rebaixar grupo abrirgp fechargp marcar linkgp add',
 '🛡️ Segurança':'antilink antispam antivizu antigaviao detectargado zoeira',
 '🤣 Rankings':'rankcorno rankmoia rankcaloteiro rankgaviao rankgado rankbebado rankfofoqueiro rankpreguicoso rankdoido rankciumento rankpegador ranksumido rankchorao ranksortudo rankazarado',
 '❤️ Relacionamentos':'ship casal compatibilidade apaixonado crush casamento divorcio beijo namorar quemmeama quemmetraiu',
 '🎮 Jogos':'jogos verdade desafio verdadeoudesafio roleta dado parouimpar pedra papel tesoura adivinhar quiz forca sorteio bingo',
 '😂 Zoeiras':'queme eununca confissao segredo azar sorte previsao horoscopo testedeamor testedebeleza testedeloucura quemseria duelo batalha',
 '🖼️ Figurinhas':'fig sticker toimg attp ttp',
 '🎵 Músicas':'play buscar musica letra',
 '🧠 Inteligência artificial':'ia perguntar resumir traduzir',
 '⚙️ Proprietário':'reiniciar bloquear desbloquear broadcast grupos'
};
const sections=Object.entries(secoes);
const directory=new Map(sections.flatMap(([title,words],i)=>words.split(' ').map(word=>[word,i])));
const flags=secoes['🛡️ Segurança'].split(' ');
const pick=arr=>arr[randomInt(arr.length)];
const norm=id=>id?jidNormalizedUser(id):'';
const owner='5582996813027@s.whatsapp.net';
const ownerCmd=new Set(secoes['⚙️ Proprietário'].split(' '));
const adminCmd=new Set(sections[1][1].split(' '));
const usage={grupo:'!grupo a ou !grupo f',broadcast:'!broadcast texto',add:'!add 55DDDNUMERO',menu:'!menu 1 até !menu 11',adivinhar:'!adivinhar ou !adivinhar 5',quiz:'!quiz ou !quiz resposta',forca:'!forca ou !forca letra',bingo:'!bingo sorteia uma bola; !bingo reset inicia outra rodada'};
export function menu(n){
 if(n && sections[n-1]){const [title,words]=sections[n-1];return title+'\n'+words.split(' ').map(c=>'!'+c).join(' · ')+(title.includes('Segurança')?'\nUse on, off ou status.':'')}
 return '🤖 ZUMY BOT · Amigos e namoro\n'+sections.map(([title],i)=>(i+1)+' · '+title).join('\n')+'\nEnvie !menu 5 para relacionamentos ou !menu 6 para jogos. Use !ajuda comando para consultar.';
}
const truth=['Que música lembra alguém especial?','Qual foi a mensagem mais engraçada que você enviou por engano?','Que gesto faz você se sentir querido?'];
const dare=['Descreva seu filme favorito usando três emojis.','Invente uma cantada que inclua a palavra pipoca.','Escolha uma música para ser o hino do grupo.'];
const jokes={queme:'Quem seria o DJ da festa?',eununca:'Eu nunca ensaiei uma mensagem antes de enviar. E você?',confissao:'Confissão da rodada: qual música você adora em segredo?',segredo:'Desafio: conte um talento escondido seu.',azar:'Azar da rodada: ficar com a última fatia sem recheio.',sorte:'Sua sorte de hoje: escolher a próxima música.',previsao:'Previsão de brincadeira: alguém vai mandar um áudio enorme hoje.',horoscopo:'Horóscopo de brincadeira: os astros recomendam chamar a turma para conversar.',quemseria:'Quem seria a primeira pessoa a organizar uma viagem?'};
const questions=[['Qual planeta é conhecido como planeta vermelho?','marte'],['Quantos lados tem um hexágono?','6'],['Qual é a capital de Pernambuco?','recife']];
const strip=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function games(cmd,arg,state){
 if(cmd==='jogos')return menu(6);
 if(['verdade','desafio','verdadeoudesafio'].includes(cmd))return pick(cmd==='verdade'?truth:cmd==='desafio'?dare:[...truth,...dare]);
 if(cmd==='dado')return '🎲 '+(1+randomInt(6));
 if(cmd==='parouimpar'){if(!['par','impar'].includes(strip(arg)))return 'Escolha !parouimpar par ou !parouimpar ímpar.';const n=randomInt(11);return 'Saiu '+n+'. '+((n%2===0)===(strip(arg)==='par')?'Você ganhou!':'A ZUMY ganhou!')}
 const moves=['pedra','papel','tesoura'];
 if(moves.includes(cmd)){const m=randomInt(3),delta=(moves.indexOf(cmd)-m+3)%3;return 'ZUMY: '+moves[m]+'. '+['Empate!','Você ganhou!','ZUMY ganhou!'][delta]}
 if(cmd==='quiz'||cmd==='adivinhar'){
   if(state[cmd]==null)state[cmd]=cmd==='quiz'?pick(questions):['Adivinhe um número entre 1 e 10.',String(1+randomInt(10))];
   const [prompt,answer]=state[cmd];if(!arg)return prompt+' Responda com !'+cmd+' e seu palpite.';
   if(strip(arg)===answer){delete state[cmd];return '🎉 Acertou!'}return 'Ainda não! '+prompt;
 }
 if(cmd==='forca'){
   const g=state.forca??={word:pick(['pipoca','namoro','estrela','amizade']),letters:[]};
   if(arg && !/^[a-z]$/i.test(arg))return 'Envie uma letra: !forca a';
   if(arg && !g.letters.includes(arg.toLowerCase()))g.letters.push(arg.toLowerCase());
   const masked=[...g.word].map(c=>g.letters.includes(c)?c:'_'),errors=g.letters.filter(c=>!g.word.includes(c)).length;
   if(!masked.includes('_')||errors>=6){delete state.forca;return (errors>=6?'Fim da rodada.':'Vocês acertaram!')+' Palavra: '+g.word}
   return masked.join(' ')+' · Erros '+errors+'/6. Jogue com !forca letra.';
 }
 if(cmd==='bingo'){
   if(arg==='reset')delete state.bingo;
   const balls=state.bingo??=[];const pool=Array.from({length:75},(_,i)=>i+1).filter(n=>!balls.includes(n));
   if(!pool.length)return 'Rodada concluída. Envie !bingo reset.';
   const n=pick(pool);balls.push(n);return '🎱 Bola '+n+' ('+balls.length+'/75)';
 }
}
export function createGroups(folder){
 mkdirSync(folder,{recursive:true});
 const file=join(folder,'grupos.json'),settings=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
 function save(){writeFileSync(file+'.tmp',JSON.stringify(settings),{mode:0o600});renameSync(file+'.tmp',file)}
 const gamesByChat=new Map(), recent=new Map(),proposals=new Map();
 return async function handle(sock,msg){
   const jid=msg.key?.remoteJid;if(!jid?.endsWith('@g.us')||msg.key.fromMe||!msg.message)return;
   const actor=norm(msg.key.participant);if(!actor)return;
   const cfg=settings[jid]??={zoeira:true};
   const c=msg.message.ephemeralMessage?.message||msg.message;
   const text=(c.conversation||c.extendedTextMessage?.text||c.imageMessage?.caption||c.videoMessage?.caption||'').trim();
   const match=/^[!/]([^\s]+)(?:\s+([\s\S]*))?$/.exec(text);
   const cmd=match?strip(match[1]):'',arg=match?.[2]?.trim()||'';
   const reply=(text,mentions=[])=>sock.sendMessage(jid,{text,mentions},{quoted:msg});
   const viewed=Boolean(c.viewOnceMessage||c.viewOnceMessageV2||c.viewOnceMessageV2Extension||c.imageMessage?.viewOnce||c.videoMessage?.viewOnce||c.audioMessage?.viewOnce);
   let flood=false;
   if(cfg.antispam){
     const now=Date.now(),key=jid+':'+actor;
     for(const [k,v] of recent)if(now-v.at(-1)>8000)recent.delete(k);
     const times=(recent.get(key)||[]).filter(t=>now-t<8000);times.push(now);recent.set(key,times.slice(-7));flood=times.length>=7;
   }
   const link=cfg.antilink && /https?:\/\/|chat\.whatsapp\.com\//i.test(text);
   if(!match&&!link&&!flood&&!(cfg.antivizu&&viewed)){
     if(cfg.zoeira&&cfg.antigaviao&&/\b(me passa seu zap|oi gat[ao])\b/i.test(text))return reply('Outro Zé Gavião por aqui? 😄');
     if(cfg.zoeira&&cfg.detectargado&&/\b(sou seu fã|faço tudo por voc[eê])\b/i.test(text))return reply('🐮 Alerta de cantada na brincadeira!');
     return;
   }
   let metadata;
   const meta=async()=>metadata??=await sock.groupMetadata(jid);
   const ids=p=>[p.id,p.phoneNumber,p.lid].filter(Boolean).map(norm);
   const entry=async id=>(await meta()).participants.find(p=>ids(p).includes(norm(id)));
   const sender=await entry(actor);
   const isOwner=actor===owner||norm(msg.key.participantAlt)===owner||Boolean(sender&&ids(sender).includes(owner));
   const admin=Boolean(isOwner||sender?.admin);
   if((link||flood||cfg.antivizu&&viewed)&&!admin){await sock.sendMessage(jid,{delete:msg.key});return}
   if(!match)return;
   const ctx=c.extendedTextMessage?.contextInfo||c.imageMessage?.contextInfo||{};
   const target=norm(ctx.mentionedJid?.[0]||ctx.participant);
   const members=(await meta()).participants.map(p=>p.id).filter(Boolean);
   const tag=id=>'@'+id.split('@')[0].split(':')[0];
   const memberList=(list)=>list.map(tag).join(' + ');
   const guest=()=>pick(members);
   const section=directory.get(cmd);
   if(ownerCmd.has(cmd)&&!isOwner)return reply('Comando exclusivo do dono da ZUMY.');
   if((adminCmd.has(cmd)||flags.includes(cmd)&&['on','off','1','0'].includes(arg.toLowerCase()))&&!admin)return reply('Comando exclusivo da administração do grupo.');
   if(flags.includes(cmd)){
     const opt=arg.toLowerCase();if(['on','off','1','0'].includes(opt)){cfg[cmd]=['1','on'].includes(opt);save()}
     return reply('!'+cmd+' · '+(cfg[cmd]?'ligado':'desligado')+'. Opções: on, off, status.');
   }
   if(cmd==='menu')return reply(menu(Number(arg)));
   if(cmd==='ajuda')return reply(usage[strip(arg).replace(/^[!/]/,'')]||'Use !menu e o número da seção. Moderação: responda à mensagem ou marque a pessoa. Namoro: !namorar @pessoa. Rankings e previsões são brincadeiras.');
   if(cmd==='ping')return reply('🏓 Pong! ZUMY online.');
   if(cmd==='dono')return reply('Dono da ZUMY: https://wa.me/5582996813027');
   if(cmd==='infobot')return reply('🤖 ZUMY BOT · Amigos e namoro\nWhatsApp: +55 11 96064-9533\nPrefixos: ! e /');
   if(cmd==='status')return reply(flags.map(f=>'!'+f+' · '+(cfg[f]?'on':'off')).join('\n'));
   if(cmd==='regras')return reply((await meta()).desc||'Este grupo ainda não cadastrou regras na descrição.');
   if(cmd==='grupos'||cmd==='broadcast'){
     const groups=Object.values(await sock.groupFetchAllParticipating());
     if(cmd==='grupos')return sock.sendMessage(actor,{text:groups.map(g=>g.subject).join('\n')||'Nenhum grupo.'});
     if(!arg)return reply(usage.broadcast);
     const key='broadcast:'+actor, draft=proposals.get(key);
     if(arg!=='confirmar'){proposals.set(key,{text:arg,ids:groups.map(g=>g.id),until:Date.now()+60000});return reply('Aviso para '+groups.length+' grupos. Envie !broadcast confirmar em 60 segundos.')}
     if(!draft||Date.now()>draft.until)return reply('Prepare o texto novamente.');
     proposals.delete(key);let count=0;for(const id of draft.ids){try{await sock.sendMessage(id,{text:draft.text});count++}catch{}}
     return reply('Entregue a '+count+' de '+draft.ids.length+' grupos.');
   }
   if(cmd==='reiniciar'){await reply('Reiniciando a conexão da ZUMY.');sock.end(new Error('Reinício solicitado pelo dono'));return}
   if(cmd==='bloquear'||cmd==='desbloquear'){if(!target||target===actor)return reply('Marque outro participante.');await sock.updateBlockStatus(target,cmd==='bloquear'?'block':'unblock');return reply('Lista de bloqueio da conta atualizada.')}
   if(cmd==='grupo'||cmd==='abrirgp'||cmd==='fechargp'){
     const mode=cmd==='grupo'?arg.toLowerCase():cmd==='abrirgp'?'a':'f';if(!['a','f'].includes(mode))return reply(usage.grupo);
     await sock.groupSettingUpdate(jid,mode==='a'?'not_announcement':'announcement');return reply(mode==='a'?'Grupo aberto.':'Grupo fechado.');
   }
   if(cmd==='linkgp')return reply('https://chat.whatsapp.com/'+await sock.groupInviteCode(jid));
   if(cmd==='marcar')return reply((arg||'Chamada do grupo')+'\n'+members.map(tag).join(' '),members);
   if(cmd==='d'){if(!ctx.stanzaId||!ctx.participant)return reply('Responda à mensagem com !d.');return sock.sendMessage(jid,{delete:{remoteJid:jid,id:ctx.stanzaId,participant:ctx.participant,fromMe:norm(ctx.participant)===norm(sock.user.id)}})}
   if(adminCmd.has(cmd)){
     const operation={b:'remove',ban:'remove',kick:'remove',p:'promote',promover:'promote',rebaixar:'demote',add:'add'}[cmd];
     const id=cmd==='add'&&/^\+?\d{8,15}$/.test(arg)?arg.replace('+','')+'@s.whatsapp.net':target;
     if(!id)return reply(cmd==='add'?usage.add:'Marque alguém ou responda à mensagem da pessoa.');
     const result=await sock.groupParticipantsUpdate(jid,[id],operation);
     return reply(String(result?.[0]?.status)==='200'?'Alteração concluída.':'O WhatsApp não confirmou a alteração. Confira permissões e privacidade.');
   }
   if((section>=3&&section<=6)&&!cfg.zoeira)return reply('As brincadeiras estão desligadas neste grupo.');
   if(section===3){
     const pool=[...members],chosen=[];while(chosen.length<5&&pool.length)chosen.push(pool.splice(randomInt(pool.length),1)[0]);
     return reply('🎲 Ranking por sorteio · '+cmd.slice(4)+'\n'+chosen.map((id,i)=>(i+1)+'. '+tag(id)).join('\n'),chosen);
   }
   if(['namorar','casamento','aceitar','recusar','divorcio'].includes(cmd)){
     const pairs=cfg.pares??={};const key=jid+':'+actor;
     if(cmd==='divorcio'){const other=pairs[actor];if(!other)return reply('Você não tem par registrado.');delete pairs[actor];delete pairs[other];save();return reply('Par desfeito.')}
     if(cmd==='aceitar'||cmd==='recusar'){const proposal=proposals.get(key);proposals.delete(key);if(!proposal||proposal.until<Date.now())return reply('Nenhum convite válido.');
       if(cmd==='recusar')return reply('Convite recusado.');if(pairs[actor]||pairs[proposal.from])return reply('Uma das pessoas já tem par registrado.');
       pairs[actor]=proposal.from;pairs[proposal.from]=actor;save();return reply('❤️ Par confirmado pelos dois! '+memberList([actor,proposal.from]),[actor,proposal.from]);}
     if(!target||target===actor||!await entry(target))return reply('Marque outra pessoa deste grupo.');
     if(pairs[actor]||pairs[target])return reply('Uma das pessoas já tem par registrado.');
     proposals.set(jid+':'+target,{from:actor,until:Date.now()+600000});return reply(tag(target)+', convite de '+tag(actor)+' para '+cmd+' na brincadeira. Responda !aceitar ou !recusar em 10 minutos.',[actor,target]);
   }
   if(section===4||['duelo','batalha','queme','quemseria'].includes(cmd)){
     const a=actor,b=target||pick(members.filter(id=>norm(id)!==actor).concat(members.length===1?[a]:[]));
     const captions={ship:'💘 Ship da rodada',casal:'❤️ Casal da rodada',compatibilidade:'💞 Compatibilidade sorteada: '+randomInt(101)+'%',apaixonado:'💌 Paixão da rodada',crush:'💘 Crush da rodada',beijo:'😘 Beijo virtual',quemmeama:'💖 Quem te ama na brincadeira',quemmetraiu:'🎭 Novela fictícia da rodada',duelo:'⚔️ Duelo · vencedor por sorteio: '+tag(pick([a,b])),batalha:'🏆 Batalha · vencedor por sorteio: '+tag(pick([a,b])),queme:jokes.queme,quemseria:jokes.quemseria};
     return reply(captions[cmd]+'\n'+memberList([a,b]),[a,b]);
   }
   if(['roleta','sorteio'].includes(cmd)){const id=guest();return reply('🎉 Sorteado: '+tag(id),[id])}
   if(section===5){let state=gamesByChat.get(jid);if(!state){state={};gamesByChat.set(jid,state)}return reply(games(cmd,arg,state))}
   if(section===6)return reply(jokes[cmd]||'🎲 '+cmd.replace(/^teste(de)?/,'Teste de ')+': '+randomInt(101)+'% (sorteado)');
   if(section===7){
     let img;
     if(cmd==='ttp'||cmd==='attp'){
       if(!arg)return reply('Digite um texto depois do comando.');const lines=arg.slice(0,90).match(/.{1,15}/gu)||['ZUMY'];
       const colors=cmd==='attp'?['#f677ae','#46b9fa','#57d799']:['#fff'];
       const frames=await Promise.all(colors.map(color=>sharp(Buffer.from('<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="40" fill="#101b34"/>'+lines.map((l,i)=>'<text x="256" y="'+(255+(i-(lines.length-1)/2)*48)+'" fill="'+color+'" font-family="sans-serif" text-anchor="middle" font-size="44">'+l.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</text>').join('')+'</svg>')).png().toBuffer()));
       img=frames.length===1?sharp(frames[0]):sharp(frames,{join:{animated:true}});
       return sock.sendMessage(jid,{sticker:await img.webp({delay:350,loop:0}).toBuffer()},{quoted:msg});
     }
     const source=ctx.quotedMessage||c;
     if(cmd==='toimg'?!source.stickerMessage:!source.imageMessage)return reply(cmd==='toimg'?'Responda a uma figurinha com !toimg.':'Envie uma foto com !fig ou responda a ela.');
     const media=await downloadMediaMessage({key:msg.key,message:source},'buffer',{});
     img=sharp(media,{limitInputPixels:25000000});
     return sock.sendMessage(jid,cmd==='toimg'?{image:await img.png().toBuffer()}:{sticker:await img.resize(512,512,{fit:'contain',background:'#00000000'}).webp().toBuffer()},{quoted:msg});
   }
   if(section===8){
     if(!arg)return reply('Informe o nome da música ou artista.');
     const url=cmd==='letra'?'https://www.letras.mus.br/?q=':'https://www.youtube.com/results?search_query=';
     return reply((cmd==='letra'?'📖 Buscar letra: ':'🎵 Ouvir ou pesquisar: ')+url+encodeURIComponent(arg));
   }
   if(['ia','perguntar','resumir','traduzir'].includes(cmd)){
     const quoted=ctx.quotedMessage;const input=[arg,quoted?.conversation||quoted?.extendedTextMessage?.text].filter(Boolean).join('\n');
     if(!input)return reply(cmd==='traduzir'?'Exemplo: !traduzir para inglês: bom dia':'Envie um texto ou responda a uma mensagem.');
     if(!process.env.OPENAI_API_KEY)return reply('A IA precisa ser configurada pelo dono no servidor.');
     const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(25000),headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages:[{role:'system',content:cmd==='resumir'?'Resuma o texto em português.':cmd==='traduzir'?'Traduza para o idioma solicitado.':'Responda brevemente em português.'},{role:'user',content:input.slice(0,8000)}]})});
     if(!response.ok)return reply('A IA está indisponível. Confira o serviço e a chave.');
     return reply((await response.json()).choices[0].message.content.slice(0,4000));
   }
 };
}
