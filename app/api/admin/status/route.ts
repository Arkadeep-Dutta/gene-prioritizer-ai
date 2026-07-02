import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { getBuildInfo } from "@/lib/deployment/build-info";
import { getDeploymentConfig, getDeploymentWarnings } from "@/lib/deployment/env-check";
import { getSecurityConfig, getRateLimitConfig } from "@/lib/security/config";
import { adminErrorResponse, verifyAdminRequest } from "@/lib/security/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "admin");
  if (limited) return limited;

  const auth = verifyAdminRequest(request);
  if (!auth.ok) {
    await logAuditEvent(prisma, request, "admin.status.denied", {
      status: "failure",
      metadata: { code: auth.code },
    });
    return adminErrorResponse(auth);
  }

  await logAuditEvent(prisma, request, "admin.status.access", {
    actorHash: auth.actorHash,
    status: "success",
  });

  const security = getSecurityConfig();
  const rateLimit = getRateLimitConfig();
  const deploymentConfig = getDeploymentConfig();
  const deploymentWarnings = getDeploymentWarnings();

  try {
    const [hpoTerms, genes, associations, literatureRecords, rankingResults, auditEvents] =
      await Promise.all([
        prisma.phenotypeTerm.count(),
        prisma.gene.count(),
        prisma.genePhenotypeAssociation.count(),
        prisma.literatureRecord.count(),
        prisma.geneRankingResult.count(),
        prisma.auditEvent.count(),
      ]);

    return NextResponse.json(
      okEnvelope({
        appEnv: security.appEnv,
        build: getBuildInfo(),
        deployment: {
          target: deploymentConfig.deploymentTarget,
          databaseProvider: deploymentConfig.databaseProvider,
          warnings: deploymentWarnings,
        },
        database: { configured: isDatabaseConfigured(), reachable: true },
        counts: {
          hpoTerms,
          genes,
          associations,
          literatureRecords,
          rankingResults,
          auditEvents,
        },
        hardening: {
          rateLimitEnabled: rateLimit.enabled,
          rateLimitBackend: rateLimit.backend,
          securityHeadersEnabled: security.securityHeadersEnabled,
          cspEnabled: security.cspEnabled,
          cspReportOnly: security.cspReportOnly,
          privacyModeDefault: security.privacyModeDefault,
          logRawInputs: security.logRawInputs,
          logRequestBodies: security.logRequestBodies,
        },
      }),
    );
  } catch {
    return NextResponse.json(
      errorEnvelope(
        {
          appEnv: security.appEnv,
          build: getBuildInfo(),
          deployment: {
            target: deploymentConfig.deploymentTarget,
            databaseProvider: deploymentConfig.databaseProvider,
            warnings: deploymentWarnings,
          },
          database: { configured: isDatabaseConfigured(), reachable: false },
        },
        "ADMIN_STATUS_UNAVAILABLE",
        "Admin status is temporarily unavailable.",
      ),
      { status: 503 },
    );
  }
}
