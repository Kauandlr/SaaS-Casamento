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

O PostgreSQL local fica na porta `5437`. Copie `.env.example`, defina a conta e gere a senha com `npm run auth:hash`. O primeiro acesso autenticado abre o onboarding do casamento; nenhum dado de exemplo é criado.

Validação:

```bash
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

As migrations PostgreSQL ficam em `drizzle/postgres`. As migrations SQLite antigas continuam em `drizzle/` apenas como histórico e não são executadas pelo novo comando.
