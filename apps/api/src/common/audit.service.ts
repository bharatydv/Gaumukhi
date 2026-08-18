import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Every mutation performed from the admin console lands here.
 * Reads are not logged; writes always are, with a JSON diff.
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(params: {
    actorId?: string;
    actorRole?: string;
    action: string;
    entity: string;
    entityId: string;
    diff?: unknown;
    ip?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        diff: (params.diff ?? {}) as any,
        ip: params.ip,
      },
    });
  }

  diff(before: Record<string, any>, after: Record<string, any>) {
    const out: Record<string, { from: any; to: any }> = {};
    for (const k of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
      if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) {
        out[k] = { from: before?.[k], to: after?.[k] };
      }
    }
    return out;
  }
}
