import {randomInt} from 'node:crypto';
const owner='5582996813027';
const categories={
 '📋 Principal':['menu','ajuda','dono','ping','status','infobot','regras'],
 '👑 Administração':['b','d','p','ban','kick','promover','rebaixar','grupo','abrirgp','fechargp','marcar','linkgp','add'],
 '🛡️ Segurança':['antilink','antispam','antivizu','antigaviao','detectargado','zoeira'],
 '🤣 Rankings':['rankcorno','rankmoia','rankcaloteiro','rankgaviao','rankgado','rankbebado','rankfofoqueiro','rankpreguicoso','rankdoido','rankciumento','rankpegador','ranksumido','rankchorao','ranksortudo','rankazarado'],
 '❤️ Relacionamentos':['ship','casal','compatibilidade','apaixonado','crush','casamento','divorcio','beijo','namorar','quemmeama','quemmetraiu'],
 '🎮 Jogos':['jogos','verdade','desafio','verdadeoudesafio','roleta','dado','parouimpar','pedra','papel','tesoura','adivinhar','quiz','forca','sorteio','bingo'],
 '😂 Zoeiras':['queme','eununca','confissao','segredo','azar','sorte','previsao','horoscopo','testedeamor','testedebeleza','testedeloucura','quemseria','duelo','batalha'],
 '🖼️ Figurinhas':['fig','sticker','toimg','attp','ttp'],
 '🎵 Músicas':['play','buscar','musica','letra'],
 '🧠 IA':['ia','perguntar','resumir','traduzir']
};
const sections=Object.entries(categories),known=new Set(sections.flatMap(([,v])=>v));
const admins=new Set(categories['👑 Administração']);
const flags=new Set(categories['🛡️ Segurança']);
const games=new Map();
const pick=a=>a[randomInt(a.length)];
const number=id=>String(id||'').split('@')[0].split(':')[0];
const unwrap=m=>m?.ephemeralMessage?.message||m?.viewOnceMessage?.message||m?.viewOnceMessageV2?.message||m||{};
export function menu(n){if(n>=1&&n<=sections.length){const [title,cmds]=sections[n-1];return `${title}\n${cmds.map(x=>'!'+x).join(' · ')}`};return '🤖 ZUMY BOT · Amigos e namoro\n'+sections.map(([title],i)=>`${i+1} · ${title}`).join('\n')+'\nPrefixo único: !\nExemplo: !menu 5'}
export async function handleGroup(sock,msg){
 const jid=msg.key?.remoteJid;
 if(!jid?.endsWith('@g.us')||msg.key.fromMe)return;
 const c=unwrap(msg.message);
 const text=String(c.conversation||c.extendedTextMessage?.text||c.imageMessage?.caption||c.videoMessage?.caption||'').trim();
 const match=/^!([^\s]+)(?:\s+([\s\S]*))?$/.exec(text);
 if(!match)return;
 const cmd=match[1].toLowerCase(),arg=(match[2]||'').trim();
 const reply=t=>sock.sendMessage(jid,{text:t},{quoted:msg});
 console.log('[ZUMY] comando',cmd,'grupo',jid);
 // Comandos básicos funcionam sem consultar os metadados do grupo.
 if(cmd==='ping')return reply('🏓 Pong! ZUMY online.');
 if(cmd==='menu')return reply(menu(Number(arg)));
 if(cmd==='ajuda')return reply('Envie !menu ou !menu 1 até !menu 10. Prefixo único: !');
 if(cmd==='status')return reply('✅ ZUMY conectada e comandos ativos.');
 if(cmd==='dono')return reply('Dono: https://wa.me/'+owner);
 if(cmd==='infobot')return reply('🤖 ZUMY BOT · Grupos, amizade e namoro · Prefixo !');
 if(!known.has(cmd))return;
 const meta=await sock.groupMetadata(jid);
 const members=meta.participants||[];
 const actor=number(msg.key.participantAlt||msg.key.participant);
 const sender=members.find(p=>number(p.id)===actor||number(p.phoneNumber)===actor||number(p.lid)===actor);
 const isOwner=actor===owner||number(msg.key.participant)===owner;
 const isAdmin=isOwner||!!sender?.admin;
 const target=(c.extendedTextMessage?.contextInfo?.mentionedJid||[])[0]||c.extendedTextMessage?.contextInfo?.participant;
 if(cmd==='regras')return reply(meta.desc||'Sem regras cadastradas na descrição do grupo.');
 if(admins.has(cmd)&&!isAdmin)return reply('Este comando é exclusivo dos administradores.');
 if(flags.has(cmd))return reply(`!${cmd}: configuração de segurança requer ativação no painel (em desenvolvimento).`);
 if(cmd==='grupo'||cmd==='abrirgp'||cmd==='fechargp'){
  const mode=cmd==='grupo'?arg.toLowerCase():cmd==='abrirgp'?'a':'f';
  if(!['a','f'].includes(mode))return reply('Use !grupo a ou !grupo f');
  await sock.groupSettingUpdate(jid,mode==='a'?'not_announcement':'announcement');return reply(mode==='a'?'Grupo aberto.':'Grupo fechado.');
 }
 if(cmd==='linkgp')return reply('https://chat.whatsapp.com/'+await sock.groupInviteCode(jid));
 if(cmd==='marcar')return sock.sendMessage(jid,{text:(arg||'Atenção, pessoal!')+'\n'+members.map(p=>'@'+number(p.id)).join(' '),mentions:members.map(p=>p.id)},{quoted:msg});
 if(['b','ban','kick','p','promover','rebaixar','add'].includes(cmd)){
  const id=cmd==='add'&&/^\+?\d{10,15}$/.test(arg)?arg.replace('+','')+'@s.whatsapp.net':target;
  if(!id)return reply('Marque ou responda à mensagem da pessoa. Para adicionar: !add 55DDDNUMERO');
  const op=['b','ban','kick'].includes(cmd)?'remove':['p','promover'].includes(cmd)?'promote':cmd==='rebaixar'?'demote':'add';
  await sock.groupParticipantsUpdate(jid,[id],op);return reply('Solicitação enviada ao WhatsApp.');
 }
 if(cmd==='d')return reply('Para apagar, responda à mensagem; esta função será habilitada após validação das permissões.');
 if(cmd.startsWith('rank')){
  const shuffled=[...members].sort(()=>Math.random()-.5).slice(0,5);
  return sock.sendMessage(jid,{text:'🎲 '+cmd+' (brincadeira)\n'+shuffled.map((p,i)=>`${i+1}. @${number(p.id)}`).join('\n'),mentions:shuffled.map(p=>p.id)},{quoted:msg});
 }
 if(['ship','casal','compatibilidade','apaixonado','crush','casamento','divorcio','beijo','namorar','quemmeama','quemmetraiu'].includes(cmd))return reply(`❤️ ${cmd}: ${randomInt(101)}% de compatibilidade (brincadeira).`);
 if(cmd==='jogos')return reply(menu(6));
 if(cmd==='dado')return reply('🎲 '+(randomInt(6)+1));
 if(['pedra','papel','tesoura'].includes(cmd))return reply('ZUMY escolheu '+pick(['pedra','papel','tesoura'])+'!');
 if(['verdade','desafio','verdadeoudesafio'].includes(cmd))return reply(pick(['Qual foi a sua maior vergonha engraçada?','Invente uma cantada com a palavra pipoca.','Qual música representa este grupo?']));
 if(['roleta','sorteio'].includes(cmd)){const p=pick(members);return sock.sendMessage(jid,{text:'🎉 Sorteado: @'+number(p.id),mentions:[p.id]},{quoted:msg})}
 if(cmd==='bingo'){const state=games.get(jid)||new Set();if(arg==='reset')state.clear();if(state.size>=75)return reply('Bingo concluído! Use !bingo reset.');let n;do{n=randomInt(75)+1}while(state.has(n));state.add(n);games.set(jid,state);return reply(`🎱 Bola ${n} (${state.size}/75)`)}
 if(['quiz','adivinhar','forca','parouimpar'].includes(cmd))return reply('🎮 '+cmd+': jogo em preparação nesta versão.');
 if(categories['😂 Zoeiras'].includes(cmd))return reply('😂 '+cmd+': '+pick(['Quem vai mandar o maior áudio hoje?','Hoje é dia de rir com a turma!','Quem organiza o próximo encontro?']));
 if(categories['🖼️ Figurinhas'].includes(cmd))return reply('🖼️ Figurinhas serão ativadas após o teste da conexão e das mensagens.');
 if(categories['🎵 Músicas'].includes(cmd))return reply(arg?'🎵 Pesquisar: https://www.youtube.com/results?search_query='+encodeURIComponent(arg):'Digite !play nome da música.');
 if(categories['🧠 IA'].includes(cmd))return reply('🧠 IA ainda não configurada.');
}
