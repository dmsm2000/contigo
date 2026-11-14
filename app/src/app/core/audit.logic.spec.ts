import { describeAudit, relativeTime } from './audit.logic';

describe('describeAudit', () => {
  const base = { createdBy: 'a', createdAt: '2026-11-10T10:00:00Z' };

  it('sem alteração só mostra quem criou', () => {
    expect(describeAudit(base).updated).toBeNull();
    expect(describeAudit({ ...base, updatedAt: null }).updated).toBeNull();
  });

  it('uma correção no primeiro minuto não conta como atualização', () => {
    expect(describeAudit({ ...base, updatedBy: 'a', updatedAt: '2026-11-10T10:00:30Z' }).updated).toBeNull();
  });

  it('uma alteração mais tarde mostra quem e quando', () => {
    const audit = describeAudit({ ...base, updatedBy: 'b', updatedAt: '2026-11-12T09:00:00Z' });
    expect(audit.created).toEqual({ by: 'a', at: base.createdAt });
    expect(audit.updated).toEqual({ by: 'b', at: '2026-11-12T09:00:00Z' });
  });

  it('aceita um autor desconhecido (conta apagada)', () => {
    expect(describeAudit({ ...base, updatedBy: null, updatedAt: '2026-11-12T09:00:00Z' }).updated?.by).toBeNull();
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-11-14T12:00:00Z');

  it('usa a unidade certa', () => {
    expect(relativeTime('2026-11-14T11:59:50Z', 'pt', now)).toMatch(/agora/);
    expect(relativeTime('2026-11-14T11:30:00Z', 'pt', now)).toMatch(/30 minutos/);
    expect(relativeTime('2026-11-14T09:00:00Z', 'pt', now)).toMatch(/3 horas/);
    expect(relativeTime('2026-11-13T12:00:00Z', 'pt', now)).toMatch(/ontem/);
    expect(relativeTime('2026-11-07T12:00:00Z', 'pt', now)).toMatch(/1 semana|semana/);
    expect(relativeTime('2025-11-14T12:00:00Z', 'en', now)).toMatch(/last year/);
  });
});
