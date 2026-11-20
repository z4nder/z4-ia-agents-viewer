# z4-ia-agents-viwer

Visualizador local de sessões de agentes (Claude Code e Codex): a árvore líder → subagentes, com tokens, chamadas ao modelo, ferramentas e duração de cada um.

Ferramenta local para explorar sessões de agentes sem enviar os dados para serviços externos.

## Rodar

```bash
bun install
bun run api      # API só leitura em 127.0.0.1:5175
bun run dev      # front em http://localhost:5173 (proxy de /api para a API)
```

A lista da esquerda acha sozinha as sessões em `~/.claude/projects`, `~/.codex/sessions`, `~/.codex-empresa/sessions` e nas gravadas, com filtro por ferramenta, projeto e data. Clique numa para abrir:

- **Árvore:** líder → subagentes, com tokens, chamadas e duração em cada nó.
- **Linha do tempo:** uma faixa por agente. Âmbar são as esperas (`wait_agent`, `wait`, `write_stdin` vazio, `sleep`), juntas num bloco com o custo em chamadas e tokens; a barra de baixo marca os processos longos (azul passou, vermelho falhou, cinza inconclusivo); traços escuros são as ferramentas e os pontos são as chamadas ao modelo. Roda do mouse dá zoom, arrastar move, duplo clique volta ao todo.

- **Fluxo:** diagrama de sequência, uma coluna por agente. Os blocos descem em ordem de tempo e as setas mostram cada delegação (verde), mensagem (azul) e a volta quando o subagente termina (verde tracejada). Duplo clique num bloco abre a atividade do agente.
- **Atividade:** o que o agente selecionado fez, em ordem: o pedido, as respostas, cada comando com a saída (clique para abrir), delegações, mensagens entre agentes e esperas. No topo, o que ele recebeu e como começou e terminou. Filtros por mensagens, entre agentes (delegações, mensagens enviadas e recebidas, esperas por outro agente), comandos, MCP, skills, falhas e contexto; chamadas de MCP e uso de skill ganham etiqueta (servidor MCP; skill e se foi invocada, carregada, lida ou teve script rodado). Duplo clique num cartão da árvore abre aqui.

Link direto: `http://localhost:5173/?file=<caminho do .jsonl>&view=tree|timeline|activity&agent=<id do agente>`.

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
| `server/analysis.ts` | Linha do tempo: blocos de espera, processos longos (cell → wait → write_stdin no Codex) e estatísticas por agente |
| `server/activity.ts` | Sequência do que cada agente fez, com as esperas juntadas e o resumo (pedido, começo, fim) |
| `server/classify.ts` | Marca chamadas de MCP (`mcp__srv__tool` no Claude, `srv__tool` no Codex) e uso de skill (`Skill`, skill injetada, leitura do SKILL.md/playbooks, scripts) |
| `server/flow.ts` | Blocos por agente em ordem de tempo e as setas de delegação, mensagem (envio pareado com o recebimento) e volta |
| `server/discover.ts` | Acha as sessões raiz de cada ferramenta lendo só o começo do arquivo (cache por mtime) |
| `server/index.ts` | API local só leitura; só abre `.jsonl` dentro das pastas das ferramentas |
| `src/features/session-list/` | Lista e filtros das sessões |
| `src/features/session-tree/` | Árvore em react-konva, painel de detalhes e store zustand |
| `src/features/timeline/` | Linha do tempo em react-konva |
| `src/features/activity/` | Feed de atividade por agente |
| `src/features/flow/` | Diagrama de sequência entre agentes |

O conteúdo das sessões é dado, não instrução: a página mostra texto e nunca executa nada.
