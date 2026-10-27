# Descrição longa da listagem — pt-BR

**Como colar:** o campo de descrição da ATN aceita um subconjunto de HTML
(`<b>`, `<i>`, `<ul>`, `<li>`, `<a href>`, `<br>`, `<blockquote>`) e **ignora Markdown**.
O texto abaixo está em texto corrido com marcadores `•`, que funciona em qualquer caso
(quebras de linha viram `<br>`). Se quiser negrito nos títulos, envolva a linha em
`<b>...</b>`.

**Antes de colar:** confirme que `https://github.com/SergioVago/theunfound-theme` já existe e está
público (o repositório ainda não foi criado).

**Marca:** este texto tem **uma** menção nominativa ao Spark Mail, com atribuição à
Readdle e declaração de não-vínculo — é uso nominativo em texto longo, o mesmo que os
temas "Monterail ... inspired by" fazem na ATN hoje. Não acrescente outras; o resumo
(arquivo 02) e a interface do addon não citam marca de terceiro.

---

```
O theUnfound Theme dá ao Thunderbird a aparência de um app de e-mail moderno — a barra
lateral escura em grafite, a lista de mensagens em cartões com avatar e prévia, o painel
de leitura limpo — sem mexer em nenhuma função do programa. O visual recria no
Thunderbird o do Spark Mail (Spark Desktop 3, da Readdle); este addon é um projeto
independente, não é feito, patrocinado nem endossado pela Readdle, e não se conecta a
nenhum serviço dela.

É só aparência. Nenhuma função do Thunderbird é removida, nenhuma mensagem é alterada
e tudo volta ao normal ao desativar ou remover o addon — sem reiniciar.


O QUE MUDA NA INTERFACE

• Barra lateral escura: a barra de áreas (ícones à esquerda) e o painel de pastas
  formam uma coluna única em grafite, com a pasta selecionada numa pílula azul e o
  contador de não lidas dentro dela. Quem preferir pode voltar à barra clara nas opções.
• Trilho de contas: um botão no topo do painel de pastas recolhe o painel num trilho
  estreito, só com a foto de cada conta e as não lidas da Caixa de entrada; um clique
  abre a Entrada daquela conta. A foto vem do catálogo de endereços, de um arquivo que
  você escolhe nas opções, ou fica nas iniciais.
• Lista de mensagens (na visualização em cartões do Thunderbird): avatar circular com
  iniciais coloridas — ou a foto do contato, se ele estiver no seu catálogo de endereços;
  remetente em negrito, data em cinza à direita, assunto e uma linha de prévia; não
  lidas com ponto azul; seleção arredondada em azul claro; estrela e menu "⋮" aparecem
  ao passar o mouse.
• Nome do remetente inteligente: só o nome para quem está no seu catálogo, nome +
  domínio para desconhecidos, e um alerta âmbar quando o servidor reprovou a mensagem
  em DMARC/SPF. Dá para trocar por "sempre nome e endereço" ou "só o nome" nas opções.
• Painel de leitura: assunto grande no topo, avatar do remetente, ações só com ícone,
  barra de anexos arredondada e mais respiro em volta do texto.
• Barra superior sem bordas, com o campo de busca arredondado no centro; abas, barra de
  status, janela de mensagem avulsa e janela de composição acompanham a paleta.
• Claro, escuro ou automático (segue o tema do Thunderbird/sistema).


O QUE ELE NÃO FAZ

• Não envia nada para lugar nenhum. Nenhuma requisição de rede, nenhuma telemetria,
  nenhum servidor: o addon não tem uma única chamada de rede no código.
• Não lê, não copia e não altera o conteúdo das suas mensagens. A linha de prévia é o
  resumo que o próprio Thunderbird já guarda no índice local das mensagens.
• Não mexe em contas, senhas, filtros, pastas, regras nem em nada que seja
  configuração de e-mail.
• Não remove nem desabilita recurso nenhum do Thunderbird. Tudo que o programa faz
  continua no lugar — só com outra aparência.
• Não instala fontes, não baixa recursos externos e não inclui código de terceiros.


UM AJUSTE QUE ELE PODE MUDAR (SÓ SE VOCÊ PEDIR)

O visual foi desenhado para a visualização em cartões de três linhas e o layout de três
colunas do Thunderbird. Nas opções existe o botão "Usar cartões e 3 colunas": só ao
clicar nele o addon muda três preferências do Thunderbird
(mail.threadpane.listview, mail.pane_config.dynamic e mail.threadpane.cardsview.rowcount).
Nada é mudado sozinho, e você pode voltar pelo menu de visualização do Thunderbird a
qualquer momento. O estado recolhido/expandido do trilho é guardado junto com o resto
do layout da janela.


PRIVACIDADE

Para mostrar a foto e o nome do remetente, o addon consulta o seu catálogo de endereços
local do Thunderbird. Para o selo de remetente suspeito, lê o cabeçalho
Authentication-Results da mensagem aberta. As suas opções (e as fotos que você escolher
para as contas) ficam no armazenamento local da extensão, no seu perfil. Nada disso sai
da sua máquina: não há servidor, não há conta para criar, não há telemetria.


COMPATIBILIDADE — LEIA ANTES DE INSTALAR

O addon usa uma Experiment API, a única forma de aplicar estilo às janelas do próprio
Thunderbird. Isso tem um preço: o Thunderbird exige uma versão máxima declarada, e
versões maiores do Thunderbird podem mudar a interface por dentro. Esta versão declara
compatibilidade com o Thunderbird 140 a 158. Quando sair a 159, o addon precisa de uma
atualização — se o visual sumir depois de atualizar o Thunderbird, é isso, e não um
defeito do seu perfil.


CÓDIGO-FONTE E SUPORTE

Código aberto sob a Mozilla Public License 2.0 — a mesma licença do Thunderbird:
https://github.com/SergioVago/theunfound-theme

Problemas, ideias e capturas de tela: abra uma issue no GitHub, ou escreva para
sergio@theunfound.com.br.

theUnfound Theme é um projeto independente. "Spark" e "Spark Mail" são marcas da
Readdle, citadas aqui apenas para descrever a referência visual; não há qualquer vínculo,
patrocínio ou endosso. "Thunderbird" é marca da MZLA Technologies Corporation.
```
