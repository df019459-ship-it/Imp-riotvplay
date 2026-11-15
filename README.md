# ZUMY BOT 2.0
Bot WhatsApp para grupos, com prefixo **somente !**.

## Implantação no Render
1. Faça backup do repositório atual antes de substituir qualquer arquivo.
2. Publique os arquivos deste pacote no GitHub, na branch conectada ao Render.
3. Serviço Web Docker: Dockerfile na raiz, porta via `PORT`.
4. Configure `ADMIN_TOKEN` como variável secreta no Render. **Não publique o valor no GitHub.**
5. Para manter a sessão após reinícios, configure disco persistente montado em `/var/data` e `SESSION_DIR=/var/data/zumy-session`. Discos persistentes podem exigir plano pago. Sem disco, uma nova sessão poderá ser necessária após novo deploy.
6. Se houver uma sessão existente, faça backup e migre os arquivos de autenticação com segurança antes de trocar o código. **Este pacote não inclui a sessão existente.**
7. Deploy e verifique `GET /health`. A API de pareamento usa token: `Authorization: Bearer SEU_ADMIN_TOKEN` em `POST /admin/pair` com JSON `{"number":"5511960649533"}`. QR disponível em `GET /admin/qr` com a mesma autenticação.
8. Teste `!ping` num grupo usando outro número. Confira logs `[ZUMY] comando` e `Mensagem recebida`.

## Importante
- A API de administração está protegida por token e não há painel visual de login nesta versão.
- Alguns comandos aparecem no menu mas são explicitamente marcados como em preparação. Não anuncie essas funções como operacionais.
- O status `/health` reflete o estado de conexão observado pelo processo, não garante entrega de mensagens.
- Para ligar/desligar comandos: `POST /admin/pause` com `{"paused":true}` ou `false` e Bearer token.
- O projeto usa Baileys (integração não oficial); versões e mudanças no WhatsApp podem exigir manutenção.
