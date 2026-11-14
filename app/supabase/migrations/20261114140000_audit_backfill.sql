-- As despesas anteriores à funcionalidade "quem mexeu e quando" nunca foram alteradas:
-- a última alteração delas é a criação (e não a hora em que a coluna foi acrescentada).
update public.expenses set updated_at = created_at where updated_by is null;
