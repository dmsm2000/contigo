-- Altura ideal de um sítio: os meses (1 a 12) em que vale mais a pena ir.
-- Vazio (null) = ainda por preencher; os 12 meses = "o ano todo". Só informa: o sorteio não se guia por isto,
-- mas a app avisa quando o sorteado cai fora da altura e deixa sortear outro.

alter table public.places
  add column best_months smallint[]
  check (best_months is null or (cardinality(best_months) between 1 and 12 and best_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]));
