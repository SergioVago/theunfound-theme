# Licença — MPL 2.0 é a escolha certa aqui

> **Estado: decidido e aplicado.** A licença do theUnfound Theme é a **Mozilla Public
> License 2.0**, e é ela que vai selecionada no formulário da ATN. O texto integral está
> em `LICENSE`, na raiz do repositório (cópia de referência também em
> `docs/publicacao/MPL-2.0.txt`), e **o `.xpi` distribuído carrega esse mesmo `LICENSE`
> dentro dele** (`scripts/build.sh` o acrescenta ao pacote depois de zipar `addon/`).
> As seções abaixo registram *por que*.

## Veredito

**MPL 2.0.** E não é empate técnico: para *este* addon a MPL 2.0 ganha das outras duas
por três motivos concretos.

1. **Todo arquivo do addon que aceita comentário tem o cabeçalho da MPL 2.0.** Conferido
   em `addon/` na 0.4.0: **17 dos 19** arquivos empacotados abrem com o bloco de três
   linhas
   `"This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0"`
   — os 15 de código (7 `.js`/`.mjs` e 8 `.css`) mais `addon/options/options.html`
   (comentário HTML, depois do `<!DOCTYPE html>`) e `addon/icons/icon.svg` (comentário
   XML). Os dois que ficam sem são os únicos que não aceitam comentário:
   `addon/manifest.json` e `addon/experiments/unfoundTheme/schema.json`. Trocar de licença
   agora significaria reescrever 17 cabeçalhos *e* explicar a troca.
2. **É a licença do Thunderbird.** Se algum dia um pedaço disto for parar no Thunderbird
   (ou num addon oficial), não existe conversa de licença: é o mesmo texto. Com MIT também
   dá, mas com GPL **não dá** — a Mozilla não aceita código GPL-only na árvore.
3. **A MPL 2.0 é a única das três que protege o trabalho sem fechar portas.** O copyleft
   dela é **por arquivo** (§1.9, "Larger Work"): quem pegar o seu CSS tem de publicar as
   modificações *naquele CSS*, mas pode juntá-lo a um addon maior com outra licença. É o
   equilíbrio exato para um projeto de aparência, cujo valor está nos arquivos de estilo
   e nos decoradores — justamente as peças que alguém copiaria.

## Comparação, em consequências práticas

| Situação concreta | MPL 2.0 | GPL 3.0 | MIT |
|---|---|---|---|
| Alguém republica o seu addon na ATN com outro nome | Pode, mas **tem de publicar o código dos arquivos que você escreveu**, com os mesmos cabeçalhos — fork visível, dá para apontar a origem | Igual, e ainda obriga o addon **inteiro** a ser GPL | Pode fechar o código e nem citar você (só manter o aviso de copyright num canto) |
| Alguém melhora a sua barra lateral e não devolve | Violação: o CSS/JS modificado tem de sair publicado | Violação | Permitido |
| Um addon comercial quer usar só o seu `SenderTrust.sys.mjs` | Pode, mantendo esse arquivo sob MPL e publicando as mudanças nele; o resto do addon dele continua fechado | Só se o addon **todo** virar GPL — na prática, não usam | Pode usar e fechar |
| Virar parte do Thunderbird algum dia | Sem atrito: mesma licença | Bloqueado | Possível |
| Combinar com código GPL de outro addon | Permitido: a MPL 2.0 (§3.3) deixa o resultado ser distribuído sob GPL/LGPL/AGPL ("Secondary Licenses") | Permitido | Permitido |
| Patentes | Concessão de patente expressa (§2.1(b)), com término em caso de litígio (§5.2) | Concessão expressa | **Nenhuma** |
| Alguém usar o nome/ícone do addon num fork | **A licença não cede marca** (§2.3: nada de direitos sobre nomes, marcas ou logos do licenciante) — "theUnfound Theme" e o ícone continuam seus | Idem na prática | Idem |
| Esforço para você | `LICENSE` (feito, e dentro do `.xpi`) + cabeçalhos (todos no lugar) | `LICENSE` + trocar 17 cabeçalhos | `LICENSE` + trocar 17 cabeçalhos |

A linha das marcas importa mais agora que o nome é marca própria: a MPL 2.0 licencia o
**código**, não o nome nem o ícone. Quem forkar pode usar o código; não pode se chamar
theUnfound Theme.

**Quando outra escolha faria sentido** (nenhuma se aplica aqui): MIT se o objetivo fosse
máxima adoção, inclusive por produto fechado, sem se importar com fork proprietário —
típico de biblioteca. GPL 3.0 se o objetivo fosse impedir qualquer uso em produto fechado
e você estivesse disposto a brigar com a incompatibilidade de ecossistema. Para um addon
de interface do Thunderbird, publicado por uma pessoa, que quer fork visível e porta
aberta para o upstream, a MPL 2.0 é o meio exato.

## Incompatibilidades: não há nenhuma

Checado arquivo por arquivo:

- **Nenhum código de terceiro embutido.** `addon/` não tem biblioteca nenhuma: só os seus
  `.js`/`.mjs`, as `.css` e um `icon.svg` escrito à mão. O `tools/tbctl.py` declara no
  próprio docstring "Minimal Thunderbird driver over Marionette (**no external deps**)" e
  importa só stdlib (`argparse, base64, json, os, socket, subprocess, sys, time`); os
  `tools/*.js` não têm um `require`/`import`. Zero dependência = zero conflito de licença.
- **Nenhuma fonte embutida.** Não existe `@font-face` em lugar nenhum. O CSS só *menciona*
  nomes de família (`"Adwaita Sans"`, `"Inter Variable"`, `"Inter"`, `system-ui`), o que
  não distribui arquivo de fonte e não cria obrigação de licença (OFL ou qualquer outra).
- **Nenhum ícone de terceiro.** Os ícones são SVG inline, escritos no próprio CSS
  (`data:image/svg+xml,...` em `skin/sidebar.css`) e o `icons/icon.svg`. Nada de pacote de
  ícones, nada do Thunderbird, nada da Readdle.
- **Nada da Readdle.** Nem código, nem asset, nem recurso. A semelhança é de *aparência*,
  implementada do zero — o que é questão de marca (tratada no arquivo 01), não de licença.
- **O Thunderbird é MPL 2.0** e você não copiou código dele: o addon usa APIs em tempo de
  execução (`ChromeUtils.importESModule`, `MailServices`, `Services`), o que não cria obra
  derivada. Se *tiver* vindo algum seletor ou valor de folha de estilo do Thunderbird, a
  MPL 2.0 já é a licença certa para isso também — mais um motivo para não trocar.
- **O seletor de licença da ATN** (`license_form.builtin`, no formulário de submissão) traz
  as licenças embutidas do addons-server, e MPL 2.0 está entre elas — então o formulário
  fica consistente com o que o repositório diz. Se um dia precisar de licença fora da
  lista, o mesmo formulário tem o campo "Other" com nome e texto livres.

## Situação no repositório

**Feito:**

1. ✅ `LICENSE` na raiz, com o **texto integral** da MPL 2.0 (a MPL exige que o texto
    acompanhe a distribuição — link não basta). A cópia de referência usada está em
    `docs/publicacao/MPL-2.0.txt`.
2. ✅ **O `.xpi` distribuído carrega o `LICENSE`.** `scripts/build.sh` zipa `addon/` e
    depois acrescenta o `LICENSE` ao pacote, então quem recebe o complemento recebe o
    texto integral junto — não só um link no README. A exigência da MPL está cumprida no
    artefato, e não apenas no repositório.
3. ✅ Cabeçalho Exhibit A (bloco de três linhas) em **todos** os 17 arquivos do addon que
    aceitam comentário: os 15 de código, `addon/options/options.html` (comentário HTML) e
    `addon/icons/icon.svg` (comentário XML).
4. ✅ `manifest.json` **sem** campo de licença — e isso é o certo: o Thunderbird/ATN não usa
    campo de licença no manifest, quem declara é o formulário da listagem. O JSON também
    não aceita comentário, logo nem ele nem o `schema.json` levam cabeçalho; normal, a MPL
    cobre a obra via `LICENSE` — que agora vai dentro do `.xpi`.
5. ✅ Seção **Licença** no fim do `README.md`, com o texto integral em `LICENSE`, a
    ressalva de quais arquivos levam cabeçalho e a nota de marca que diz que a licença
    **não** concede direitos sobre o nome "theUnfound Theme" nem sobre o ícone.

**Falta:**

6. ⬜ Uma linha no `README.md` dizendo que contribuições entram sob MPL 2.0 (dispensa CLA
    e evita a pergunta na primeira PR).
7. ⬜ Ao criar o repositório público, confirmar que o GitHub reconheceu a licença (ele lê
    o `LICENSE` da raiz e mostra "MPL-2.0" no cabeçalho do repo) e manter o cabeçalho
    Exhibit A em todo arquivo novo.

---

### Fontes
- [Mozilla Public License 2.0 (texto)](https://www.mozilla.org/MPL/2.0/) — §1.9, §2.1, §2.3, §3.3, §5.2 e Exhibit A
- [MPL 2.0 FAQ (copyleft por arquivo, compatibilidade com GPL/LGPL/AGPL)](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)
- [Add-on Policies — código revisável, sem ofuscação](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- Conferência de cabeçalhos e dependências na 0.4.0:
  `grep -rl "This Source Code Form is subject" addon/` (17 dos 19 arquivos empacotados —
  faltam só `manifest.json` e `schema.json`, que não aceitam comentário) e
  `grep -hnE "^\s*(import|from) " tools/tbctl.py`
