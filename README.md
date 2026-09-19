# Vínculo

Wedding Planning OS privado para organizar o casamento com clareza financeira e operacional.

## Funcionalidades da primeira versão

- Dashboard com meta segura, valor guardado, contratado, pago e meta mensal.
- Orçamento por categoria e agenda de pagamentos.
- Cadastro e comparação inicial de fornecedores.
- Lista de convidados com grupos e RSVP.
- Checklist com prioridade, responsável, prazo e conclusão.
- Login por conta configurada no ambiente, isolamento por casamento e persistência em PostgreSQL.
- Layout responsivo, tema claro/escuro e ferramentas WebMCP para resumo e tarefas.

## Desenvolvimento

```bash
npm install
docker compose up -d --build
npm run db:generate
npm run db:migrate
npm run dev
```

O PostgreSQL local fica na porta `5437`. Copie `.env.example`, defina a conta, gere a senha com `npm run auth:hash` e salve a saída entre as aspas simples de `AUTH_PASSWORD_HASH` (elas preservam os caracteres `$` no Docker Compose). O primeiro acesso autenticado abre o onboarding do casamento; nenhum dado de exemplo é criado. `AUTH_PASSWORD` em texto puro continua aceito apenas para compatibilidade com instalações antigas e deve ser migrado.

Validação:

```bash
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

As migrations PostgreSQL ficam em `drizzle/postgres`. As migrations SQLite antigas continuam em `drizzle/` apenas como histórico e não são executadas pelo novo comando.

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
