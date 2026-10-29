# Política de privacidade

**Cole o texto inteiro no campo "Privacy Policy" da ATN — não ponha um link.** A política
da ATN é literal: *"The add-on's privacy policy must be the full policy text; it cannot be
a link to an externally hosted privacy policy"*, e o guia de revisores lista "a privacy
policy which is merely a link to an external website" como motivo de *Reviewer Reply*
(recusa se você não responder em 7 dias). O arquivo `PRIVACY.md` no GitHub é bem-vindo
**além** do campo, nunca em lugar dele.

A mesma política exige quatro propriedades, todas atendidas pelo texto abaixo: ser
*"specific and exclusive to the add-on"* (fala deste addon, dos nomes de preferência
dele), *"clearly describe the purpose of the data collection"* (cada leitura vem com o
"para quê"), *"set forth the exact data to be collected"* (lista item a item) e
*"address the add-on's particular privacy properties"* (catálogo de endereços local,
cabeçalho da mensagem, storage.local). Exige também que **um resumo disso esteja na
descrição da listagem** — é a seção PRIVACIDADE dos arquivos 03/04.

**Antes de colar:** confirme que `https://github.com/SergioVago/theunfound-theme` já existe e está
público, e confira a data de "Última atualização".

**Um achado importante para esta parte:** a chave de manifest
`browser_specific_settings.gecko.data_collection_permissions` (que o AMO passou a exigir
de extensões novas do Firefox em 03/11/2025) **está desativada no Thunderbird**
(a suíte de testes do Gecko trata o recurso como "disabled, as for Thunderbird", bug
1987828) e a documentação do Thunderbird diz que, lá, o consentimento é responsabilidade
do addon. Conclusão prática: **não acrescente essa chave ao manifest** — ela pode ser
recusada como "reserved" no upload. O que cobre a exigência da política 6.2.1
("accurately state the data collection practices... including when it does not collect
data") é o texto abaixo + a frase "nada é transmitido" na descrição. Como o addon não
coleta nem transmite nada, não há consentimento a colher.

**Conferido contra o código da 0.4.1:** as três coisas que o addon grava são exatamente as
listadas abaixo — `storage.local` (opções + foto por conta, saneada por `cleanPhotos()` em
`addon/background.js`), `Services.xulStore` (um valor: o estado recolhido do trilho, em
`addon/content/sidebarDecorator.js`) e, **somente após o clique no botão**, as três prefs
de layout (`applyRecommendedLayout()` em
`addon/experiments/unfoundTheme/implementation.js`). Nenhuma chamada de rede existe no
código. Ver o arquivo 05, seções 3 e 4, para os números de linha.

---

## pt-BR (para colar)

```
Política de privacidade do theUnfound Theme

Última atualização: 22 de outubro de 2026

RESUMO

O theUnfound Theme não coleta, não armazena fora da sua máquina e não transmite nenhum
dado. Não há servidor, não há conta para criar, não há telemetria, não há anúncios e não
há análise de uso. O addon não tem uma única chamada de rede no código.

O QUE O ADDON LÊ, E PARA QUÊ

Tudo abaixo acontece dentro do seu computador, no seu perfil do Thunderbird, e nada
disso sai de lá:

• Catálogo de endereços local do Thunderbird — consultado pelo endereço de e-mail do
  remetente, para mostrar a foto e o nome do contato no avatar da lista de mensagens, no
  painel de leitura e no trilho de contas. O addon lê o contato; não cria, não altera e
  não apaga nada no catálogo.
• Lista das suas contas e identidades de e-mail — para montar o trilho de contas e para
  reconhecer quando o remetente é você mesmo. O addon não acessa senhas, nem
  configuração de servidor, nem o conteúdo das contas.
• Cabeçalhos da mensagem aberta — especificamente o Authentication-Results, acrescentado
  pelo seu próprio servidor de entrada, para marcar como suspeita a mensagem que
  reprovou em DMARC/SPF.
• Resumo (prévia) e remetente/data/assunto das mensagens listadas — lidos do índice local
  que o Thunderbird já mantém. O addon não abre, não baixa e não altera o corpo das
  mensagens.
• Contadores de não lidas e o nome das pastas — para os números do trilho e da barra
  lateral.

O QUE O ADDON GRAVA

• As suas opções (tema, avatares, prévia, formato do remetente, barra lateral escura,
  fonte proporcional), no armazenamento local da extensão, dentro do seu perfil.
• A foto que você escolher para cada conta na página de opções, guardada no mesmo lugar,
  embutida como data: URL. A imagem sai de um arquivo que você seleciona ou do seu
  catálogo de endereços; ela não é enviada a ninguém.
• O estado recolhido ou expandido do trilho de contas, guardado junto com o layout da
  janela do Thunderbird.
• Se — e só se — você apertar o botão "Usar cartões e 3 colunas" na página de opções,
  três preferências do Thunderbird (mail.threadpane.listview, mail.pane_config.dynamic e
  mail.threadpane.cardsview.rowcount). Nenhuma preferência é alterada sem esse clique.

O QUE O ADDON NÃO FAZ

• Não envia nada para a internet, nem para o autor, nem para terceiros.
• Não usa telemetria, análise de uso, anúncios, identificadores ou rastreadores.
• Não carrega script, fonte, imagem ou estilo de servidor externo: tudo que ele usa está
  dentro do .xpi.
• Não lê, copia, encaminha nem altera o conteúdo das suas mensagens.
• Não toca em senhas, chaves, certificados nem em configuração de contas.
• Não compartilha nem vende dado nenhum, porque não tem dado nenhum para compartilhar.

REMOÇÃO DOS DADOS

Ao desinstalar o addon, o Thunderbird apaga o armazenamento local da extensão — ou seja,
as suas opções e as fotos de conta que você escolheu. Duas coisas sobrevivem, porque
passam a ser configuração do Thunderbird e não do addon: o estado recolhido do trilho e,
se você tiver clicado no botão, as três preferências de layout. Você pode desfazer o
layout pelo próprio menu Exibir do Thunderbird.

CRIANÇAS

O addon não coleta dado nenhum de ninguém, de qualquer idade.

MUDANÇAS

Se esta política mudar, a versão nova fica neste mesmo endereço, com a data de
atualização alterada, e a mudança é citada nas notas da versão.

CONTATO

sergio@theunfound.com.br — ou uma issue em
https://github.com/SergioVago/theunfound-theme

O código-fonte é público e está sob a Mozilla Public License 2.0: qualquer afirmação
desta política pode ser verificada lendo o código.
```

---

## en-US (para colar)

```
theUnfound Theme Privacy Policy

Last updated: 22 October 2026

SUMMARY

theUnfound Theme collects no data, stores nothing outside your machine and transmits
nothing. There is no server, no account to create, no telemetry, no ads and no usage
analytics. The add-on contains no network code at all.

WHAT THE ADD-ON READS, AND WHY

Everything below happens inside your computer, in your Thunderbird profile, and none of
it ever leaves it:

• Your local Thunderbird address book — looked up by the sender's e-mail address, to show
  the contact's photo and name in the message list avatar, the reading pane and the
  account rail. The add-on reads the contact; it never creates, changes or deletes
  anything in your address book.
• Your list of mail accounts and identities — to build the account rail and to recognise
  when the sender is you. The add-on does not access passwords, server settings or
  account contents.
• Headers of the message you have open — specifically Authentication-Results, added by
  your own incoming server, to flag a message that failed DMARC/SPF as suspicious.
• The preview snippet and the sender/date/subject of listed messages — read from the
  local index Thunderbird already maintains. The add-on never opens, downloads or alters
  message bodies.
• Unread counts and folder names — for the numbers in the rail and the sidebar.

WHAT THE ADD-ON STORES

• Your options (theme, avatars, preview line, sender format, dark sidebar, proportional
  font), in the extension's local storage inside your profile.
• The photo you pick for each account on the options page, stored in the same place as an
  embedded data: URL. The image comes from a file you choose or from your address book;
  it is never sent anywhere.
• Whether the account rail is collapsed or expanded, stored alongside Thunderbird's own
  window layout state.
• If — and only if — you press the "Use cards and 3 columns" button on the options page,
  three Thunderbird preferences (mail.threadpane.listview, mail.pane_config.dynamic and
  mail.threadpane.cardsview.rowcount). No preference is changed without that click.

WHAT THE ADD-ON DOES NOT DO

• It sends nothing to the internet, to the author or to any third party.
• It uses no telemetry, analytics, ads, identifiers or trackers.
• It loads no script, font, image or stylesheet from an external server: everything it
  uses is inside the .xpi.
• It does not read, copy, forward or modify the content of your messages.
• It does not touch passwords, keys, certificates or account configuration.
• It shares and sells no data, because it holds none.

DATA REMOVAL

When you uninstall the add-on, Thunderbird deletes the extension's local storage — your
options and the account photos you chose. Two things survive, because they become
Thunderbird settings rather than add-on data: the rail's collapsed state and, if you
pressed the button, the three layout preferences. Thunderbird's own View menu undoes the
layout.

CHILDREN

The add-on collects no data from anyone, of any age.

CHANGES

If this policy changes, the new version appears at this same address with an updated
date, and the change is noted in the release notes.

CONTACT

sergio@theunfound.com.br — or open an issue at
https://github.com/SergioVago/theunfound-theme

The source code is public, under the Mozilla Public License 2.0: every claim in this
policy can be verified by reading it.
```

---

### Fontes do achado sobre `data_collection_permissions`
- [Firefox built-in consent for data collection and transmission (Extension Workshop)](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Thunderbird `permissions` API — "Unlike Firefox, Thunderbird does not use the built-in onboarding flow"](https://webextension-api.thunderbird.net/en/mv2/permissions.html)
- [Teste do Gecko: "platforms where data_collection_permissions is disabled, as for Thunderbird" (bug 1987828)](https://kdab.searchfox.org/firefox-main/source/toolkit/mozapps/extensions/test/xpcshell/test_data_collection_not_in_db.js)
- [Add-on Policies, seção 6 (coleta e disclosure)](https://extensionworkshop.com/documentation/publish/add-on-policies/)
