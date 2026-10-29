# Notas ao revisor da ATN ("Notes for Reviewers")

Cole a versão **en-US** — os revisores da ATN são internacionais. A versão pt-BR está
abaixo, caso prefira.

**Antes de colar:** confirme que `https://github.com/SergioVago/theunfound-theme` já existe e está
público, e que a tag `v0.4.1` existe e está pública.

Os nomes de arquivo, contagens de linha e números de linha abaixo foram **re-derivados do
código da 0.4.1** neste worktree (`wc -l`, `grep -n`), depois da renomeação interna
(`sparkUI` → `unfoundTheme`, `spk-*` → `unf-*`), da remoção do código de compatibilidade
com as versões 0.1.0/0.2.0 e do acréscimo dos cabeçalhos MPL (que deslocaram três linhas em
cada arquivo). Se mexer no código antes de submeter, re-derive de novo:
divergência entre nota e código custa uma rodada de revisão.

---

## EN-US (para colar)

```
Hello, and thank you for reviewing.

theUnfound Theme 0.4.1 is a pure appearance add-on: it restyles Thunderbird's own windows
and adds no features, no accounts, no network code. Full source, including this exact
version, is public at https://github.com/SergioVago/theunfound-theme (tag v0.4.1). The .xpi
is a plain zip of the addon/ directory produced by scripts/build.sh, plus the full MPL 2.0
LICENSE text at the package root — nothing is minified, bundled, generated or obfuscated,
so the files in the .xpi are byte-for-byte the files in the repository.

This is a first submission under a new add-on ID (theme@theunfound.com.br), so there is no
existing installed base: nobody receives this version as an update, and there is no
migration path to test.

1. WHY AN EXPERIMENT API

There is no MailExtension API that can style Thunderbird's chrome documents. The
WebExtension surface reaches message content (messageDisplayScripts) and the compose
body (composeScripts), and themes reach only a handful of colour keys — none of them
touch the folder pane, the thread pane, the reading pane header, the tab bar, the
stand-alone message window or the compose window, which is exactly where this add-on
works. Styling those documents requires loading an author-level stylesheet into each
one, which only a privileged (experiment) context can do. That is the whole reason the
experiment exists: it is a CSS/JS injector for five known chrome URLs, nothing else.

2. WHAT EACH PART DOES

addon/experiments/unfoundTheme/implementation.js (598 lines) — the only privileged file.
It:
  • registers a resource:// substitution for the extension root under a per-startup
    host (resource://theunfound-theme-<instanceId>/, built at line 148, registered at
    line 171), because system-privileged scripts cannot be loaded from moz-extension:;
  • observes "document-element-inserted" (DOCUMENT_TOPIC, line 14) and, for the five
    documents listed in the DOCUMENTS map (lines 64-84:
    chrome://messenger/content/messenger.xhtml, .../messageWindow.xhtml,
    .../messengercompose/messengercompose.xhtml, about:3pane, about:message) plus the
    message body document inside about:message, calls
    windowUtils.loadSheetUsingURIString(..., AUTHOR_SHEET) for that document's
    stylesheets (line 384) and Services.scriptloader.loadSubScriptWithOptions for its
    decorator script (line 452);
  • exposes exactly four functions to the extension (see schema.json, 84 lines):
    configure(options), getLayoutState(), applyRecommendedLayout(), getAccounts()
    (getAPI() at lines 563-598);
  • getAccounts() reads the account list (MailServices.accounts.accounts, line 497) and,
    for each identity e-mail, MailServices.ab.cardForEmailAddress() (line 511) to offer
    the address-book photo in the options page. Local reads only;
  • stop() (line 212), called from onShutdown() (line 552), reverses everything:
    Services.obs.removeObserver for both topics (lines 217-218),
    removeSheetUsingURIString for every sheet in every window (line 426), removal of the
    unf-* root attributes (lines 429-435), the decorators' own restore paths, and
    setSubstitution(host, null) (line 253). Disabling the add-on restores the default UI
    without a restart;
  • the per-instance host/attribute scheme and the "theunfound-theme:instance-started"
    observer notification (INSTANCE_TOPIC, line 18) exist so that a late shutdown of an
    older version cannot strip the newer version's styling (this bit is documented in the
    comment at the top of the file, lines 21-30).

addon/skin/*.css (2,244 lines total across 7 files: about3pane.css 851, aboutMessage.css
339, sidebar.css 573, messenger.css 194, tokens.css 136, compose.css 127,
messageContent.css 24) — plain CSS, loaded as author sheets. The only URLs in them are
inline data:image/svg+xml icons and one relative @import url("tokens.css") at the top of
about3pane.css, aboutMessage.css, messenger.css and compose.css; no @font-face, no remote
resources.

addon/content/threadDecorator.js (473 lines) — wraps the cards-view row builder
(ThreadCard.prototype.fillRow, lines 374-383) to add the avatar, the preview line and the
sender formatting, and puts the original function back on shutdown. The preview text is
hdr.getStringProperty("preview") (lines 276 and 348), i.e. the snippet Thunderbird itself
already stores in the message database; the add-on never opens or fetches a message body.

addon/content/sidebarDecorator.js (1,114 lines) — builds the account rail, keeps its
collapsed state in Services.xulStore (lines 218 and 226 — the same place Thunderbird keeps
window layout state) and listens to folder/unread changes through
MailServices.mailSession.AddFolderListener (line 1036, removed at line 1083).

addon/content/messageDecorator.js (221 lines) — rearranges the about:message header and,
for the suspicious-sender badge, reads the open message's own Authentication-Results
header (authenticationFailure(), lines 136-154; the read itself is the
Trust.readAuthenticationResults(uri) call at line 144).

addon/content/SenderTrust.sys.mjs (531 lines) — classifies a sender as known / unknown /
suspicious from local inputs only: MailServices.ab (is the address in the user's address
book), MailServices.accounts (is it one of the user's own identities), Services.eTLD
(registrable domain, lines 151 and 161) and the message's Authentication-Results header
(dmarc=fail / spf=fail, lines 460 and 463).

addon/background.js (54 lines) — reads storage.local and calls
browser.unfoundTheme.configure() (line 43).
addon/options/* — the options page (options.html 102 lines, options.js 257,
options.css 274). No privileged code.

3. NOTHING IS TRANSMITTED

The add-on has no network code at all. Two greps over the whole addon/ directory confirm it:

  grep -rnE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.connection' addon/
  grep -rnE 'eval\(|new Function|setTimeout\("|innerHTML\s*=' addon/

Both return nothing. There are no remote script or style references, no analytics, no
update server of our own, no "phone home" on install, and no third-party libraries
bundled. The only URLs in the whole add-on are XML namespaces, the MPL header URL and
inline data: SVG icons. "permissions": ["storage"] is the only requested permission.

Because the add-on collects and transmits nothing, there is no data-collection consent
prompt — there is nothing to consent to. The privacy policy is pasted in full in the ATN
privacy policy field, and the listing description carries a summary of it. No third-party
library is bundled, so there is no VENDORS.md / library reference to check.

4. THUNDERBIRD SETTINGS IT CAN WRITE (ALL USER-INITIATED)

  • mail.threadpane.listview = 0, mail.pane_config.dynamic = 2,
    mail.threadpane.cardsview.rowcount = 3 — written ONLY by applyRecommendedLayout()
    (implementation.js lines 587-591), which runs only when the user presses the "Use
    cards and 3 columns" button on the options page. Nothing is written at install or
    startup; getLayoutState() (lines 574-586) only reads those three prefs to show the
    button's state. The listing description states this explicitly.
  • Services.xulStore: one value, the rail's collapsed flag, next to Thunderbird's own
    window-layout state (sidebarDecorator.js lines 218 and 226).
  • storage.local: the options, plus the per-account photo the user picks in the options
    page (stored as a data: URL; background.js's cleanPhotos(), line 18, rejects anything
    that is not data:image/png|jpeg|webp|gif;base64).

5. HOW TO TEST IN TWO MINUTES

  1. Fresh profile, Thunderbird 140-158, any account (an offline local folder account is
     enough — no mail needs to be fetched).
  2. Install the .xpi. The UI changes immediately, no restart: the folder pane and spaces
     toolbar turn graphite, the message list shows avatars and a preview line.
  3. Click the collapse button at the top of the folder pane: the pane becomes a narrow
     rail with one photo/initials circle per account. Click it again to expand.
  4. Add-on Options: switch Theme to Light/Dark, turn avatars or the preview line off —
     every change applies live. The "Use cards and 3 columns" button is the only control
     that touches Thunderbird's own preferences.
  5. Disable the add-on in the Add-ons Manager: the default Thunderbird UI comes straight
     back, with no restart. Re-enable it and the look returns.

6. ABOUT strict_max_version

browser_specific_settings.gecko.strict_max_version is "158.*" because Thunderbird requires
a strict maximum version for add-ons that use an Experiment API, and because the add-on
reads Thunderbird's internal DOM, which can change between major releases. I will ship an
updated version for each new Thunderbird release.

ATN's own validator, on the 0.4.0 upload, reported 0 errors, 56 warnings and 1 notice. All
56 warnings were the same message, "Invalid nesting of selectors found": they were native
CSS nesting, and each one pointed at the opening line of a top-level rule whose block
nests, not at an invalid selector (sidebar.css 15, about3pane.css 14, aboutMessage.css 8,
options/options.css 8, compose.css 6, messenger.css 4, tokens.css 1). The declared floor is
Thunderbird 140 and native nesting has been in Gecko since 117, so every version this
add-on supports parses it: the CSS itself had no error, and the warning was about form, not
about a defect. The single notice was the "strict_max_version not required" one answered
above, and nothing else came up: no MANIFEST_FIELD_PRIVILEGED, no UNSUPPORTED_API, no
MISSING_DATA_COLLECTION_PERMISSIONS.

0.4.1, the version in front of you, is that same CSS rewritten without nesting: all 208
nesting sites in the eight stylesheets were lowered by replacing every "&" with its parent
selector, expanding the parent lists. No :is() was introduced, and no effective selector
and no declaration changed, so the add-on looks exactly as 0.4.0 did. Since not one nested
selector is left, those 56 warnings have nothing left to match, so the only finding I
expect from this upload is the strict_max_version notice. I have not uploaded 0.4.1 yet,
though, so that is what the change implies, not something I have measured.

Two checks stand behind the claim that the rewrite changed nothing. Across all eight
stylesheets, the ordered sequence of (at-rule, selector, declarations) in the flattened
files is identical, rule for rule, to the same CSS run through postcss-nesting — all 330
rules. And the computed style of 7,408 elements, measured in a real Thunderbird in five
states (light/dark x rail collapsed/expanded, plus the light sidebar), is identical between
the nested build and the flattened one — that one covers every stylesheet the mail windows
load, which is all of them but options.css.

On validation, so you know I am not surprised by it either: the public addons-linter (the
Firefox JS edition, v10), which my CI runs, gives a different output on the 0.4.1 package
you have in front of you. It is a Firefox tool and does not know Thunderbird's experiment
APIs, so on this .xpi it reports MANIFEST_FIELD_PRIVILEGED for /experiment_apis
("privileged manifest fields are only allowed in privileged extensions"), four
UNSUPPORTED_API warnings (the four functions of the unfoundTheme namespace), a
MISSING_DATA_COLLECTION_PERMISSIONS warning and the same "strict_max_version not
required" notice. ATN's validator produced that same notice on 0.4.0, and it is the one
finding the two tools have ever agreed on, classified the same way by both. None of them
is a defect here: the first two are Firefox's privileged-extension rule (mail experiments
are privileged by definition on ATN), data_collection_permissions is deliberately not
declared (it is disabled in Thunderbird and may be rejected as a reserved field, and the
add-on collects nothing), and strict_max_version is required by Thunderbird for mail
experiments — the opposite of the Firefox rule the notice comes from.

7. TRADEMARKS

The visual reference is Readdle's Spark Mail. The add-on name does not use that
trademark, and neither does the listing summary nor any string in the add-on's own
interface; the long listing description mentions it once, descriptively, attributed to
Readdle, and states the lack of affiliation. No Readdle code, icon or asset is included —
every icon in the add-on is an inline SVG written for this project.

Happy to answer anything else, in English or Portuguese — sergio@theunfound.com.br.
```

---

## pt-BR (caso o campo aceite / prefira)

```
Olá, e obrigado pela revisão.

O theUnfound Theme 0.4.1 é um addon só de aparência: ele reestiliza as janelas do próprio
Thunderbird e não acrescenta nenhuma função, nenhuma conta e nenhum código de rede.
O código-fonte completo, nesta exata versão, é público em
https://github.com/SergioVago/theunfound-theme (tag v0.4.1). O .xpi é um zip simples do
diretório addon/ gerado por scripts/build.sh, mais o texto integral da licença MPL 2.0
(LICENSE) na raiz do pacote — nada é minificado, empacotado, gerado ou obscurecido, então
os arquivos do .xpi são byte a byte os do repositório.

Esta é a primeira submissão, sob um ID novo (theme@theunfound.com.br): não há base
instalada anterior — ninguém recebe esta versão como atualização e não há caminho de
migração a testar.

1. POR QUE UMA EXPERIMENT API

Não existe API de MailExtension capaz de aplicar estilo aos documentos de chrome do
Thunderbird. A superfície WebExtension alcança o conteúdo da mensagem
(messageDisplayScripts) e o corpo da composição (composeScripts), e os temas alcançam
apenas algumas chaves de cor — nenhuma delas chega ao painel de pastas, à lista de
mensagens, ao cabeçalho do painel de leitura, à barra de abas, à janela de mensagem
avulsa nem à janela de composição, que é exatamente onde este addon age. Aplicar estilo a
esses documentos exige carregar uma folha de estilo de autor dentro de cada um, o que só
um contexto privilegiado (experimento) pode fazer. É só isso que o experimento é: um
injetor de CSS/JS para cinco URLs de chrome conhecidas.

2. O QUE CADA PARTE FAZ

addon/experiments/unfoundTheme/implementation.js (598 linhas) — o único arquivo
privilegiado:
  • registra uma substituição resource:// para a raiz da extensão sob um host único por
    início (resource://theunfound-theme-<instanceId>/, montado na linha 148 e registrado
    na linha 171), porque script com privilégio de sistema não carrega de moz-extension:;
  • observa "document-element-inserted" (DOCUMENT_TOPIC, linha 14) e, para os cinco
    documentos do mapa DOCUMENTS (linhas 64-84:
    chrome://messenger/content/messenger.xhtml, .../messageWindow.xhtml,
    .../messengercompose/messengercompose.xhtml, about:3pane, about:message) mais o
    documento do corpo da mensagem dentro de about:message, chama
    windowUtils.loadSheetUsingURIString(..., AUTHOR_SHEET) para as folhas daquele
    documento (linha 384) e Services.scriptloader.loadSubScriptWithOptions para o script
    decorador (linha 452);
  • expõe exatamente quatro funções à extensão (ver schema.json, 84 linhas):
    configure(options), getLayoutState(), applyRecommendedLayout(), getAccounts()
    (getAPI() nas linhas 563-598);
  • getAccounts() lê a lista de contas (MailServices.accounts.accounts, linha 497) e, para
    cada e-mail de identidade, MailServices.ab.cardForEmailAddress() (linha 511), para
    oferecer a foto do catálogo de endereços na página de opções. Leitura local, nada mais;
  • stop() (linha 212), chamado por onShutdown() (linha 552), desfaz tudo:
    Services.obs.removeObserver dos dois tópicos (linhas 217-218),
    removeSheetUsingURIString de cada folha em cada janela (linha 426), remoção dos
    atributos unf-* da raiz (linhas 429-435), a restauração própria de cada decorador e
    setSubstitution(host, null) (linha 253). Desativar o addon devolve a interface padrão
    sem reiniciar;
  • o esquema de host/atributos por instância e a notificação
    "theunfound-theme:instance-started" (INSTANCE_TOPIC, linha 18) existem para que o
    desligamento atrasado de uma versão antiga não apague o visual da versão nova (está
    documentado no comentário do topo do arquivo, linhas 21-30).

addon/skin/*.css (2.244 linhas em 7 arquivos: about3pane.css 851, aboutMessage.css 339,
sidebar.css 573, messenger.css 194, tokens.css 136, compose.css 127,
messageContent.css 24) — CSS puro, carregado como folha de autor. As únicas URLs ali são
ícones data:image/svg+xml embutidos e um @import url("tokens.css") relativo no topo de
about3pane.css, aboutMessage.css, messenger.css e compose.css; nenhum @font-face, nenhum
recurso remoto.

addon/content/threadDecorator.js (473 linhas) — envolve o construtor de linha da
visualização em cartões (ThreadCard.prototype.fillRow, linhas 374-383) para acrescentar
avatar, linha de prévia e formatação do remetente, e devolve a função original no
desligamento. O texto da prévia é hdr.getStringProperty("preview") (linhas 276 e 348),
isto é, o resumo que o próprio Thunderbird já guarda no banco de mensagens; o addon nunca
abre nem baixa corpo de mensagem.

addon/content/sidebarDecorator.js (1.114 linhas) — monta o trilho de contas, guarda o
estado recolhido em Services.xulStore (linhas 218 e 226, o mesmo lugar onde o Thunderbird
guarda o layout da janela) e escuta mudanças de pasta/não lidas por
MailServices.mailSession.AddFolderListener (linha 1036, removido na linha 1083).

addon/content/messageDecorator.js (221 linhas) — reorganiza o cabeçalho do about:message
e, para o selo de remetente suspeito, lê o cabeçalho Authentication-Results da própria
mensagem aberta (authenticationFailure(), linhas 136-154; a leitura em si é a chamada
Trust.readAuthenticationResults(uri) da linha 144).

addon/content/SenderTrust.sys.mjs (531 linhas) — classifica o remetente como conhecido /
desconhecido / suspeito a partir de entradas locais: MailServices.ab (o endereço está no
catálogo do usuário), MailServices.accounts (é uma identidade dele), Services.eTLD
(domínio registrável, linhas 151 e 161) e o Authentication-Results da mensagem
(dmarc=fail / spf=fail, linhas 460 e 463).

addon/background.js (54 linhas) — lê storage.local e chama
browser.unfoundTheme.configure() (linha 43).
addon/options/* — página de opções (options.html 102 linhas, options.js 257,
options.css 274). Nenhum código privilegiado.

3. NADA É TRANSMITIDO

O addon não tem código de rede nenhum. Dois greps sobre todo o diretório addon/ confirmam:

  grep -rnE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.connection' addon/
  grep -rnE 'eval\(|new Function|setTimeout\("|innerHTML\s*=' addon/

Os dois não devolvem nada. Não há referência a script ou estilo remoto, telemetria,
servidor de atualização próprio, nem "aviso de instalação"; nenhuma biblioteca de terceiro
está embutida. As únicas URLs do addon são namespaces XML, a URL do cabeçalho da MPL e
ícones SVG em data:. "permissions": ["storage"] é a única permissão pedida.

Como o addon não coleta nem transmite nada, não há prompt de consentimento de coleta —
não há nada a consentir. A política de privacidade está colada por inteiro no campo
próprio da ATN, e a descrição da listagem traz um resumo dela. Nenhuma biblioteca de
terceiro está embutida, logo não há VENDORS.md / referência de biblioteca a conferir.

4. PREFERÊNCIAS DO THUNDERBIRD QUE ELE PODE ESCREVER (TODAS A PEDIDO DO USUÁRIO)

  • mail.threadpane.listview = 0, mail.pane_config.dynamic = 2,
    mail.threadpane.cardsview.rowcount = 3 — escritas SOMENTE por
    applyRecommendedLayout() (implementation.js, linhas 587-591), que só roda quando o
    usuário aperta o botão "Usar cartões e 3 colunas" na página de opções. Nada é escrito
    na instalação nem no início; getLayoutState() (linhas 574-586) só lê essas três prefs
    para mostrar o estado do botão. A descrição da listagem diz isso explicitamente.
  • Services.xulStore: um valor, o estado recolhido do trilho, ao lado do próprio layout
    de janela do Thunderbird (sidebarDecorator.js, linhas 218 e 226).
  • storage.local: as opções, mais a foto por conta que o usuário escolher na página de
    opções (guardada como data: URL; o cleanPhotos() do background.js, linha 18, rejeita o
    que não for data:image/png|jpeg|webp|gif;base64).

5. COMO TESTAR EM DOIS MINUTOS

  1. Perfil novo, Thunderbird 140-158, qualquer conta (uma conta de pastas locais já
     basta — não precisa baixar e-mail).
  2. Instale o .xpi. A interface muda na hora, sem reiniciar: painel de pastas e barra de
     áreas ficam grafite, a lista mostra avatares e a linha de prévia.
  3. Clique no botão de recolher no topo do painel de pastas: o painel vira um trilho
     estreito com um círculo de foto/iniciais por conta. Clique de novo para expandir.
  4. Opções do addon: troque o Tema para Claro/Escuro, desligue avatares ou a prévia —
     tudo aplica ao vivo. O botão "Usar cartões e 3 colunas" é o único controle que mexe
     em preferência do Thunderbird.
  5. Desative o addon no Gerenciador de Complementos: a interface padrão volta na hora,
     sem reiniciar. Reative e o visual retorna.

6. SOBRE O strict_max_version

browser_specific_settings.gecko.strict_max_version é "158.*" porque o Thunderbird exige
versão máxima estrita de addon que usa Experiment API, e porque o addon lê o DOM interno do
Thunderbird, que pode mudar entre versões maiores. Publicarei versão atualizada a cada
lançamento novo do Thunderbird.

O validador da própria ATN, no upload da 0.4.0, devolveu 0 erros, 56 avisos e 1 notice. Os
56 avisos eram todos a mesma mensagem, "Invalid nesting of selectors found": era
aninhamento nativo de CSS, e cada aviso apontava a linha de abertura de uma regra de topo
cujo bloco aninha, não um seletor inválido (sidebar.css 15, about3pane.css 14,
aboutMessage.css 8, options/options.css 8, compose.css 6, messenger.css 4, tokens.css 1). O
piso declarado é Thunderbird 140 e aninhamento nativo existe no Gecko desde o 117, então
toda versão que este addon suporta analisa isso: o CSS não tinha erro nenhum, e o aviso era
de forma, não de defeito. O único notice era o de strict_max_version "not required"
respondido acima, e nada mais apareceu: nenhum MANIFEST_FIELD_PRIVILEGED, nenhum
UNSUPPORTED_API, nenhum MISSING_DATA_COLLECTION_PERMISSIONS.

A 0.4.1, que é a versão à sua frente, é esse mesmo CSS reescrito sem aninhamento: os 208
sítios de aninhamento das oito folhas foram achatados trocando cada "&" pelo seletor do
pai, expandindo as listas de pais. Nenhum :is() foi introduzido, e nenhum seletor efetivo e
nenhuma declaração mudaram, então o addon tem exatamente a aparência que a 0.4.0 tinha.
Como não sobrou um único seletor aninhado, aqueles 56 avisos não têm mais o que casar, e
por isso o único achado que eu espero deste upload é o notice de strict_max_version. Mas
ainda não subi a 0.4.1, então isso é o que a mudança implica, não algo que eu tenha medido.

Duas conferências sustentam a afirmação de que a reescrita não mudou nada. Nas oito folhas,
a sequência ordenada de (at-rule, seletor, declarações) nos arquivos achatados é idêntica,
regra por regra, à do mesmo CSS passado pelo postcss-nesting — todas as 330 regras. E o
estilo computado de 7.408 elementos, medido num Thunderbird real em cinco estados
(claro/escuro x trilho recolhido/expandido, mais a barra lateral clara), é idêntico entre a
build aninhada e a achatada — essa cobre toda folha que as janelas de email carregam, que
são todas menos o options.css.

Sobre validação, para você saber que também não me pegou de surpresa: o addons-linter
público (a edição JS, v10), que o meu CI roda, dá saída diferente no pacote 0.4.1 que
você tem em mãos. Ele é ferramenta do Firefox e não conhece as Experiment APIs do
Thunderbird; neste .xpi ele devolve MANIFEST_FIELD_PRIVILEGED em /experiment_apis
("privileged manifest fields are only allowed in privileged extensions"), quatro avisos
UNSUPPORTED_API (as quatro funções do namespace unfoundTheme), um aviso
MISSING_DATA_COLLECTION_PERMISSIONS e o mesmo notice de strict_max_version "not
required". O validador da ATN devolveu esse mesmo notice na 0.4.0, e é o único achado em
que as duas ferramentas já concordaram, classificado igual pelas duas. Nenhum deles é
defeito aqui: os dois primeiros são a regra de extensão privilegiada do Firefox (mail
experiment é privilegiado por definição na ATN), o data_collection_permissions não foi
declarado de propósito (está desativado no Thunderbird e pode ser recusado como campo
reservado, e o addon não coleta nada) e o strict_max_version é exigido pelo Thunderbird
para mail experiments — o contrário da regra do Firefox de onde vem o notice.

7. MARCAS

A referência visual é o Spark Mail, da Readdle. O nome do addon não usa essa marca, nem o
resumo da listagem, nem qualquer string da interface do addon; a descrição longa a cita
uma vez, de forma descritiva, com atribuição à Readdle e declaração de ausência de
vínculo. Nenhum código, ícone ou recurso da Readdle está incluído — todo ícone do addon é
um SVG inline escrito para este projeto.

À disposição para qualquer outra pergunta, em inglês ou português —
sergio@theunfound.com.br.
```

---

## Antes de colar, confira

1. **A URL do repositório e a tag.** As notas citam
   `https://github.com/SergioVago/theunfound-theme` e a tag `v0.4.1`: publique o
   repositório e crie a tag **antes** de enviar, senão o revisor
   bate em 404 e a submissão volta.
2. **O `.xpi` enviado corresponde ao commit.** `scripts/build.sh` gera
   `dist/theunfound-theme.xpi` com `zip -X -9`, o que ajuda; rode o build a partir de uma
   árvore limpa (`git status` vazio).
3. **As contagens e os números de linha.** Foram re-derivados da 0.4.1 neste worktree. Se
   qualquer arquivo de `addon/` mudar antes da submissão, rode `wc -l` e `grep -n` outra
   vez — não ajuste de cabeça.
4. **O host do `resource://` e os atributos de raiz batem com o código.** As notas dizem
   `theunfound-theme-<instanceId>` e `unf-*`, que é o que `implementation.js` registra
   hoje (linhas 148 e 31-37). Divergência entre nota e código é o tipo de coisa que custa
   uma rodada de revisão.
5. **Os screenshots.** Já foram regerados num perfil de teste limpo, com elenco fictício
   (`tools/seed-profile.js` / `seed-senders.js` / `seed-accounts.js`): são os 15 arquivos
   de `screenshots/`, sem nenhum endereço real. Foram tirados da 0.4.0 e valem para a
   0.4.1 porque a reescrita do CSS não mudou aparência nenhuma; se você mexer no visual,
   regere antes de enviar.
   Antes de enviar, confira que as imagens escolhidas para a listagem saíram desse lote
   (nenhuma de `screenshots/tmp/`, que é rascunho) e que nenhuma mostra endereço, nome de
   conta ou assunto de mensagem de verdade.
