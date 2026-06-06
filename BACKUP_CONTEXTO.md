# BACKUP DE CONTEXTO — Force One
> Criado para continuidade em nova sessão Claude. Contém tudo necessário para retomar o desenvolvimento.

---

## 1. IDENTIDADE DO PROJETO

**Nome:** Force One  
**Tipo:** Sistema de gestão para campo de airsoft  
**Localização:** `/Users/juanfirminoribeiro/Desktop/Force One`  
**Acesso local:** `http://localhost:5173` (rodar com `npm run dev`)  
**Usuário:** juanfirminoribeiro@gmail.com

---

## 2. TECNOLOGIAS

| Tecnologia | Uso |
|---|---|
| React + TypeScript | Frontend |
| Vite | Bundler |
| Tailwind CSS v4 | Estilização |
| Supabase | Banco de dados em nuvem (único — sem localStorage) |
| Zustand | Estado global (unidade selecionada) |
| Lucide React | Ícones |
| react-webcam | Câmera para fotos |
| xlsx (SheetJS) | Importação de planilhas |

---

## 3. SUPABASE

**Project ID:** `oaycxjpnxdinuxnvskpz`  
**URL:** `https://oaycxjpnxdinuxnvskpz.supabase.co`  
**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9heWN4anBueGRpbnV4bnZza3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjcyODUsImV4cCI6MjA5NTcwMzI4NX0.2omnLcEWm400vMMrjOtvKbzLfQD7mB0W_T-ouV1OMDI`

**Arquivo .env.local:**
```
VITE_SUPABASE_URL=https://oaycxjpnxdinuxnvskpz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 4. SENHAS DO SISTEMA (tabela `settings` no Supabase)

| Chave | Senha | Onde é usada |
|---|---|---|
| `app_password` | `force1234` | Login geral do site (toda vez que abre/recarrega) |
| `config_password` | `force1234` | Acesso à aba Configurações + bloco "Atenção Especial" no Status |
| `star_password` | `pp_password` | ~~antiga, substituída pelo config_password~~ |

> Para alterar: `UPDATE settings SET value = 'nova_senha' WHERE key = 'app_password';`

---

## 5. TABELAS NO SUPABASE

```
access_types         — Tipos de acesso ao campo (Com/Sem Equipamento)
customer_teams       — Relação N:N entre clientes e times
customers            — Cadastro de clientes/operadores (602 importados)
infractions          — Ocorrências registradas por operador
operators            — (não usada ativamente)
payment_methods      — Meios de pagamento (Dinheiro, Pix, Débito, Crédito)
product_categories   — Categorias de produtos (Comida, Bebida, Outros)
products             — Produtos para venda + controle de estoque
sale_items           — Itens de cada venda
sales                — Registro de vendas
settings             — Senhas e configurações do sistema
stock_entries        — Histórico de movimentações de estoque
teams                — Times/grupos de operadores
unit_access_prices   — Preços por unidade/tipo de acesso
unit_payment_fees    — Taxas por unidade/método de pagamento
units                — Filiais/unidades do campo
visits               — Registro de entradas/acessos ao campo
```

### Campos importantes da tabela `customers`:
```sql
id, name, cpf, whatsapp, email, birth_date, gender,
play_style, weapon_type, photo_url (base64),
is_legacy (boolean — cliente antes do sistema),
is_star (boolean — operador estrela/especial),
created_at
```

### Campos importantes da tabela `products`:
```sql
id, name, description, price, quantity (estoque atual),
min_stock (alerta de mínimo), unit, photo_url,
category_id, active, created_at
```

---

## 6. ARQUITETURA DO APP

### Fluxo de dados
- **100% Supabase** — sem localStorage, sem offline. Toda leitura/escrita vai diretamente ao Supabase.
- `dataService.ts` — wrapper fino sobre o cliente Supabase com API fluente (`.from().select().eq().execute()`)
- `unitStore.ts` — Zustand store que persiste a unidade selecionada

### Autenticação
- **Sem auth real** — usa senhas simples armazenadas em `settings`
- Login geral: verificado no App.tsx, estado apenas em memória (`useState(false)`) → pede senha a cada reload
- Configurações: verificado no ConfiguracoesModule (mesmo padrão)

---

## 7. ESTRUTURA DE ARQUIVOS

```
src/
├── App.tsx                          — Shell principal, login, tabs de navegação
├── main.tsx
├── index.css
├── lib/
│   ├── supabase.ts                  — Cliente Supabase
│   ├── dataService.ts               — Wrapper query builder
│   └── sync/                        — (arquivos legados, não usados)
├── stores/
│   └── unitStore.ts                 — Zustand: unidade atual
├── types/
│   └── index.ts                     — Types TypeScript
├── components/
│   ├── UnitSelector.tsx             — Seletor de filial no header
│   └── TeamSelector.tsx             — Seletor de times (reutilizável)
└── modules/
    ├── acesso/                      — Aba "Entrada"
    │   ├── AcessoModule.tsx
    │   └── components/
    │       ├── Step1Identificacao.tsx
    │       ├── Step2TipoAcesso.tsx
    │       ├── Step3Pagamento.tsx
    │       └── Step4Confirmacao.tsx
    ├── venda/
    │   └── VendaModule.tsx          — Aba "Venda" (comida/bebida)
    ├── estoque/
    │   └── EstoqueModule.tsx        — Aba "Estoque"
    ├── jogo/
    │   └── JogoModule.tsx           — Aba "Status dos Campos"
    ├── operadores/
    │   └── OperadoresModule.tsx     — Aba "Operadores" (cadastros)
    ├── ocorrencias/
    │   └── OcorrenciasModule.tsx    — Aba "Ocorrências"
    └── configuracoes/
        ├── ConfiguracoesModule.tsx  — Menu de configurações (com senha)
        ├── ImportarClientes.tsx     — Importação via XLSX
        └── ProdutosConfig.tsx       — Gerenciar produtos/categorias
```

---

## 8. ABAS DE NAVEGAÇÃO

| Aba | Componente | Descrição |
|---|---|---|
| Entrada | AcessoModule | Registrar acesso ao campo (4 passos) |
| Venda | VendaModule | Vender produtos/lanches (carrinho) |
| Estoque | EstoqueModule | Controle de estoque com movimentações |
| Status dos Campos | JogoModule | Dashboard do dia com métricas |
| Operadores | OperadoresModule | Cadastro e histórico de clientes |
| Ocorrências | OcorrenciasModule | Registrar infrações/advertências |
| Configurações | ConfiguracoesModule | Filiais, Pagamento, Produtos, Importar (protegido por senha) |

---

## 9. FLUXO DE ENTRADA (AcessoModule)

**4 passos:**
1. **Identificação** — busca cliente por nome/CPF/WhatsApp ou cadastra novo
   - Se cliente sem dados completos (email, foto, gênero, etc.) → modal de enriquecimento abre automaticamente
   - Se sem foto → câmera abre para tirar foto e salvar no perfil
2. **Tipo de Acesso** — Com Equipamento (R$ 50) / Sem Equipamento (R$ 30)
3. **Pagamento** — Dinheiro / Pix / Cartão Débito / Cartão Crédito (com taxas)
4. **Confirmação** — finaliza, salva na tabela `visits`, toast de sucesso 3s

---

## 10. MÓDULO OPERADORES

- Lista 602+ clientes importados de planilha
- Busca por nome, CPF, WhatsApp, e-mail
- Perfil completo: foto, dados, times, flags (legacy, estrela), ocorrências, histórico de visitas com campo
- Edição inline com câmera para trocar foto
- Flags: `is_legacy` (já visitava antes do sistema) e `is_star` (operador estrela)

---

## 11. STATUS DOS CAMPOS (JogoModule)

- Filtro de data: **Hoje / Ontem / Calendário**
- Métricas com comparação vs mesmo dia da semana anterior (▲▼%)
- Bloco **"Atenção Especial"** (protegido por senha `config_password`):
  - Aparece se houver operador ⭐ estrela OU com ocorrências no campo
  - Mostra preview ofuscado (blur) até digitar a senha
  - Após desbloquear: lista estrelas e operadores com ocorrências
  - Botões: "Ver perfil" e "Ver advertências" (modais inline)
- Gráficos: por sexo, faixa etária, estilo de jogo
- Tabela de ocorrências do dia

---

## 12. OCORRÊNCIAS

- **Aba Hoje:** lista jogadores do dia, botão "Registrar" abre checklist
- **Checklist em massa:** seleciona múltiplos jogadores, descrição em grupo ou individual, filtro por campo
- **Aba Histórico:** todos operadores que já tiveram ocorrências, agrupados, expandíveis, com delete
- Ocorrências salvas com: customer_id, unit_id, description, created_at
- Exibidas no perfil do operador com data/hora/campo

---

## 13. VENDA (VendaModule)

**3 passos:**
1. **Produtos** — grid por categoria, carrinho com +/−, cliente opcional
2. **Pagamento** — métodos com taxa calculada
3. **Confirmação** — finaliza, salva em `sales` + `sale_items`

**15 produtos cadastrados:**
- Lanches: X-Burger, X-Salada, X-Bacon, X-Tudo, X-Linguiça, X-Linguiça II, X-Cheddar, X-Egg Duplo
- Bebidas: Água com Gás, Água sem Gás, Refrigerante, Energético, Gatorade, H2O, Cerveja

---

## 14. ESTOQUE (EstoqueModule)

- Lista com badge colorido: 🟢 ok / 🟡 baixo / 🔴 zerado
- Alerta clicável para filtrar produtos com estoque baixo
- Por produto: foto (câmera), nome, descrição, preço, unidade, categoria, estoque atual/mínimo
- Movimentações: **Entrada** (+) / **Saída** (−) / **Ajuste** (=total)
- Histórico completo de movimentações por produto

---

## 15. CONFIGURAÇÕES (protegida por senha `force1234`)

| Módulo | O que faz |
|---|---|
| Filiais | Criar/renomear/excluir unidades. Ao criar, gera automaticamente unit_access_prices e unit_payment_fees |
| Pagamento | Preços por tipo de acesso e taxas por método, com toggle Padrão/Próprio por filial |
| Produtos | Gerenciar produtos e categorias para venda |
| Importar Clientes | Upload de .xlsx/.csv com mapeamento automático de colunas |

---

## 16. DADOS ATUAIS NO SUPABASE

- **Clientes:** 602 (600 importados de planilha, marcados como `is_legacy = true`)
- **Unidades:** 2 (Force One - Unidade 1, Force One - Unidade 2)
- **Tipos de acesso:** Com Equipamento (R$50), Sem Equipamento (R$30)
- **Meios de pagamento:** Dinheiro, Pix, Cartão de Débito (2,50), Cartão de Crédito (3,50)
- **Produtos:** 15 (8 lanches + 7 bebidas)
- **Categorias:** Comida, Bebida, Outros

---

## 17. PADRÕES DE CÓDIGO

### Query pattern (dataService)
```typescript
// SELECT
const { data } = await dataService.from('customers').select('*').eq('id', id).execute()

// INSERT
await dataService.from('customers').insert({ id: crypto.randomUUID(), name: '...' })

// UPDATE
await dataService.from('customers').update({ name: '...' }).eq('id', id).execute()

// DELETE
await dataService.from('customers').delete().eq('customer_id', id).execute()
```

### Query direta Supabase (para joins)
```typescript
const { data } = await supabase
  .from('visits')
  .select('*, customers(name, photo_url), units(name)')
  .gte('visited_at', startIso)
  .order('created_at', { ascending: false })
```

### IDs
- Sempre `crypto.randomUUID()` — nunca `Date.now()` ou strings como `"customer-123"`

### Fotos
- Armazenadas como **base64** diretamente no campo `photo_url` das tabelas
- Capturadas via `react-webcam` com `screenshotFormat="image/jpeg"`

---

## 18. BUGS CONHECIDOS / HISTÓRICO DE FIXES

- **Tela branca:** geralmente erro de `const` sendo reatribuído ou import inválido → `npx tsc --noEmit` para diagnosticar
- `dataService` requer `.execute()` explícito em todas as queries com filtros/ordenação
- CPF/WhatsApp/email devem ser validados sem duplicatas na entrada de novos clientes
- `enrichCustomer` é `const` do useState — para modificar usar variável local `let finalCustomer = enrichCustomer`

---

## 19. COMO RODAR

```bash
cd "/Users/juanfirminoribeiro/Desktop/Force One"
npm run dev
# Acessa: http://localhost:5173
# Senha: force1234
```

---

## 20. IDEIAS / MELHORIAS FUTURAS

- [ ] Dashboard financeiro: faturamento de vendas vs entradas
- [ ] Relatório de estoque baixo por e-mail
- [ ] Histórico de vendas por cliente (vincular sales ao operador)
- [ ] QR Code no perfil do cliente para entrada rápida
- [ ] App mobile (PWA) para uso no campo
- [ ] Modo offline com sync ao reconectar
- [ ] Integração de pagamento (PagSeguro/Mercado Pago)
- [ ] Relatório mensal em PDF
- [ ] Notificação de operador estrela/ocorrência ao dar entrada
- [ ] Foto nos produtos de venda
- [ ] Sistema de comanda por mesa/área do campo

---

## 21. PARA NOVA SESSÃO — PROMPT DE INÍCIO SUGERIDO

```
Estou continuando o desenvolvimento do sistema "Force One", um sistema de gestão 
para campo de airsoft. O projeto está em:
/Users/juanfirminoribeiro/Desktop/Force One

Leia o arquivo BACKUP_CONTEXTO.md na raiz do projeto para ter todo o contexto 
necessário antes de continuar.

O servidor está rodando em http://localhost:5173
Supabase project: oaycxjpnxdinuxnvskpz

Quero continuar com: [descreva o que quer fazer]
```

---

*Backup gerado em 2026-06-02*
