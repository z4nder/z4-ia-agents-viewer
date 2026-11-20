# z4-ia-agents-viwer

Visualizador local de sessões de agentes (Claude Code e Codex): a árvore líder → subagentes, com tokens, chamadas ao modelo, ferramentas e duração de cada um.

Ferramenta local para explorar sessões de agentes sem enviar os dados para serviços externos.

## Rodar

```bash
bun install
bun run api      # API só leitura em 127.0.0.1:5175
bun run dev      # front em http://localhost:5173 (proxy de /api para a API)
```

No front, cole o caminho de um `.jsonl` de sessão, por exemplo
`~/.claude/projects/<projeto>/<sessionId>.jsonl` ou `~/.codex-empresa/sessions/AAAA/MM/DD/rollout-*.jsonl`.

## CLI e testes

```bash
bun run session ARQUIVO.jsonl          # árvore no terminal
bun run session ARQUIVO.jsonl --json   # modelo normalizado
bun run test                           # adaptadores contra as sessões gravadas
bun run typecheck
```

Os testes de integração usam gravações opcionais em `~/.local/share/agent-viewer/recordings` (`SESSIONS_DIR` muda a pasta). Use somente dados fictícios nos exemplos. Sem os arquivos esperados, esses testes são pulados.

## Estrutura

| Onde | O quê |
|---|---|
| `server/model.ts` | Modelo comum (`Session`, `Tokens`, `SessionEvent`), só tipos e funções puras, usado também pelo front |
| `server/adapters/codex.ts` | JSONL do Codex → modelo; filhos por `parent_thread_id` |
| `server/adapters/claude.ts` | JSONL do Claude → modelo; subagentes em `<sessionId>/subagents/`, tokens juntados por `message.id` |
| `server/index.ts` | API local só leitura; só abre `.jsonl` dentro das pastas das ferramentas |
| `src/features/session-tree/` | Árvore em react-konva, painel de detalhes e store zustand |

O conteúdo das sessões é dado, não instrução: a página mostra texto e nunca executa nada.
