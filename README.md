# Vínculo

Wedding Planning OS privado para organizar o casamento com clareza financeira e operacional.

## Funcionalidades da primeira versão

- Dashboard com meta segura, valor guardado, contratado, pago e meta mensal.
- Orçamento por categoria e agenda de pagamentos.
- Cadastro e comparação inicial de fornecedores.
- Lista de convidados com grupos e confirmação de presença.
- Lista de presentes integrada ao enxoval, com itens, links e registro do que foi recebido.
- Checklist com prioridade, responsável, prazo e conclusão.
- Cadastro e login com contas individuais, convite para o parceiro e planejamento compartilhado em PostgreSQL.
- Layout responsivo, tema claro/escuro e ferramentas WebMCP para resumo e tarefas.

## Desenvolvimento

```bash
npm install
docker compose up -d --build
npm run db:generate
npm run db:migrate
npm run dev
```

O PostgreSQL local fica na porta `5437`. Copie `.env.example` e configure `DATABASE_URL`. Abra `/cadastro` para criar a primeira conta. Após configurar o casamento, use **Acesso do casal**, informe o e-mail do parceiro e envie o convite. O Vínculo envia pelo Resend um link de uso único, válido por 7 dias e restrito ao e-mail informado. O parceiro entra ou cria sua própria conta com esse e-mail; os dois passam a acessar o mesmo planejamento. Um novo envio invalida o convite anterior. Nenhum dado de exemplo é criado.

Para os convites, configure `APP_URL` com a URL pública do app, `RESEND_API_KEY` com uma chave que tenha permissão de envio e `RESEND_FROM_EMAIL` com um remetente de domínio verificado no Resend. Em desenvolvimento, `APP_URL=http://localhost:3000` é aceito. Em produção, use HTTPS. A integração chama diretamente a API de e-mails do Resend; falhas de entrega não deixam convites ativos no banco.

As variáveis `AUTH_USER_ID`, `AUTH_EMAIL`, `AUTH_DISPLAY_NAME` e `AUTH_PASSWORD_HASH` são opcionais e mantêm o acesso de instalações antigas. Após o primeiro login legado, a senha é armazenada na tabela `users`. Para gerar um hash legado, use `npm run auth:hash`; mantenha as aspas simples em `.env` para preservar os caracteres `$` no Docker Compose.

Validação:

```bash
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

As migrations PostgreSQL ficam em `drizzle/postgres`. As migrations SQLite antigas continuam em `drizzle/` apenas como histórico e não são executadas pelo novo comando.

## Configuração segura

- Gere uma senha exclusiva para o PostgreSQL e preencha `POSTGRES_PASSWORD` e `DATABASE_URL` no `.env`. O Compose publica o banco apenas em `127.0.0.1` para ferramentas locais.
- Em um volume PostgreSQL já existente, `POSTGRES_PASSWORD` não altera a senha do usuário automaticamente; rotacione a senha no banco antes de atualizar `DATABASE_URL`.
- Configure `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` com um widget Cloudflare Turnstile. Login e cadastro em hosts públicos falham de forma segura quando essas chaves estão ausentes.
- Mantenha `DATABASE_URL`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `AUTH_PASSWORD_HASH` e `TURNSTILE_SECRET_KEY` somente em `.env`, `.dev.vars` ou no gerenciador de segredos do provedor.
- O chat Luna aceita até 20 requisições por conta a cada hora e 100 por dia. Login e cadastro usam limites persistentes no PostgreSQL.
- Aplique todas as migrations antes de iniciar uma nova versão. A migration `0009_security_rate_limits.sql` cria o armazenamento dos limites.

## Luna: erro TLS na implantação Docker

O chat da Luna roda no `workerd` iniciado pelo Wrangler dentro do container. Quando
`POST /api/ai/chat` retorna `503` e os logs mostram `TLS peer's certificate is
not trusted`, a conexão HTTPS falhou antes de a API da OpenAI responder. Não
desative a verificação TLS.

No servidor que gerou o erro, confira o endpoint configurado e o relógio do
container (se `OPENAI_BASE_URL` não estiver definido, o padrão é
`https://api.openai.com/v1`):

```sh
docker compose exec app printenv OPENAI_BASE_URL
docker compose exec app date -u
```

O primeiro comando pode imprimir uma linha vazia quando a variável estiver
ausente; isso indica o endpoint padrão. Para inspecionar a cadeia apresentada ao
container, inclusive emissores e intermediários, execute:

```sh
docker compose exec -T app sh -lc 'openssl s_client -connect api.openai.com:443 -servername api.openai.com -showcerts -verify_return_error </dev/null 2>&1 | grep -E "verify error|Certificate chain|^[[:space:]]*[0-9]+ s:|^[[:space:]]*i:|Verify return code"'
docker compose exec -T app sh -lc 'openssl s_client -connect api.openai.com:443 -servername api.openai.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates'
```

Se `OPENAI_BASE_URL` apontar para outro host, substitua `api.openai.com` nesses
comandos. Compare com uma requisição feita pelo Node no mesmo container. Um
`HTTP 401` sem chave de API é suficiente para confirmar que o TLS foi aceito
pelo Node. O comando usa o mesmo endpoint configurado para a Luna:

```sh
docker compose exec app node -e 'const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/?$/, "/"); fetch(new URL("models", base)).then(r => console.log("HTTP", r.status)).catch(e => { console.error(e.cause?.message ?? e.message); process.exitCode = 1 })'
docker compose logs --since=10m app
```

Se a cadeia mostrar uma CA de um proxy que inspeciona HTTPS, obtenha o PEM da
**CA raiz autorizada** com o administrador da rede. Salve o arquivo fora do
repositório, configure seu caminho absoluto no host e use o override opcional:

```sh
export OPENAI_CA_CERT_FILE=/absolute/path/to/proxy-root-ca.pem
docker compose -f docker-compose.yml -f docker-compose.tls.yml config -q
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build app
```

O override monta o PEM somente para leitura e passa `NODE_EXTRA_CA_CERTS` ao
Wrangler/Miniflare, que o disponibiliza ao `workerd`. Não use o certificado do
servidor como CA, nem inclua o PEM no Git. Se a cadeia estiver incompleta,
corrija o proxy ou endpoint que a fornece; se a data estiver errada, corrija o
relógio do host. Se a cadeia for válida e só o `workerd` falhar, reproduza o
erro com as versões instaladas de Wrangler/Miniflare antes de atualizá-las.

Após reiniciar, envie uma mensagem de teste no chat autenticado da Luna e
confirme uma resposta, sem novos erros TLS em `docker compose logs --since=5m
app`. Se a API então retornar erro de chave ou modelo, ajuste a configuração
indicada por essa resposta e repita o teste.
