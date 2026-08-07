import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDramaProjectCostSummary } from "@/lib/server/drama-project-cost-service";
import { DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const tenantId = await getTrustedTenantId(request, user);
    try {
        const summary = await getDramaProjectCostSummary(tenantId, user.id, (await context.params).id);
        return NextResponse.json({ code: 0, data: { summary }, msg: "OK" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
