# Rotina diária do assessor

Todo dia de madrugada uma sessão do Claude Code lê a **caixa de entrada** do app
(fotos de cupom, PDFs e prints de extrato enviados pelo celular) e cria os registros.
Eles aparecem no card “Revisar ontem” e marcados com o selo *cupom* ou *extrato*.

## O que a rotina faz

1. `node scripts/caixa.mjs baixar caixa-hoje`
   baixa os envios pendentes e gera `caixa-hoje/pendentes.json` com a lista,
   as categorias válidas e o contexto de cada pessoa (registros dos últimos 75 dias e regras aprendidas).
2. Para cada item, abre o arquivo (`Read` lê imagens e PDFs) e extrai os lançamentos:
   - **cupom**: em geral um único gasto com o total pago, o que foi comprado (ou o tipo de lugar) como item,
     o nome do estabelecimento como `local`, a data e a hora do cupom (`hora` no formato HH:MM)
     e a forma de pagamento se aparecer (Pix, Débito, Crédito, Dinheiro, Vale);
   - **extrato** (PDF ou print): uma linha por transação; ignora pagamento de fatura,
     transferências entre contas próprias e aplicações/resgates;
   - categoria: usa as regras aprendidas da pessoa; senão, a categoria que ela costuma usar para itens parecidos; senão, a mais provável;
   - a observação que a pessoa escreveu tem prioridade (ex.: “jantar com a namorada” → Namorada);
   - **não duplicar**: pula o que já existe no contexto com mesmo valor e data próxima (±3 dias).
3. Escreve `caixa-hoje/saida.json`:

   ```json
   { "itens": [
     { "id": "<id do envio>", "registros": [
       { "tipo": "gasto", "item": "Jantar", "local": "Outback Shopping Center", "hora": "20:41",
         "valor": 182.40, "data": "2026-11-08", "categoria": "Namorada", "metodo": "Crédito",
         "descricao": "texto original da linha" } ] },
     { "id": "<outro id>", "erro": "Foto desfocada, não deu pra ler o total" }
   ] }
   ```

4. `node scripts/caixa.mjs gravar caixa-hoje/saida.json`
   grava os registros, marca cada envio como processado (ou com erro) e apaga o arquivo do armazenamento.
   Rodar de novo não duplica nada.

## Acesso ao banco

A rotina precisa da **chave secreta** do Supabase (Project Settings → API Keys → Secret keys).
Ela nunca vai para o código nem para o chat: fica guardada no ambiente da nuvem do Claude,
como *Network secret* para o endereço `senrhuxfjomqppluwgsx.supabase.co`
(ou na variável `SUPABASE_SECRET_KEY`). O ambiente também precisa liberar esse endereço na rede.
