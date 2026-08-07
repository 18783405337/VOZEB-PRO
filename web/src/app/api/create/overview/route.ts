import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getCreateWorkbenchOverview } from "@/lib/server/create-workbench-overview-service";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const tenantId = await getTrustedTenantId(request, user);
    return NextResponse.json({ code: 0, data: { overview: await getCreateWorkbenchOverview(tenantId, user.id) }, msg: "OK" });
}
