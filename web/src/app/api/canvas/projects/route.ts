import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canvasProjectError, createCanvasProjectForUser, deleteCanvasProjectsForUser, listCanvasProjectsForUser } from "@/lib/server/canvas-project-service";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const params = new URL(request.url).searchParams;
    return NextResponse.json({ code: 0, data: await listCanvasProjectsForUser(user.id, { page: params.get("page"), pageSize: params.get("pageSize") }), msg: "OK" });
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    try {
        const tenantId = await getTrustedTenantId(request, user);
        const project = await createCanvasProjectForUser(user.id, await request.json().catch(() => ({})), tenantId);
        return NextResponse.json({ code: 0, data: { project }, msg: "画布项目已创建" });
    } catch (error) {
        const known = canvasProjectError(error);
        if (known) return NextResponse.json({ code: known.status, data: null, msg: known.message }, { status: known.status });
        throw error;
    }
}

export async function DELETE(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const deleted = await deleteCanvasProjectsForUser(user.id, body.ids);
    return NextResponse.json({ code: 0, data: { deleted }, msg: "画布项目已删除" });
}
