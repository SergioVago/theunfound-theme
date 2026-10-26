# Resumo da listagem (campo "Summary" / "Resumo") — teto de 250 caracteres

O teto é **250**, confirmado de duas formas independentes:
1. Pela tela da ATN: a descrição do `manifest.json` da 0.3.1 tinha exatamente 200
   caracteres e o formulário mostrou "50 characters left" — 200 + 50 = 250.
2. Pelo código do addons-server (que a ATN usa), em `DescribeForm`:
   `summary = TransField(..., max_length=250)`, `name = TransField(max_length=50)`,
   `slug = forms.CharField(max_length=30)`.

Só existe um caso em que o limite muda: se a instância ligar o waffle
`content-optimization`, nome + resumo passam a valer **70 caracteres somados**
(`CombinedNameSummaryCleanMixin.MAX_LENGTH = 70`). A tela mostrando "50 characters
left" com 200 caracteres digitados prova que esse modo **está desligado** na ATN.
Limites a respeitar, então: **nome ≤ 50**, **slug ≤ 30**, **resumo ≤ 250**.

## Regra de marca para este campo: sem menção

O resumo é **campo curto e identifica o produto** — é onde a alegação de confusão de
origem é mais fácil de fazer, e é o texto que aparece sob o nome do addon na busca da ATN
e em `about:addons`. Por isso **não há variante com a marca de terceiro aqui**: o visual é
descrito por ele mesmo (grafite, barra lateral escura, trilho de contas recolhível,
cartões com avatar e prévia). A menção nominativa, com atribuição à Readdle, existe **uma
vez** em cada descrição longa (arquivos 03 e 04) — e só lá. Ver o arquivo 01, seção 2.

Os textos abaixo são os definitivos. Se mexer em qualquer palavra, reconte com
`python3 -c "print(len('''...'''))"`.

---

## pt-BR (244 caracteres)

```
O theUnfound Theme deixa o Thunderbird com a cara de um app moderno: barra lateral escura em grafite com trilho de contas recolhível, lista de mensagens com avatar e prévia, painel de leitura limpo, claro e escuro. Só aparência; nada sai daqui.
```

## en-US (246 caracteres)

```
theUnfound Theme gives Thunderbird the look of a modern mail app: a graphite dark sidebar with a collapsible account rail, avatars and preview lines in the list, a clean reading pane, light and dark. Appearance only; nothing leaves your computer.
```

---

## Campos de identificação da listagem e do manifest

| Campo | Valor | Tamanho |
|---|---|---|
| `manifest.name` | `theUnfound Theme para Thunderbird` | 33 |
| `manifest.short_name` | `theUnfound Theme` | 16 |
| `manifest.version` | `0.4.0` | — |
| `manifest.author` | `Sergio Batera` | — |
| `manifest.description` | o **resumo pt-BR** acima (244 chars) — é o texto que o Thunderbird mostra em `about:addons` e o que vai no campo "Resumo" da ATN | 244 |
| `browser_specific_settings.gecko.id` | `theme@theunfound.com.br` (permanente) | — |
| Nome da listagem em en-US | `theUnfound Theme for Thunderbird` | 32 |
| slug da ATN | `theunfound-theme` (livre: 0 extensões com esse nome) | 16 |
| Categoria da ATN | Aparência e customização | — |
| Licença na ATN | Mozilla Public License 2.0 | — |
| E-mail de suporte | `sergio@theunfound.com.br` | — |

O sufixo "para Thunderbird" / "for Thunderbird" segue o formato que a própria política da
ATN exige de quem usa "Thunderbird" no nome (`"<Add-on name> for Thunderbird"`) — esse
pedaço do nome não é problema.

> **Pendente:** o campo "Página de suporte" da ATN fica em branco até o repositório
> público existir; depois, aponte para a URL do repo (ver arquivo 01, item 8 do
> checklist).
