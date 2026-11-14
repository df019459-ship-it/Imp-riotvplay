import {readFileSync} from 'node:fs';
const load = name => JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const {categories}=load('./catalog.json');
const codes=load('./codes.json');
const menu='🛍️ T.K PLAY STORE\nEnvie uma opção:\nCATÁLOGO — comprar serviços\nRENOVAR — renovar TV\nHORÁRIO — ver atendimento\nSUPORTE — falar com a loja';
export function respostas(raw,attachment=false){
  const command=raw.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^\//,'');
  if(attachment)return [{text:'Arquivo recebido. Se for um comprovante, aguarde a conferência pela loja.'}];
  if(['oi','ola','menu','inicio','start'].includes(command))return [{text:menu}];
  if(['loja','catalogo'].includes(command))return [{text:'Escolha a categoria pelo número:\n'+categories.map(([name],i)=>(i+1)+' · '+name).join('\n')+'\nAdicionais Claro TV: envie SUPORTE.'}];
  if(command==='horario')return [{text:'Segunda a sexta: 8h30 às 20h30\nSábado: 8h30 às 18h30\nDomingo: fechado.'}];
  if(command==='suporte')return [{text:'Deixe sua dúvida nesta conversa para a equipe da T.K PLAY STORE.'}];
  const group=['tv','renovar'].includes(command)?1:/^\d+$/.test(command)?Number(command):0;
  if(group>0 && categories[group-1]){
    const [title,items]=categories[group-1];
    return [{text:title+'\nEnvie o código para receber o Pix:\n'+items.map(([name,price],i)=>(command==='renovar'?'R':'')+group+'-'+(i+1)+' · '+name+' · R$ '+price).join('\n')}];
  }
  const match=/^(r?)(\d+-\d+)$/.exec(command);
  if(match && codes[match[2]] && (!match[1] || match[2].startsWith('1-'))){
    const id=match[2],item=codes[id];
    return [{image:readFileSync(new URL('./pix/'+id+'.png',import.meta.url)),caption:(match[1]?'Renovação · ':'')+item.name+' · R$ '+item.price+'\nEscaneie o QR ou use o Pix Copia e Cola da próxima mensagem. Envie o comprovante aqui.'},{text:item.pix}];
  }
  return [];
}
